const PREFIX = "lxpilotlog."

export function readSetting(name: string): string | null {
  try {
    return localStorage.getItem(PREFIX + name)
  } catch {
    return null
  }
}

export function writeSetting(name: string, value: string) {
  try {
    if (value) localStorage.setItem(PREFIX + name, value)
    else localStorage.removeItem(PREFIX + name)
  } catch {
    /* storage unavailable */
  }
}

/** Cookies are scoped to this site's path and kept for ten years. */
export function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${PREFIX}${name}=`))
  return match ? decodeURIComponent(match.slice(PREFIX.length + name.length + 1)) : null
}

export function writeCookie(name: string, value: string) {
  document.cookie = `${PREFIX}${name}=${encodeURIComponent(value)}; max-age=${10 * 365 * 86_400}; SameSite=Strict`
}
