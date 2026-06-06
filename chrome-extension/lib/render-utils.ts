export function timestampUrl(videoId: string, sec: number): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${sec}s`;
}
