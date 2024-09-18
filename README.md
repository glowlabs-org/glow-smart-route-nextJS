# NextJS Fullstack App For Purchasing Glow Ecosystem Tokens


## Setup environment variables
There are two optional dependencies that can be set.

```bash
MAINNET_RPC_URL="https://eth.merkle.io"
DEPLOYMENT_CHAIN="1"
```

The node should not be flooded with requests as NextJS will keep a cache
consistent with `revalidate` in the root `page.tsx` of the project. The current revalidation period is set to `36`at the time of writing this.



## Running Locally
`pnpm install`
`pnpm run dev`


## Deployment
This server is best deployed through Vercel, or any PaaS that supports NextJS.