// What the admin view "Health-Connect-Daten" shows of what healthConnect.readAll returned: every
// type with its entries per source, the workouts with the calories around them, and how the main
// view gets its activity calories from that. Pure functions, see healthData.test.js.

import { NET_KCAL_PER_KG_AND_KM, activitySummary, stepKcal, stepLengthM, stepsDuringWorkouts } from './activity.js'

// kind 'sum': entries add up (steps, kcal, minutes); 'level': each entry is a measurement
// (resting heart rate, weight), shown as lowest, average and highest.
export const TYPE_INFO = {
  steps: { label: 'Schritte', unit: '', kind: 'sum' },
  distance: { label: 'Strecke', unit: 'm', kind: 'sum' },
  calories: { label: 'Aktiv verbrannte Kalorien', unit: 'kcal', kind: 'sum' },
  totalCalories: { label: 'Insgesamt verbrannte Kalorien', unit: 'kcal', kind: 'sum' },
  basalCalories: { label: 'Grundumsatz', unit: 'kcal/Tag', kind: 'level' },
  flightsClimbed: { label: 'Etagen', unit: '', kind: 'sum' },
  workouts: { label: 'Workouts', unit: '', kind: 'sum' },
  restingHeartRate: { label: 'Ruhepuls', unit: 'bpm', kind: 'level' },
  heartRateVariability: { label: 'Herzfrequenzvariabilität', unit: 'ms', kind: 'level' },
  vo2Max: { label: 'VO2max', unit: 'ml/kg/min', kind: 'level' },
  respiratoryRate: { label: 'Atemfrequenz', unit: '/min', kind: 'level' },
  oxygenSaturation: { label: 'Sauerstoffsättigung', unit: '%', kind: 'level' },
  sleep: { label: 'Schlaf', unit: 'min', kind: 'sum' },
  mindfulness: { label: 'Achtsamkeit', unit: 'min', kind: 'sum' },
  weight: { label: 'Gewicht', unit: 'kg', kind: 'level' },
  height: { label: 'Größe', unit: 'cm', kind: 'level' },
  bodyFat: { label: 'Körperfett', unit: '%', kind: 'level' },
  bodyTemperature: { label: 'Körpertemperatur', unit: '°C', kind: 'level' },
  basalBodyTemperature: { label: 'Basaltemperatur', unit: '°C', kind: 'level' },
  bloodPressure: { label: 'Blutdruck', unit: 'mmHg', kind: 'level' },
  bloodGlucose: { label: 'Blutzucker', unit: 'mg/dl', kind: 'level' },
  dietaryWater: { label: 'Getrunken', unit: 'l', kind: 'sum' },
  dietaryEnergyConsumed: { label: 'Ernährung', unit: 'kcal', kind: 'sum' },
}

// The sections of the view, in this order (workouts have their own).
export const TYPE_GROUPS = [
  { title: 'Aktivität und Energie', types: ['steps', 'distance', 'calories', 'totalCalories', 'basalCalories', 'flightsClimbed'] },
  {
    title: 'Herz und Atmung',
    types: ['restingHeartRate', 'heartRateVariability', 'vo2Max', 'respiratoryRate', 'oxygenSaturation'],
  },
  { title: 'Schlaf und Achtsamkeit', types: ['sleep', 'mindfulness'] },
  {
    title: 'Körper',
    types: ['weight', 'height', 'bodyFat', 'bodyTemperature', 'basalBodyTemperature', 'bloodPressure', 'bloodGlucose'],
  },
  { title: 'Ernährung', types: ['dietaryWater', 'dietaryEnergyConsumed'] },
]

const LOCALE = 'de-DE'

// A number in German notation, at most `digits` decimals; '–' for none.
export function formatNumber(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '–'
  return value.toLocaleString(LOCALE, { maximumFractionDigits: digits })
}

export function formatValue(value, unit, digits = 1) {
  const number = formatNumber(value, digits)
  return unit && number !== '–' ? `${number} ${unit}` : number
}

// What wrote an entry: the device (if Health Connect knows it) or the app, its package and the
// kind of device, as far as known. Entries of one source have the same label.
export function sourceLabel(entry) {
  const parts = [entry.sourceName, entry.sourceId, entry.deviceType].filter(Boolean)
  return [...new Set(parts)].join(' · ') || 'unbekannte Quelle'
}

const pad = (number) => String(number).padStart(2, '0')

// "08:15" for a time on `day` (local "2026-11-14"), "13.11. 23:40" for one on another day.
function timeOf(iso, day) {
  const date = new Date(iso)
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  const local = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return local === day ? clock : `${pad(date.getDate())}.${pad(date.getMonth() + 1)}. ${clock}`
}

