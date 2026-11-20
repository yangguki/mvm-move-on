export type SkinCreateInput = {
  kind: "html" | "tokens";
  slug: string;
  slugWasExplicit: boolean;
  name: string;
  description: string | null;
  tone: string | null;
  thumbnailUrl: string | null;
  tokens: object | null;
};

/** 생성 slug가 이미 있으면 `-2`, `-3` … 를 붙여 빈 슬롯을 고릅니다. */
export function findFreeSlug(
  baseSlug: string,
  isTaken: (slug: string) => boolean,
): string {
  if (!isTaken(baseSlug)) return baseSlug;
  for (let n = 2; ; n++) {
    const candidate = `${baseSlug}-${n}`;
    if (!isTaken(candidate)) return candidate;
  }
}

export class SkinCreateBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkinCreateBodyError";
  }
}

export const SKIN_NAME_MAX_LENGTH = 60;

export function parseSkinCreateBody(body: unknown): SkinCreateInput {
  if (!body || typeof body !== "object") throw new SkinCreateBodyError("본문이 필요해요");
  const raw = body as Record<string, unknown>;
  const kind = raw.kind === "tokens" ? "tokens" : "html";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) throw new SkinCreateBodyError("name이 필요해요");
  if (name.length > SKIN_NAME_MAX_LENGTH) {
    throw new SkinCreateBodyError(`name은 ${SKIN_NAME_MAX_LENGTH}자 이하여야 해요`);
  }
  const rawSlug = typeof raw.slug === "string" ? raw.slug.trim() : "";
  const slugWasExplicit = rawSlug.length > 0;
  let slug = slugWasExplicit ? rawSlug.toLowerCase().replace(/\s+/g, "-") : "";
  if (!slug) {
    const base = name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    slug = base || `html-skin-${Date.now()}`;
  }
  if (kind === "tokens" && !slug) throw new SkinCreateBodyError("slug가 필요해요");
  return {
    kind,
    slug,
    slugWasExplicit,
    name,
    description: typeof raw.description === "string" ? raw.description.trim() || null : null,
    tone: typeof raw.tone === "string" ? raw.tone : null,
    thumbnailUrl: typeof raw.thumbnailUrl === "string" ? raw.thumbnailUrl || null : null,
    tokens: raw.tokens && typeof raw.tokens === "object" ? raw.tokens : null,
  };
}