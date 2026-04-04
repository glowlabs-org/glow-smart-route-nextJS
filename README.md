# Glow Smart Route (Next.js App)

This repo powers the Glow dashboard and marketplace experiences for purchasing,
delegating, and tracking Glow ecosystem tokens.

## Environment variables

### Required (client + server)

```bash
# Wallet + chain configuration
NEXT_PUBLIC_WALLET_CONNECT_ID="..."
NEXT_PUBLIC_CHAIN_ID="1" # 1 (mainnet) or 11155111 (sepolia)
NEXT_PUBLIC_MAINNET_RPC_URL="https://..."
NEXT_PUBLIC_SEPOLIA_RPC_URL="https://..."

# API backends
NEXT_PUBLIC_HUB_URL="https://..."
NEXT_PUBLIC_CONTROL_API_URL="https://..."
```

### Optional (server-only)

```bash
# Used by server utilities for ETH price + ENS resolution
MAINNET_RPC_URL="https://eth.merkle.io"

# Used by newsletter API route
BREVO_API_TOKEN="..."

# Used by /internal/sim to embed the separate simulator frontend
INTERNAL_SIM_URL="https://glow-mechanistic-twin-icrg-launch.vercel.app"
```

## Caching / revalidation

The homepage uses Next.js ISR. `app/page.tsx` currently sets:

```ts
export const revalidate = 30;
```

API routes also send `Cache-Control` headers for short-lived edge caching.

## Running Locally

`pnpm install`  
`pnpm dev`

## Deployment

This server is best deployed through Vercel, or any PaaS that supports NextJS.

## Telemetry

See `TELEMETRY.md`.
