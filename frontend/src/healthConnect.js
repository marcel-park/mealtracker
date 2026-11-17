// Steps and workouts of the watch, read from Android's Health Connect (Samsung Health writes the
// data of the Galaxy Watch there). Only in the Android app: the browser has no access, and the
// data never leaves the phone. What was read last today is kept in the app's storage, so the main
// view can still show it when reading fails, e.g. right after a restart without Health Connect.
//
// Samsung Health only shares its data if it is allowed to in its own settings (Health Connect);
// otherwise its workouts are missing here.
//
// The calories of a workout: the plugin adds up the active calories within the workout's time and,
// if there are none, the total calories burned, as apps write them either way.

import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { Health } from '@capgo/capacitor-health'
import { localDate } from './meals.js'

// What is read: step counts, workouts, and the active and total calories the workout calories come
// from (see above). Distance is not used, but the plugin asks Health Connect for a workout's
// distance and calories in one request, which fails as a whole without the distance permission.
const READ_TYPES = ['steps', 'workouts', 'calories', 'totalCalories', 'distance']

// Play Store page of Health Connect, for phones that do not have it (Android 13 and older).
const HEALTH_CONNECT_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'

// Whether the user connected Health Connect in the profile ("true"), and the last data read.
const CONNECTED_KEY = 'healthConnect.connected'
const LAST_READ_KEY = 'healthConnect.lastRead'

// More workouts per day than anybody records; the plugin pages beyond its limit.
const MAX_WORKOUTS = 100

export const isSupported = () => Capacitor.getPlatform() === 'android'

// 'available', 'notInstalled' (Health Connect missing or outdated) or 'unsupported' (browser).
export async function availability() {
  if (!isSupported()) return 'unsupported'
  const { available } = await Health.isAvailable()
  return available ? 'available' : 'notInstalled'
}

const allGranted = (status) => READ_TYPES.every((type) => status.readAuthorized.includes(type))

// Connected in the profile, and read access to every type is (still) granted: after an update
// that reads more types (as the total calories), the profile offers to connect again, which asks
// for the new ones. If the access cannot be checked, reading tries anyway (see readDay).
export async function isConnected() {
  const { value } = await Preferences.get({ key: CONNECTED_KEY })
  if (value !== 'true') return false
  try {
    return allGranted(await Health.checkAuthorization({ read: READ_TYPES }))
  } catch {
    return true
  }
}

// Asks Android for read access. Connected only if all types were granted.
export async function connect() {
  const granted = allGranted(await Health.requestAuthorization({ read: READ_TYPES }))
  if (granted) await Preferences.set({ key: CONNECTED_KEY, value: 'true' })
  return granted
}

// Stops reading and forgets what was read. The permission itself stays granted in Health Connect;
// apps cannot revoke it, the user can there (openSettings).
export async function disconnect() {
  await Preferences.remove({ key: CONNECTED_KEY })
  await Preferences.remove({ key: LAST_READ_KEY })
}

export function openSettings() {
  return Health.openHealthConnectSettings()
}

// Opens the Play Store page of Health Connect (in the browser, which hands it to the Play Store).
export function openStorePage() {
  window.open(HEALTH_CONNECT_STORE_URL, '_blank')
}

