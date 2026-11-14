// Body data and step goal as typed into the profile and registration form. Pure functions, see
// bodyData.test.js. The limits are the same as in the backend (BodyData.java).

export const WEIGHT_MIN = 30
export const WEIGHT_MAX = 300
export const HEIGHT_MIN = 100
export const HEIGHT_MAX = 250
export const STEP_GOAL_MAX = 100000

export const SEX_OPTIONS = [
  { value: 'MALE', label: 'Männlich' },
  { value: 'FEMALE', label: 'Weiblich' },
  { value: 'DIVERSE', label: 'Divers' },
]

// Keeps what may be typed into a number field: digits, and with decimals > 0 one decimal comma
// (a typed "." becomes ","), at most maxDigits before and `decimals` after it.
export function sanitizeNumberInput(text, maxDigits, decimals = 0) {
  const cleaned = text.replace(/\./g, ',').replace(decimals > 0 ? /[^\d,]/g : /\D/g, '')
  const [whole, ...rest] = cleaned.split(',')
  const wholePart = whole.slice(0, maxDigits)
  if (decimals === 0 || rest.length === 0) return wholePart
  return `${wholePart},${rest.join('').slice(0, decimals)}`
}

// The number typed (with "," as decimal comma) if it lies from min to max, otherwise NaN.
export function numberIn(text, min, max) {
  if (text.trim() === '' || text.endsWith(',')) return NaN
  const value = Number(text.replace(',', '.'))
  return value >= min && value <= max ? value : NaN
}

// A stored number as the text of a field: "80,5", "10000" (the field adds the thousands dot when
// it shows the value).
export const toFieldText = (value) => (value == null ? '' : String(value).replace('.', ','))