// "08:15–08:45", or "08:15" for a measurement at one moment.
export function timeRange(startIso, endIso, day) {
  const start = timeOf(startIso, day)
  return !endIso || Date.parse(endIso) === Date.parse(startIso) ? start : `${start}–${timeOf(endIso, day)}`
}

// The entries of one type per source, most entries first: count, and the sum (kind 'sum') or the
// lowest, average and highest value (kind 'level').
export function summarizeBySource(entries, kind) {
  const bySource = new Map()
  for (const entry of entries) {
    const source = sourceLabel(entry)
    if (!bySource.has(source)) bySource.set(source, [])
    bySource.get(source).push(entry.value)
  }
  return [...bySource]
    .map(([source, values]) => {
      const sum = values.reduce((total, value) => total + value, 0)
      return kind === 'sum'
        ? { source, count: values.length, sum }
        : { source, count: values.length, min: Math.min(...values), max: Math.max(...values), average: sum / values.length }
    })
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
}

// The sum of the entries within [startMs, endMs): an entry that lies there in part counts with
// that part of its time (its value spread evenly over it), one at a single moment if it is inside.
export function sumWithin(entries, startMs, endMs) {
  return entries.reduce((sum, entry) => {
    const from = Date.parse(entry.startDate)
    const to = Date.parse(entry.endDate)
    if (!(to > from)) return from >= startMs && from < endMs ? sum + entry.value : sum
    const overlap = Math.max(0, Math.min(to, endMs) - Math.max(from, startMs))
    return sum + (entry.value * overlap) / (to - from)
  }, 0)
}

// Per workout: its type, time, minutes, source, the kcal the plugin reports for it (what the main
// view counts) and the active and total calories within its time, of all sources (null if those
// could not be read).
export function workoutRows(workouts, entries) {
  return workouts.map((workout) => {
    const start = Date.parse(workout.startDate)
    const end = Date.parse(workout.endDate)
    const within = (type) => (Array.isArray(entries[type]) ? sumWithin(entries[type], start, end) : null)
    return {
      workoutType: workout.workoutType,
      startDate: workout.startDate,
      endDate: workout.endDate,
      minutes: (end - start) / 60000,
      source: sourceLabel(workout),
      pluginKcal: workout.totalEnergyBurned ?? null,
      activeKcal: within('calories'),
      totalKcal: within('totalCalories'),
    }
  })
}

// How the main view gets the day's activity calories (see activity.js), step by step:
// steps (Health Connect's total, per hour), those during workouts, the rest, step length, distance
// and kcal of the rest, the workouts' kcal (from the plugin) and the sum. null without data.
// missing: the body data the estimate still needs.
export function activityCalculation(activity, user) {
  if (!activity || activity.error) return null
  const steps = activity.stepBuckets.reduce((sum, bucket) => sum + bucket.value, 0)
  const stepsInWorkouts = Math.min(steps, stepsDuringWorkouts(activity.stepBuckets, activity.workouts))
  const stepsOutside = steps - stepsInWorkouts
  const stepLength = stepLengthM(user)
  const summary = activitySummary(activity, user)
  const missing = [
    !user.weightKg && 'Gewicht',
    !user.heightCm && 'Größe',
    !user.sex && 'Geschlecht',
  ].filter(Boolean)
  return {
    steps,
    stepsInWorkouts,
    stepsOutside,
    stepLengthM: stepLength,
    distanceKm: stepLength ? (stepsOutside * stepLength) / 1000 : null,
    weightKg: user.weightKg ?? null,
    kcalPerKgAndKm: NET_KCAL_PER_KG_AND_KM,
    stepKcal: stepKcal(stepsOutside, user),
    workoutKcal: summary.activityKcal - summary.stepKcal,
    activityKcal: summary.activityKcal,
    missing,
  }
}

export const isError = (value) => value != null && !Array.isArray(value) && typeof value === 'object' && 'error' in value

// An entry as one line: time, value (blood pressure as systolic/diastolic) and, if asked, source.
export function entryLine(entry, type, day, withSource = false) {
  const { unit, kind } = TYPE_INFO[type]
  const value =
    type === 'bloodPressure' && entry.systolic != null
      ? `${formatNumber(entry.systolic, 0)}/${formatNumber(entry.diastolic, 0)} mmHg`
      : formatValue(entry.value, unit, kind === 'sum' ? 1 : 2)
  const line = `${timeRange(entry.startDate, entry.endDate, day)}  ${value}`
  return withSource ? `${line}  (${sourceLabel(entry)})` : line
}

