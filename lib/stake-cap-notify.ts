export type StakeCapContact = {
  type: "email" | "telegram";
  value: string;
};

export function parseStakeCapContact(contact: string): StakeCapContact | null {
  const trimmed = contact.trim();
  if (!trimmed) return null;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailRegex.test(trimmed)) {
    return { type: "email", value: trimmed };
  }

  const telegramUrlRegex = /^https?:\/\/t\.me\/([a-zA-Z0-9_]{5,32})$/i;
  const telegramHandleRegex = /^@?[a-zA-Z0-9_]{5,32}$/;
  const urlMatch = trimmed.match(telegramUrlRegex);
  if (urlMatch?.[1]) {
    return { type: "telegram", value: `@${urlMatch[1]}` };
  }
  if (telegramHandleRegex.test(trimmed)) {
    return {
      type: "telegram",
      value: trimmed.startsWith("@") ? trimmed : `@${trimmed}`,
    };
  }

  return null;
}

export function isValidWalletAddress(wallet: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(wallet);
}
