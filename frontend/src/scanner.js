// Scanning the EAN of a product with the camera. No library: the browser's own BarcodeDetector
// (Shape Detection API) does the work. Android (Chrome and the WebView of the app) has it via Google
// Play services, macOS and ChromeOS too; elsewhere it is missing and the app offers no scan button.
// Pure parts, see scanner.test.js; the camera itself is in App.jsx (BarcodeScanner).

import { isValidEan } from './foods.js'

// The product barcodes. UPC-E is left out: its 8 digits are a short form of UPC-A, stored and
// checked differently.
export const EAN_FORMATS = ['ean_13', 'ean_8', 'upc_a']

// A code counts once it was read this many times in a row: one blurry frame can misread a digit
// that the check digit does not catch.
export const READS_NEEDED = 2

// Whether this device can scan EANs: the detector exists and supports the formats, and the page
// may use the camera (https or the app itself).
export async function canScanEan(win = globalThis) {
  if (!('BarcodeDetector' in win) || !win.navigator?.mediaDevices?.getUserMedia) return false
  try {
    const formats = await win.BarcodeDetector.getSupportedFormats()
    return formats.includes('ean_13')
  } catch {
    return false
  }
}

// The first valid EAN among the detected barcodes ({ rawValue }), or null. UPC-A is stored with
// its 12 digits, as printed.
export function pickEan(barcodes) {
  for (const { rawValue } of barcodes) {
    const code = String(rawValue ?? '').trim()
    if (isValidEan(code)) return code
  }
  return null
}

// Counts how often the same code was read in a row: next(state, code) -> { code, count }.
export function nextRead(state, code) {
  if (code === null) return { code: null, count: 0 }
  return { code, count: state.code === code ? state.count + 1 : 1 }
}

// What the camera is asked for: the rear camera in full HD (more pixels per bar of a small code)
// with continuous autofocus where the device offers it.
export const CAMERA_CONSTRAINTS = {
  facingMode: { ideal: 'environment' },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  advanced: [{ focusMode: 'continuous' }],
}

// Phones with several rear cameras often hand out the ultra-wide one first, which cannot focus
// close. Android names them "camera2 0, facing back", "camera2 2, facing back", …; the main camera
// has the lowest number. The deviceId of that one, or null if the names do not tell (no permission
// yet, other platforms).
export function pickBackCamera(devices) {
  const back = devices
    .filter((device) => device.kind === 'videoinput' && /back|rück|environment/i.test(device.label))
    .map((device) => ({ id: device.deviceId, number: Number(/camera2?\s*(\d+)/i.exec(device.label)?.[1]) }))
    .filter(({ number }) => !Number.isNaN(number))
    .sort((a, b) => a.number - b.number)
  return back[0]?.id ?? null
}

// Codes are read best from about a hand's width away, where the camera still focuses; a slight
// zoom makes the code big enough from there.
export const ZOOM_TARGET = 2

// Constraints that tune a running camera, from what its track can do (track.getCapabilities()):
// continuous autofocus and a slight zoom. null if there is nothing to tune.
export function tuningFor(capabilities = {}) {
  const advanced = {}
  if (capabilities.focusMode?.includes('continuous')) advanced.focusMode = 'continuous'
  const zoom = capabilities.zoom
  if (zoom && zoom.max >= 1.5) advanced.zoom = Math.min(Math.max(ZOOM_TARGET, zoom.min ?? 1), zoom.max)
  return Object.keys(advanced).length > 0 ? { advanced: [advanced] } : null
}

// Focus once on the tapped point (x, y from 0 to 1 within the picture), where the camera supports
// it; null otherwise. Afterwards the scanner goes back to continuous focus.
export function focusAt(capabilities = {}, x, y) {
  const modes = capabilities.focusMode ?? []
  if (!modes.includes('single-shot') && !modes.includes('manual') && !('pointsOfInterest' in capabilities)) return null
  const advanced = { pointsOfInterest: [{ x, y }] }
  if (modes.includes('single-shot')) advanced.focusMode = 'single-shot'
  return { advanced: [advanced] }
}
