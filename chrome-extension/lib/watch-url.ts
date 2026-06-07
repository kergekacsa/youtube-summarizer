export function isWatchUrl(url: string | undefined): boolean {
  return !!url && /^https?:\/\/www\.youtube\.com\/watch/.test(url);
}