// The steps per hour and the workouts of a day ("2026-11-14", the device's local day), with the
// day's start and end (ISO). Stored as the last data read if it is still that day: a read started
// before midnight must not replace today's data. Throws if Health Connect cannot be read.
export async function readDay(day) {
  const start = new Date(`${day}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1) // the next midnight, also on days with a clock change
  const range = { startDate: start.toISOString(), endDate: end.toISOString() }

  const [{ samples }, { workouts }] = await Promise.all([
    // Buckets start at startDate, so these are the hours of the local day. Health Connect removes
    // duplicates (watch and phone counting the same steps) when it aggregates.
    Health.queryAggregated({ ...range, dataType: 'steps', bucket: 'hour', aggregation: 'sum', unit: 'count' }),
    Health.queryWorkouts({ ...range, limit: MAX_WORKOUTS }),
  ])
  const data = {
    day,
    start: range.startDate,
    end: range.endDate,
    stepBuckets: samples.map(({ startDate, endDate, value }) => ({ startDate, endDate, value })),
    workouts: workouts.map(({ startDate, endDate, totalEnergyBurned }) => ({
      startDate,
      endDate,
      totalEnergyBurned: totalEnergyBurned ?? null,
    })),
  }
  if (day === localDate(new Date())) {
    await Preferences.set({ key: LAST_READ_KEY, value: JSON.stringify(data) })
  }
  return data
}

// The data read last, if it is of that day; otherwise null.
export async function lastRead(day) {
  const { value } = await Preferences.get({ key: LAST_READ_KEY })
  if (!value) return null
  try {
    const data = JSON.parse(value)
    return data.day === day ? data : null
  } catch {
    return null
  }
}

// ---------- everything, for the admin view "Health-Connect-Daten" ----------
// Every type the plugin reads on Android (its manifest declares their read permissions), except
// distance while cycling (the same record type as distance) and the heart rate (thousands of
// measurements a day that say nothing about steps or calories). The main view only ever asks
// for READ_TYPES; this view asks for the others itself (requestAllAccess), so normal use never
// needs more than the activity data, and reading all of it costs nothing until the view is opened.
export const ALL_TYPES = [
  'steps',
  'distance',
  'calories',
  'totalCalories',
  'basalCalories',
  'flightsClimbed',
  'workouts',
  'restingHeartRate',
  'heartRateVariability',
  'vo2Max',
  'respiratoryRate',
  'oxygenSaturation',
  'sleep',
  'mindfulness',
  'weight',
  'height',
  'bodyFat',
  'bodyTemperature',
  'basalBodyTemperature',
  'bloodPressure',
  'bloodGlucose',
  'dietaryWater',
  'dietaryEnergyConsumed',
]

// Entries read per type at most; see readAll's truncated.
export const MAX_ENTRIES = 5000

// Health Connect's own totals (deduplicated by the user's source priorities), for the types the
// plugin can aggregate; the raw entries of all sources are summed by the view itself.
const AGGREGATED_TYPES = ['steps', 'distance', 'calories']

// The types read access is granted for, of ALL_TYPES.
export async function allAccess() {
  const status = await Health.checkAuthorization({ read: ALL_TYPES })
  return ALL_TYPES.filter((type) => status.readAuthorized.includes(type))
}

// Asks Android for read access to every type; returns the types granted.
export async function requestAllAccess() {
  const status = await Health.requestAuthorization({ read: ALL_TYPES })
  return ALL_TYPES.filter((type) => status.readAuthorized.includes(type))
}

const failure = (error) => ({ error: error?.message ?? String(error) })

// Everything Health Connect holds for a day (see readDay for day, start and end), each type on its
// own, so a missing permission or a failure only affects that type:
// - activity: what the main view reads (readDay), or { error }
// - totals: { [type]: kcal, steps or metres of the day } from Health Connect's aggregation, or { error }
// - entries: { [type]: [sample] } as the plugin returns them (all sources), or { error }
// - workouts: [workout] with all the plugin returns (type, source, ...), or { error }
// - truncated: the types with MAX_ENTRIES entries, of which there may be more
// - access: the types read access is granted for, or { error }
export async function readAll(day) {
  const start = new Date(`${day}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  const range = { startDate: start.toISOString(), endDate: end.toISOString() }

  const [access, activity, workouts, totals, entries] = await Promise.all([
    allAccess().catch(failure),
    readDay(day).catch(failure),
    Health.queryWorkouts({ ...range, limit: MAX_WORKOUTS }).then(({ workouts }) => workouts, failure),
    Promise.all(
      AGGREGATED_TYPES.map((dataType) =>
        Health.queryAggregated({ ...range, dataType, bucket: 'day', aggregation: 'sum' }).then(
          ({ samples }) => [dataType, samples.reduce((sum, sample) => sum + sample.value, 0)],
          (error) => [dataType, failure(error)],
        ),
      ),
    ),
    Promise.all(
      ALL_TYPES.filter((type) => type !== 'workouts').map((dataType) =>
        Health.readSamples({ ...range, dataType, limit: MAX_ENTRIES, ascending: true }).then(
          ({ samples }) => [dataType, samples],
          (error) => [dataType, failure(error)],
        ),
      ),
    ),
  ])
  const entriesByType = Object.fromEntries(entries)
  return {
    day,
    start: range.startDate,
    end: range.endDate,
    readAt: new Date().toISOString(),
    access,
    activity,
    workouts,
    totals: Object.fromEntries(totals),
    entries: entriesByType,
    truncated: Object.keys(entriesByType).filter(
      (type) => Array.isArray(entriesByType[type]) && entriesByType[type].length >= MAX_ENTRIES,
    ),
  }
}
