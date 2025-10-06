import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";

export const revalidate = 604800; // Cache route for 1 week

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const width = request.nextUrl.searchParams.get("w");
  const quality = request.nextUrl.searchParams.get("q");

  if (!url) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  // Validate URL is from your R2 bucket
  if (!url.includes("r2.dev")) {
    return new NextResponse("Invalid URL", { status: 403 });
  }

  try {
    const imageResponse = await fetch(url);

    if (!imageResponse.ok) {
      return new NextResponse("Image not found", { status: 404 });
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    // Process image with sharp
    let processedImage = sharp(Buffer.from(imageBuffer));

    // Resize if width is specified
    if (width) {
      const widthNum = parseInt(width, 10);
      if (!isNaN(widthNum) && widthNum > 0) {
        processedImage = processedImage.resize(widthNum, null, {
          fit: "inside",
          withoutEnlargement: true,
        });
      }
    }

    // Convert to WebP with quality control
    const qualityNum = quality ? parseInt(quality, 10) : 75;
    const finalQuality = Math.min(Math.max(qualityNum, 1), 100);

    const optimizedBuffer = await processedImage
      .webp({ quality: finalQuality })
      .toBuffer();

    return new NextResponse(new Uint8Array(optimizedBuffer), {
      headers: {
        "Content-Type": "image/webp",
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error processing image:", error);
    return new NextResponse("Error processing image", { status: 500 });
  }
}
