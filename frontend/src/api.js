import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

// Paths of the backend endpoints. The server address is put in front by request().
export const API = {
  foods: '/api/foods',
  meals: '/api/meals',
  register: '/api/auth/register',
  login: '/api/auth/login',
  logout: '/api/auth/logout',
  me: '/api/users/me',
}

// Server address and login token are kept with Capacitor Preferences: on Android that is the
// app's private SharedPreferences, which survive app restarts and updates and are only removed
// when the app is uninstalled. localStorage would not be reliable for this, the system may clear
// it. In the browser (npm run dev) Preferences falls back to localStorage.
const SERVER_URL_KEY = 'serverUrl'
const TOKEN_KEY = 'authToken'

// Suggested on the login page as long as no server was used yet: the address from the build
// (VITE_API_BASE_URL, see .env.example). Without one, the browser suggests the address the page
// was loaded from (development server with proxy, or nginx serving frontend and API); the Android
// app runs on its own local address, so the field stays empty there.
const BUILD_SERVER_URL = normalizeServerUrl(import.meta.env.VITE_API_BASE_URL ?? '')
const DEFAULT_SERVER_URL =
  BUILD_SERVER_URL ?? (Capacitor.isNativePlatform() ? '' : window.location.origin)

// In memory as well, so requests do not have to read the storage each time.
let serverUrl = DEFAULT_SERVER_URL
let token = null
let onUnauthorized = () => {}

export class ApiError extends Error {
  constructor(status) {
    super(`Die Anfrage ist fehlgeschlagen (Status ${status}).`)
    this.status = status
  }
}

// Turns what the user typed into a clean base address, or null if it is not a usable one.
// "mealtracker.example.org/" becomes "https://mealtracker.example.org": without a scheme HTTPS
// is assumed, plain HTTP has to be typed explicitly.
export function normalizeServerUrl(input) {
  let text = input.trim()
  if (text === '') return null
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text}`

  let url
  try {
    url = new URL(text)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password || url.search || url.hash) return null
  // Keep a path, for servers that are reachable under e.g. https://example.org/mealtracker
  return url.origin + url.pathname.replace(/\/+$/, '')
}

// Plain HTTP is only harmless when it does not leave this device.
export function isUnencrypted(address) {
  const url = normalizeServerUrl(address)
  if (url === null || !url.startsWith('http://')) return false
  const host = new URL(url).hostname
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]'
}

// Reads the stored session at app start. Returns whether a token was stored, i.e. whether the
// user logged in on this device before. Apps built before the server address was stored only
// have a token; they keep using the address from their build.
export async function loadSession() {
  const [storedServerUrl, storedToken] = await Promise.all([
    Preferences.get({ key: SERVER_URL_KEY }),
    Preferences.get({ key: TOKEN_KEY }),
  ])
  serverUrl = storedServerUrl.value ?? DEFAULT_SERVER_URL
  token = storedToken.value
  return token !== null
}

// The server that was used last (or the suggestion): pre-filled on the login page.
export function getServerUrl() {
  return serverUrl
}

// A token is only valid on the server that issued it, so both are always stored together.
export async function saveSession(newServerUrl, newToken) {
  serverUrl = newServerUrl
  token = newToken
  await Preferences.set({ key: SERVER_URL_KEY, value: newServerUrl })
  await Preferences.set({ key: TOKEN_KEY, value: newToken })
}

// Logging out forgets the token but keeps the server address for the next login.
export async function clearToken() {
  token = null
  await Preferences.remove({ key: TOKEN_KEY })
}

// Called when the server rejects the stored token (logged out elsewhere, account deactivated).
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

// A request to the server of the current session, with its token.
export function request(path, options = {}) {
  return send(serverUrl + path, options, token)
}

// Login and registration go to the address typed in on the login page, without a token.
export function requestAt(otherServerUrl, path, options = {}) {
  return send(otherServerUrl + path, options, null)
}

async function send(url, options, sentToken) {
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
