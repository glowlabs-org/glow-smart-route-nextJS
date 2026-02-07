"use client";

import React from "react";

type FallbackImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  fallbackSrc?: string;
  widthForProxy?: number;
  quality?: number;
  // If true, do not proxy even if remote; useful for already optimized urls
  disableProxy?: boolean;
};

function getProxiedImageUrl(url: string, width?: number, quality: number = 75) {
  if (!url || url.startsWith("/images/") || url.startsWith("/")) {
    return url;
  }
  const params = new URLSearchParams({
    url,
    ...(width && { w: width.toString() }),
    q: quality.toString(),
  });
  return `/api/image-proxy?${params.toString()}`;
}

export function FallbackImage({
  src,
  fallbackSrc = "/images/sections/residential.jpg",
  widthForProxy,
  quality = 75,
  disableProxy = false,
  alt = "",
  onError,
  ...imgProps
}: FallbackImageProps) {
  const [currentSrc, setCurrentSrc] = React.useState<string>(
    disableProxy ? src : getProxiedImageUrl(src, widthForProxy, quality)
  );

  React.useEffect(() => {
    setCurrentSrc(
      disableProxy ? src : getProxiedImageUrl(src, widthForProxy, quality)
    );
  }, [src, disableProxy, widthForProxy, quality]);

  const handleError: React.ReactEventHandler<HTMLImageElement> = (e) => {
    // Avoid infinite loop: if already on fallback, do nothing
    if (currentSrc === fallbackSrc) return;
    setCurrentSrc(fallbackSrc);
    if (onError) onError(e);
  };

  return (
    <img
      src={currentSrc}
      alt={alt}
      onError={handleError}
      {...imgProps}
    />
  );
}

export default FallbackImage;
