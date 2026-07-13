import {
  erc20Abi,
  getAddress,
  parseEventLogs,
  type Address,
  type TransactionReceipt,
} from "viem";

export function sumErc20TransfersTo({
  logs,
  token,
  recipient,
}: {
  logs: TransactionReceipt["logs"];
  token: Address;
  recipient: Address;
}): bigint {
  const tokenAddress = getAddress(token);
  const recipientAddress = getAddress(recipient);
  const transfers = parseEventLogs({
    abi: erc20Abi,
    eventName: "Transfer",
    logs,
  });

  return transfers.reduce((total, log) => {
    if (getAddress(log.address) !== tokenAddress) return total;
    if (!log.args.to || getAddress(log.args.to) !== recipientAddress) {
      return total;
    }
    return total + log.args.value;
  }, 0n);
}
