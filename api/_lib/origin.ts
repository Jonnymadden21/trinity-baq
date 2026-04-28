export function isAllowedOrigin(
  headers: { origin?: string; referer?: string },
  allowed: string[]
): boolean {
  if (allowed.length === 0) return false;
  if (headers.origin && allowed.includes(headers.origin)) return true;
  if (headers.referer) {
    return allowed.some((a) => headers.referer!.startsWith(a + "/") || headers.referer === a);
  }
  return false;
}
