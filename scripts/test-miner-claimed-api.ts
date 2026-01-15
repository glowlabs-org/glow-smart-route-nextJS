interface ScriptOptions {
  baseUrl: string;
}

interface MinerClaimedPayload {
  data?: {
    totalGlowPayouts?: {
      totalGlowPayouts?: string;
    } | null;
  };
  errors?: Array<{ message?: string }>;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function parseScriptOptions(): ScriptOptions {
  const args = process.argv.slice(2);
  const argBaseUrl = args.find((arg) => arg.startsWith("--base-url="));
  const envBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";
  const baseUrl = argBaseUrl ? argBaseUrl.split("=")[1] : envBaseUrl;

  return { baseUrl: normalizeBaseUrl(baseUrl) };
}

async function fetchMinerClaimed(baseUrl: string) {
  const url = `${baseUrl}/api/miner-claimed`;
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const elapsedMs = Date.now() - startedAt;

    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        status: response.status,
        elapsedMs,
        body: text,
      };
    }

    const payload = (await response.json()) as MinerClaimedPayload;
    return {
      ok: true,
      status: response.status,
      elapsedMs,
      body: payload,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: 0,
      elapsedMs: Date.now() - startedAt,
      body: message,
    };
  }
}

async function main() {
  const { baseUrl } = parseScriptOptions();
  const result = await fetchMinerClaimed(baseUrl);

  console.log("Miner-claimed API check");
  console.log("Base URL:", baseUrl);
  console.log("Status:", result.status);
  console.log("Elapsed:", `${result.elapsedMs}ms`);

  if (!result.ok) {
    console.log("Response:", result.body);
    process.exitCode = 1;
    return;
  }

  const payload = result.body as MinerClaimedPayload;
  const totalGlowPayouts =
    payload.data?.totalGlowPayouts?.totalGlowPayouts ?? "n/a";

  if (payload.errors?.length) {
    console.log(
      "GraphQL errors:",
      payload.errors.map((error) => error.message ?? "unknown")
    );
  }

  console.log("totalGlowPayouts:", totalGlowPayouts);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
