/**
 * Safely resolves an image URL to either the original or through the local /api/image-proxy.
 * External CDNs with strict anti-hotlink or regional ISP blocks (such as MangaDex)
 * are routed through the local /api/image-proxy to guarantee 100% deliverability on all devices.
 */
export function getSafeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  // Internal media endpoints and local assets must never be proxied
  if (url.startsWith("/") || url.startsWith("/api/v1/media") || url.startsWith("/uploads")) return url;

  // External CDNs with strict anti-hotlink or regional ISP blocks
  if (url.includes("mangadex.org") || url.includes("unsplash.com")) {
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }

  return url;
}

export function getProxyFallbackUrl(url: string | null | undefined): string {
  if (!url) return "";
  // Never proxy internal/relative URLs
  if (url.startsWith("/")) return url;
  if (url.startsWith("/api/image-proxy")) return url;
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}
