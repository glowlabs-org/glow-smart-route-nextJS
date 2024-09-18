const getEnv = (name: string) => {
    const env = process.env[name];
    if (!env) {
        throw new Error(`Environment variable ${name} is not set`);
    }
    return env;
}

export const env = {
    "mainnetRpcUrl":  process.env.MAINNET_RPC_URL || "https://eth.merkle.io",
    "deploymentChain": process.env.DEPLOYMENT_CHAIN || "1",
}