export function summaryLine(summary, unit) {
  if ('sum' in summary) return `${summary.source}: ${summary.count} Einträge, zusammen ${formatValue(summary.sum, unit)}`
  return (
    `${summary.source}: ${summary.count} Einträge, ${formatValue(summary.min, unit)} bis ` +
    `${formatValue(summary.max, unit)}, Mittel ${formatValue(summary.average, unit)}`
  )
}

// Entries per type in the copied text at most, so the text stays manageable.
export const COPIED_ENTRIES = 1000

// Everything as plain text, to copy it out of the app (e.g. into a bug report).
export function describeAll(data, user) {
  const { day } = data
  const lines = [`Health Connect, ${day} (gelesen ${timeRange(data.readAt, null, day)})`]
  lines.push(
    isError(data.access)
      ? `Zugriff: Fehler: ${data.access.error}`
      : `Zugriff auf ${data.access.length} von ${Object.keys(TYPE_INFO).length} Datenarten`,
  )

  const calculation = activityCalculation(data.activity, user)
  lines.push('', 'Rechnung der Hauptansicht:')
  if (!calculation) lines.push(`  nicht gelesen: ${data.activity?.error ?? 'keine Daten'}`)
  else {
    lines.push(
      `  Schritte ${formatNumber(calculation.steps, 0)}, davon in Workouts ${formatNumber(calculation.stepsInWorkouts, 0)}, außerhalb ${formatNumber(calculation.stepsOutside, 0)}`,
      `  Schrittlänge ${formatValue(calculation.stepLengthM, 'm', 3)}, Strecke ${formatValue(calculation.distanceKm, 'km', 2)}, Gewicht ${formatValue(calculation.weightKg, 'kg')}`,
      `  Schrittkalorien ${formatValue(calculation.stepKcal, 'kcal')} + Workouts ${formatValue(calculation.workoutKcal, 'kcal')} = ${formatValue(calculation.activityKcal, 'kcal')}`,
    )
    if (calculation.missing.length > 0) lines.push(`  fehlt im Profil: ${calculation.missing.join(', ')}`)
  }

  lines.push('', 'Health Connect gesamt (bereinigt nach Datenquellen-Priorität):')
  for (const [type, total] of Object.entries(data.totals)) {
    const { label, unit } = TYPE_INFO[type]
    lines.push(`  ${label}: ${isError(total) ? `Fehler: ${total.error}` : formatValue(total, unit)}`)
  }

  lines.push('', 'Workouts:')
  if (isError(data.workouts)) lines.push(`  Fehler: ${data.workouts.error}`)
  else if (data.workouts.length === 0) lines.push('  keine')
  else {
    for (const row of workoutRows(data.workouts, data.entries)) {
      lines.push(
        `  ${timeRange(row.startDate, row.endDate, day)} ${row.workoutType} (${formatNumber(row.minutes, 0)} min, ${row.source})`,
        `    Plugin ${formatValue(row.pluginKcal, 'kcal')}, aktiv darin ${formatValue(row.activeKcal, 'kcal')}, insgesamt darin ${formatValue(row.totalKcal, 'kcal')}`,
      )
    }
  }

  for (const group of TYPE_GROUPS) {
    lines.push('', `${group.title}:`)
    for (const type of group.types) {
      const { label, unit, kind } = TYPE_INFO[type]
      const entries = data.entries[type]
      if (entries == null) continue
      if (isError(entries)) {
        lines.push(`  ${label}: Fehler: ${entries.error}`)
        continue
      }
      if (entries.length === 0) {
        lines.push(`  ${label}: keine Einträge`)
        continue
      }
      const more = data.truncated.includes(type) ? ' (nur die ersten, es gibt mehr)' : ''
      lines.push(`  ${label}: ${entries.length} Einträge${more}`)
      for (const summary of summarizeBySource(entries, kind)) lines.push(`    ${summaryLine(summary, unit)}`)
      for (const entry of entries.slice(0, COPIED_ENTRIES)) lines.push(`      ${entryLine(entry, type, day, true)}`)
      if (entries.length > COPIED_ENTRIES) lines.push(`      … ${entries.length - COPIED_ENTRIES} weitere`)
    }
  }
  return lines.join('\n')
}


// The day `days` days after `day` ("YYYY-MM-DD"; negative: before).
export function shiftDay(day, days) {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10)
}

// "Heute", "Gestern" or e.g. "Mo., 16.11.2026".
export function dayLabel(day, today) {
  if (day === today) return 'Heute'
  if (day === shiftDay(today, -1)) return 'Gestern'
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date).toLocaleDateString(LOCALE, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
