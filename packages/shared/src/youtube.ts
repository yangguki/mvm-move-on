const YOUTUBE_ID_RE = /^[\w-]{11}$/;

const YOUTUBE_HOST_RE =
  /^(?:www\.|m\.)?(?:youtube\.com|youtube-nocookie\.com)$|^youtu\.be$/i;

function validId(id: string | null | undefined): string | null {
  if (!id || !YOUTUBE_ID_RE.test(id)) return null;
  return id;
}

function parseHostname(input: string): string | null {
  const match = input.match(/^https?:\/\/([^/?#]+)/i);
  return match ? match[1].toLowerCase() : null;
}

function queryParamV(input: string): string | null {
  const match = input.match(/(?:\?|&|#)v=([\w-]{11})/i);
  return match ? match[1] : null;
}

/** Recognizes watch?v=, youtu.be/, shorts/, embed/, m.youtube.com, youtube-nocookie.com, extra query params. */
export function parseYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;

  const host = parseHostname(trimmed);
  if (!host || !YOUTUBE_HOST_RE.test(host)) return null;

  const fromQuery = queryParamV(trimmed);
  if (fromQuery) return validId(fromQuery);

  if (/^youtu\.be$/i.test(host)) {
    const pathMatch = trimmed.match(/^https?:\/\/[^/]+\/([^/?#]+)/i);
    return pathMatch ? validId(pathMatch[1]) : null;
  }

  const pathMatch = trimmed.match(/^https?:\/\/[^/]+\/(?:embed|shorts|live|v)\/([^/?#]+)/i);
  if (pathMatch) return validId(pathMatch[1]);

  return null;
}

export function isYouTubeUrl(input: string): boolean {
  return parseYouTubeVideoId(input) !== null;
}

export function youtubeThumbnailUrl(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

/** youtube-nocookie embed for TV-style muted autoplay preview. */
export function youtubeNocookieEmbedUrl(id: string): string {
  const q =
    "autoplay=1&mute=1&playsinline=1&loop=1" +
    `&playlist=${encodeURIComponent(id)}` +
    "&controls=0&modestbranding=1";
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${q}`;
}

export function resolveExternalVideoThumbnail(url: string, thumbnailUrl?: string): string {
  const id = parseYouTubeVideoId(url);
  if (id && (!thumbnailUrl?.trim() || thumbnailUrl.trim() === url.trim())) {
    return youtubeThumbnailUrl(id);
  }
  return thumbnailUrl?.trim() || url.trim();
}