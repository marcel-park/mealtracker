// Rounding shared by the other modules (no imports, so every module can use it).

const LOCALE = 'de-DE'

// Amounts in g or ml are shown and kept with one decimal.
export const roundToOneDecimal = (n) => Math.round(n * 10) / 10

// Portion counts have two decimals, like in the backend: "2,25 Stück".
export const roundCount = (n) => Math.round(n * 100) / 100

// e.g. "2,25"
export const formatDecimal = (n) => n.toLocaleString(LOCALE)
