export const getChainId = () => {
  if (typeof window !== "undefined") {
    if (!process.env.NEXT_PUBLIC_CHAIN_ID) {
      throw new Error("NEXT_PUBLIC_CHAIN_ID is not set");
    }
    return process.env.NEXT_PUBLIC_CHAIN_ID;
  }

  if (!process.env.CHAIN_ID) {
    throw new Error("CHAIN_ID is not set");
  }
  return process.env.CHAIN_ID;
};

export const CHAIN_ID = getChainId();
