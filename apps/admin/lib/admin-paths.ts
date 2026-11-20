export function skinDetailPath(id: string): string {
  return `/skins/detail?id=${encodeURIComponent(id)}`;
}

export function skinScreenNewPath(skinId: string): string {
  return `/skins/screens/new?skinId=${encodeURIComponent(skinId)}`;
}

export function skinScreenEditPath(skinId: string, screenId: string): string {
  const q = new URLSearchParams({ skinId, screenId });
  return `/skins/screens/edit?${q}`;
}