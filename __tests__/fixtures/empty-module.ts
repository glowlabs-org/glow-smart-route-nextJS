// No-op module used to shim Next.js boundary-marker packages (server-only,
// client-only) when tests import server/client modules directly. These
// packages throw in the wrong runtime by design, but vitest runs outside
// that runtime machinery and just needs them to resolve.
export {};
