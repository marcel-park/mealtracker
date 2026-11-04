import { Preferences } from '@capacitor/preferences'

// Backend address from the Vite env (see .env.example). Empty: same origin as the page.
const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export const API = {
  foods: `${BASE}/api/foods`,
  meals: `${BASE}/api/meals`,
  register: `${BASE}/api/auth/register`,
  login: `${BASE}/api/auth/login`,
  logout: `${BASE}/api/auth/logout`,
  me: `${BASE}/api/users/me`,
}

// The login token is kept with Capacitor Preferences: on Android that is the app's private
// SharedPreferences, which survive app restarts and updates and are only removed when the app is
// uninstalled. localStorage would not be reliable for this, the system may clear it. In the
// browser (npm run dev) Preferences falls back to localStorage.
const TOKEN_KEY = 'authToken'

let token = null // in memory as well, so requests do not have to read the storage
let onUnauthorized = () => {}

export class ApiError extends Error {
  constructor(status) {
    super(`Die Anfrage ist fehlgeschlagen (Status ${status}).`)
    this.status = status
  }
}

// Returns whether a token was stored, i.e. whether the user logged in on this device before.
export async function loadToken() {
  const { value } = await Preferences.get({ key: TOKEN_KEY })
  token = value
  return token !== null
}

export async function saveToken(newToken) {
  token = newToken
  await Preferences.set({ key: TOKEN_KEY, value: newToken })
}

export async function clearToken() {
  token = null
  await Preferences.remove({ key: TOKEN_KEY })
}

// Called when the server rejects the stored token (logged out elsewhere, account deactivated).
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

export async function request(url, options = {}) {
  const sentToken = token
  const headers = { 'Content-Type': 'application/json' }
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`

  const response = await fetch(url, { ...options, headers })
  if (!response.ok) {
    // Only with a token: a failed login attempt is a 401 as well, but must not log anybody out.
    if (response.status === 401 && sentToken) onUnauthorized()
    throw new ApiError(response.status)
  }
  const text = await response.text() // empty for 204 and other responses without a body
  return text ? JSON.parse(text) : null
}
