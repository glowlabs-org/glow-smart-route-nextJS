export type AssertTransactionActive = () => void;

export class TransactionOperationCancelledError extends Error {
  constructor() {
    super("This transaction flow is no longer active.");
    this.name = "TransactionOperationCancelledError";
  }
}

export interface TransactionOperation {
  assertActive: AssertTransactionActive;
  finish: () => boolean;
}

export interface TransactionOperationController {
  activate: (open?: boolean) => void;
  begin: () => TransactionOperation | null;
  beginLatest: () => TransactionOperation | null;
  cancel: () => void;
  dispose: () => void;
  setOpen: (open: boolean) => void;
}

export function createTransactionOperationController(
  initiallyOpen: boolean,
): TransactionOperationController {
  let isMounted = false;
  let isOpen = initiallyOpen;
  let sequence = 0;
  let activeOperationId: number | null = null;

  const invalidate = () => {
    sequence += 1;
    activeOperationId = null;
  };

  const startOperation = (): TransactionOperation | null => {
    if (!isMounted || !isOpen || activeOperationId !== null) return null;

    const operationId = ++sequence;
    activeOperationId = operationId;

    return {
      assertActive() {
        if (!isMounted || !isOpen || activeOperationId !== operationId) {
          throw new TransactionOperationCancelledError();
        }
      },
      finish() {
        if (activeOperationId !== operationId) return false;
        activeOperationId = null;
        return true;
      },
    };
  };

  return {
    activate(nextOpen = isOpen) {
      isMounted = true;
      isOpen = nextOpen;
    },
    begin() {
      return startOperation();
    },
    beginLatest() {
      if (!isMounted || !isOpen) return null;
      invalidate();
      return startOperation();
    },
    cancel() {
      invalidate();
    },
    dispose() {
      isMounted = false;
      isOpen = false;
      invalidate();
    },
    setOpen(nextOpen) {
      if (isOpen && !nextOpen) invalidate();
      isOpen = nextOpen;
    },
  };
}

export function isTransactionOperationCancelled(
  error: unknown,
): error is TransactionOperationCancelledError {
  let current: unknown = error;
  const seen = new Set<unknown>();
  while (current && typeof current === "object" && !seen.has(current)) {
    if (
      current instanceof TransactionOperationCancelledError ||
      (current as { name?: unknown }).name ===
        "TransactionOperationCancelledError"
    ) {
      return true;
    }
    seen.add(current);
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Rechecks a captured operation inside a catch block. An ordinary RPC/provider
 * rejection can arrive after close, reopen, or unmount, so checking only the
 * rejection's type is insufficient: the generation must also still be active
 * before error UI, telemetry, or Result conversion is allowed.
 */
export function getTransactionOperationCancellation(
  error: unknown,
  assertTransactionActive?: AssertTransactionActive,
): unknown | null {
  if (isTransactionOperationCancelled(error)) return error;
  if (!assertTransactionActive) return null;

  try {
    assertTransactionActive();
    return null;
  } catch (assertionError) {
    if (isTransactionOperationCancelled(assertionError)) {
      return assertionError;
    }
    throw assertionError;
  }
}
