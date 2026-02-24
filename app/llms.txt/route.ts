import { buildLlmsIndexText } from "@/lib/llms";

export async function GET() {
  return new Response(buildLlmsIndexText(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
