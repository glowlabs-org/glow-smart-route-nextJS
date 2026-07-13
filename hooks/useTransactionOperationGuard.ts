import { useCallback, useEffect, useRef } from "react";
import {
  createTransactionOperationController,
  type TransactionOperation,
  type TransactionOperationController,
} from "@/lib/transaction-operation";

function useOperationController(open: boolean, invalidationKey?: unknown) {
  const controllerRef = useRef<TransactionOperationController | null>(null);
  const invalidationKeyRef = useRef(invalidationKey);
  if (!controllerRef.current) {
    controllerRef.current = createTransactionOperationController(open);
  }

  const controller = controllerRef.current;
  if (!Object.is(invalidationKeyRef.current, invalidationKey)) {
    controller.cancel();
    invalidationKeyRef.current = invalidationKey;
  }
  controller.setOpen(open);

  useEffect(() => {
    controller.activate(open);
    return () => controller.dispose();
  }, [controller, open]);

  return controller;
}

export function useTransactionOperationGuard(
  open: boolean,
  invalidationKey?: unknown,
) {
  const controller = useOperationController(open, invalidationKey);
  return useCallback((): TransactionOperation | null => {
    return controller.begin();
  }, [controller]);
}

export function useLatestTransactionOperationGuard(
  open: boolean,
  invalidationKey?: unknown,
) {
  const controller = useOperationController(open, invalidationKey);
  return useCallback((): TransactionOperation | null => {
    return controller.beginLatest();
  }, [controller]);
}
