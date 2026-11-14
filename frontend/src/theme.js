// The color theme: SYSTEM follows the light or dark setting of the device, LIGHT and DARK fix it.
// The chosen theme is remembered on the device (localStorage, read synchronously), so index.html
// can apply it before the first paint, also before login. The page itself only knows light or
// dark: <html data-theme="light|dark">, see App.css.

export const SYSTEM = 'SYSTEM'
export const LIGHT = 'LIGHT'
export const DARK = 'DARK'

// Also read by the inline script in index.html; keep both in step.
const STORAGE_KEY = 'mealtracker.colorTheme'

const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)')

// 'light' or 'dark' for a theme; SYSTEM asks the device (systemDark).
export function resolveTheme(theme, systemDark) {
  if (theme === DARK) return 'dark'
  if (theme === LIGHT) return 'light'
  return systemDark ? 'dark' : 'light'
}

export function storedColorTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? SYSTEM
  } catch {
    return SYSTEM // storage blocked: follow the device
  }
}

let stopFollowingSystem = null

// Shows the theme now and remembers it. SYSTEM keeps following the device while the app runs.
export function applyColorTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // not remembered; it still applies for this run
  }
  stopFollowingSystem?.()
  stopFollowingSystem = null
  const query = darkQuery()
  const show = () => {
    document.documentElement.dataset.theme = resolveTheme(theme, query?.matches ?? false)
  }
  show()
  if (theme === SYSTEM && query) {
    query.addEventListener('change', show)
    stopFollowingSystem = () => query.removeEventListener('change', show)
  }
}
