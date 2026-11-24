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
