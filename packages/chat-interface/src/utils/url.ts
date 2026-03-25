export function getUrlParam(key: string): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get(key)
}
