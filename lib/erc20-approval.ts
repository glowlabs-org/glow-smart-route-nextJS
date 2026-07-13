const MAX_ERROR_GRAPH_NODES = 48;
const ERROR_CHILD_KEYS = [
  "cause",
  "error",
  "data",
  "originalError",
  "info",
  "payload",
  "response",
  "body",
  "errors",
] as const;
const ERROR_MESSAGE_KEYS = [
  "message",
  "shortMessage",
  "details",
  "reason",
  "body",
  "statusText",
] as const;

function readErrorField(value: object, key: string): unknown {
  try {
    return (value as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

function collectErrorGraph(error: unknown): unknown[] {
  const nodes: unknown[] = [];
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();

  while (queue.length > 0 && nodes.length < MAX_ERROR_GRAPH_NODES) {
    const current = queue.shift();
    if (current == null || seen.has(current)) continue;
    seen.add(current);
    nodes.push(current);

    if (typeof current === "string") {
      const trimmed = current.trim();
      if (
        trimmed.length <= 20_000 &&
        ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
          (trimmed.startsWith("[") && trimmed.endsWith("]")))
      ) {
        try {
          queue.push(JSON.parse(trimmed));
        } catch {
          // Non-JSON provider body; its text is still inspected below.
        }
      }
      continue;
    }
    if (typeof current !== "object") continue;
    if (Array.isArray(current)) {
      queue.push(...current.slice(0, MAX_ERROR_GRAPH_NODES));
      continue;
    }
    for (const key of ERROR_CHILD_KEYS) {
      const child = readErrorField(current, key);
      if (child != null) queue.push(child);
    }
    // Provider SDKs frequently serialize their structured error into
    // `message`/`details` instead of `body`. Enqueue every bounded message
    // field as well so JSON-looking strings receive the same structural scan.
    for (const key of ERROR_MESSAGE_KEYS) {
      const child = readErrorField(current, key);
      if (typeof child === "string" && child.length <= 20_000) {
        queue.push(child);
      }
    }
  }

  return nodes;
}

function collectErrorMessages(error: unknown): string {
  const messages: string[] = [];
  for (const node of collectErrorGraph(error)) {
    if (typeof node === "string") {
      messages.push(node.slice(0, 20_000));
      continue;
    }
    if (!node || typeof node !== "object") continue;
    for (const key of ERROR_MESSAGE_KEYS) {
      const value = readErrorField(node, key);
      if (typeof value === "string") messages.push(value.slice(0, 20_000));
    }
  }
  return messages.join("\n").toLowerCase();
}

function hasAmbiguousWriteFailureSignal(error: unknown): boolean {
  const message = collectErrorMessages(error);
  if (
    /(timed? out|timeout|connection (?:reset|closed|failed|refused|lost|aborted|error)|(?:could not|failed to) connect|network (?:error|failed|unavailable|disconnected)|failed to fetch|socket (?:hang up|closed|error)|disconnected|request (?:already )?pending|pending request|request failed|invalid wallet transaction response|transaction may have succeeded|submitted but confirmation is delayed|user (?:rejected|denied|cancelled|canceled)|rate limit|too many requests|service unavailable|gateway timeout|temporarily unavailable|transport error|provider (?:request )?(?:error|failed|failure|unavailable)|http (?:request )?(?:error|failed|failure)|internal json-rpc error|json-rpc (?:internal|server|transport) error|could not coalesce error|missing response|no response)/.test(
      message,
    )
  ) {
    return true;
  }

  for (const node of collectErrorGraph(error)) {
    if (!node || typeof node !== "object") continue;
    const code = readErrorField(node, "code");
    const numericCode =
      typeof code === "number"
        ? code
        : typeof code === "string" && /^-?\d+$/.test(code)
          ? Number(code)
          : null;
    if (
      numericCode === 4001 ||
      numericCode === 4100 ||
      numericCode === 4900 ||
      numericCode === 4901 ||
      numericCode === 4902 ||
      (numericCode !== null && numericCode >= -32700 && numericCode <= -32000)
    ) {
      return true;
    }
    const normalizedCode =
      typeof code === "string" ? code.toUpperCase() : "";
    if (
      /(ACTION_REJECTED|USER_REJECTED|CANCELLED|CANCELED|NETWORK_ERROR|SERVER_ERROR|TIMEOUT|UNKNOWN_ERROR|TRANSACTION_REPLACED|BAD_DATA|ECONN|ETIMEDOUT|ENET|EHOST|UND_ERR)/.test(
        normalizedCode,
      )
    ) {
      return true;
    }
    for (const statusKey of ["status", "statusCode", "httpStatus"] as const) {
      const status = readErrorField(node, statusKey);
      const numericStatus =
        typeof status === "number"
          ? status
          : typeof status === "string" && /^\d+$/.test(status)
            ? Number(status)
            : null;
      // Any HTTP failure wrapped around a wallet send is ambiguous: a 4xx can
      // be emitted by an upstream relay after it accepted the request just as
      // readily as a 5xx. Never let nested allowance text override it.
      if (
        numericStatus !== null &&
        numericStatus >= 400 &&
        numericStatus <= 599
      ) {
        return true;
      }
    }
    const name = readErrorField(node, "name");
    if (
      typeof name === "string" &&
      /(Timeout|HttpRequest|WebSocketRequest|RpcRequest|Network|Transport|Provider|UserRejected|Connection|Fetch|Socket|Abort)/i.test(
        name,
      )
    ) {
      return true;
    }
  }

  return false;
}

export function isDeterministicAllowanceResetError(error: unknown): boolean {
  if (hasAmbiguousWriteFailureSignal(error)) return false;
  const message = collectErrorMessages(error);
  const zeroValue = String.raw`(?:zero|\b0\b)`;
  return (
    /approve from non[- ]?zero to non[- ]?zero/.test(message) ||
    new RegExp(
      `non[- ]?zero allowance[^\\n]{0,80}(?:reset|set|change)[^\\n]{0,40}${zeroValue}`,
    ).test(message) ||
    new RegExp(
      `allowance[^\\n]{0,80}(?:must|needs?|requires?)[^\\n]{0,20}(?:be(?:\\s+(?:reset|set|changed))?|(?:reset|set|change))(?:\\s+to)?\\s+${zeroValue}`,
    ).test(message) ||
    new RegExp(
      `(?:must|needs?|requires?)[^\\n]{0,40}(?:reset|set)[^\\n]{0,40}allowance[^\\n]{0,40}${zeroValue}`,
    ).test(message) ||
    new RegExp(
      `(?:must|needs?|requires?)[^\\n]{0,40}allowance[^\\n]{0,40}(?:reset|set)[^\\n]{0,40}${zeroValue}`,
    ).test(message)
  );
}
