import {
  detectWalletFromProvider,
  detectWallets,
} from "../lib/wallet-detection";

describe("wallet detection", () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: originalWindow,
    });
  });

  it("prefers Rabby over MetaMask when both compatibility flags are present", () => {
    const rabbyProvider = {
      isMetaMask: true,
      isRabby: true,
    };

    expect(detectWalletFromProvider(rabbyProvider)).toMatchObject({
      name: "Rabby",
      isRabby: true,
      isMetaMask: true,
    });
  });

  it("detects Rabby from window.ethereum providers", () => {
    const rabbyProvider = {
      isMetaMask: true,
      isRabby: true,
    };
    const metaMaskProvider = {
      isMetaMask: true,
    };

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: {
        ethereum: {
          providers: [rabbyProvider, metaMaskProvider],
        },
      },
    });

    expect(detectWallets()).toEqual([
      expect.objectContaining({
        name: "Rabby",
        isRabby: true,
        isMetaMask: true,
      }),
      expect.objectContaining({
        name: "MetaMask",
        isRabby: false,
        isMetaMask: true,
      }),
    ]);
  });
});
