/** Where shared links point. The hosted build sets VITE_SHARE_URL to the published page. */
export function shareBase(): string {
  const env = (import.meta.env?.VITE_SHARE_URL as string | undefined) ?? '';
  if (env) return env;
  try {
    return location.origin + location.pathname;
  } catch {
    return '';
  }
}
