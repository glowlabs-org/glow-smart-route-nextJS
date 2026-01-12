export function generateRandomEthAddress(): string {
  const bytes = new Uint8Array(20);
  const cryptoObj = globalThis.crypto;

  if (cryptoObj?.getRandomValues) cryptoObj.getRandomValues(bytes);
  else {
    for (let i = 0; i < 20; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}


