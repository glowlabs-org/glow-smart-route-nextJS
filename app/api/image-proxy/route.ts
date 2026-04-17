import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { isAllowedRemoteImageUrl } from "@/app/api/image-proxy/image-proxy-allowlist";

export const runtime = "nodejs";
export const revalidate = 604800; // Cache route for 1 week

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable",
};

function isLikelyHeic(raw: string, contentType: string | null): boolean {
  const lower = raw.toLowerCase();
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return true;
  const ct = (contentType ?? "").toLowerCase();
  return ct.includes("image/heic") || ct.includes("image/heif");
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const width = request.nextUrl.searchParams.get("w");
  const quality = request.nextUrl.searchParams.get("q");

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // Validate URL is from your R2 bucket
  if (!isAllowedRemoteImageUrl(url)) {
    return new NextResponse("Invalid URL", { status: 403 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const imageResponse = await fetch(url, {
      signal: controller.signal,
      // Keep origin fetch reasonably cacheable, since our output is immutable.
      next: { revalidate },
    }).finally(() => clearTimeout(timeout));

    if (!imageResponse.ok) {
      return new NextResponse("Image not found", { status: 404 });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get("content-type");

    const qualityNum = quality ? parseInt(quality, 10) : 75;
    const finalQuality = Math.min(Math.max(qualityNum, 1), 100);

    const widthNum = width ? parseInt(width, 10) : null;
    const targetWidth =
      widthNum !== null && Number.isFinite(widthNum) && widthNum > 0
        ? widthNum
        : null;

    const source = Buffer.from(imageBuffer);

    async function renderWebpFromSharp(input: sharp.Sharp) {
      let pipeline = input;
      if (targetWidth !== null) {
        pipeline = pipeline.resize(targetWidth, null, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }
      return await pipeline.webp({ quality: finalQuality }).toBuffer();
    }

    let optimizedBuffer: Buffer | null = null;
    const likelyHeic = isLikelyHeic(url, contentType);

    if (likelyHeic) {
      try {
        // sharp/libvips builds often lack HEIC codec support for certain
        // compressions; decode via wasm and then hand raw RGBA to sharp.
        const heicDecode = (await import("heic-decode")).default as unknown as (
          args: { buffer: Uint8Array }
        ) => Promise<{ width: number; height: number; data: Uint8ClampedArray }>;

        const decoded = await heicDecode({ buffer: new Uint8Array(source) });
        optimizedBuffer = await renderWebpFromSharp(
          sharp(
            Buffer.from(
              decoded.data.buffer,
              decoded.data.byteOffset,
              decoded.data.byteLength
            ),
            {
            raw: {
              width: decoded.width,
              height: decoded.height,
              channels: 4,
            },
          })
        );
      } catch {
        // Last resort: redirect to the original. Browsers that support HEIC
        // (e.g. Safari) will still render. Others will error and the client
        // will fall back.
        return new NextResponse(null, {
          status: 307,
          headers: { Location: url, ...CACHE_HEADERS },
        });
      }
    } else {
      try {
        optimizedBuffer = await renderWebpFromSharp(sharp(source));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("heif")) {
          // Some HEIC files have no extension; fall back to wasm decode.
          try {
            const heicDecode = (await import("heic-decode")).default as unknown as (
              args: { buffer: Uint8Array }
            ) => Promise<{ width: number; height: number; data: Uint8ClampedArray }>;
            const decoded = await heicDecode({ buffer: new Uint8Array(source) });
            optimizedBuffer = await renderWebpFromSharp(
              sharp(
                Buffer.from(
                  decoded.data.buffer,
                  decoded.data.byteOffset,
                  decoded.data.byteLength
                ),
                {
                raw: {
                  width: decoded.width,
                  height: decoded.height,
                  channels: 4,
                },
              })
            );
          } catch {
            return new NextResponse(null, {
              status: 307,
              headers: { Location: url, ...CACHE_HEADERS },
            });
          }
        } else {
          throw error;
        }
      }
    }

    if (!optimizedBuffer) {
      return new NextResponse("Error processing image", { status: 500 });
    }

    return new NextResponse(new Uint8Array(optimizedBuffer), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Disposition": "inline",
        ...CACHE_HEADERS,
      },
    });
  } catch (error) {
    console.error("Error processing image:", error);
    return new NextResponse("Error processing image", { status: 500 });
  }
}
