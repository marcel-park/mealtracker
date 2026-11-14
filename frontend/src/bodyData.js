// Body data and step goal as typed into the profile and registration form. Pure functions, see
// bodyData.test.js. The limits are the same as in the backend (BodyData.java).

export const WEIGHT_MIN = 30
export const WEIGHT_MAX = 300
export const HEIGHT_MIN = 100
export const HEIGHT_MAX = 250
export const STEP_GOAL_MAX = 100000

// The earliest birth date accepted; the latest is yesterday. As in the backend (BodyData.java).
export const MIN_BIRTH_DATE = '1900-01-01'

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

export const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
]

// A stored birth date ("YYYY-MM-DD" or null) as the fields hold it: { day: "14", month: "3",
// year: "1987" }, all "" for none. The month is the value of the select box, "1" to "12".
export function birthDateParts(birthDate) {
  if (!birthDate) return { day: '', month: '', year: '' }
  const [year, month, day] = birthDate.split('-')
  return { day: String(Number(day)), month: String(Number(month)), year }
}

// The birth date typed into the fields as "YYYY-MM-DD", or null if it is incomplete, no real day
// (31 April), before MIN_BIRTH_DATE or not before `today` ("YYYY-MM-DD").
export function birthDateFromParts({ day, month, year }, today) {
  if (!/^\d{1,2}$/.test(day) || month === '' || !/^\d{4}$/.test(year)) return null
  const [d, m, y] = [Number(day), Number(month), Number(year)]
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null
  const text = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return text >= MIN_BIRTH_DATE && text < today ? text : null
}
