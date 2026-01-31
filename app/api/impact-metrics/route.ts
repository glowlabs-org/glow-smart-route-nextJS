import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("https://glow.org/api/impact-metrics", {
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
