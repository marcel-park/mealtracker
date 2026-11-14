// Steps and workouts of the watch, read from Android's Health Connect (Samsung Health writes the
// data of the Galaxy Watch there). Only in the Android app: the browser has no access, and the
// data never leaves the phone. What was read last today is kept in the app's storage, so the main
// view can still show it when reading fails, e.g. right after a restart without Health Connect.
//
// Unverified against a real Galaxy Watch so far: whether Samsung Health writes the calories of
// each workout (they are read as the active calories within the workout's time, see the plugin).

import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { Health } from '@capgo/capacitor-health'
import { localDate } from './meals.js'

// What is read: step counts, workouts, and the active calories the workout calories come from.
// Distance is not used, but the plugin asks Health Connect for a workout's distance and calories
// in one request, which fails as a whole without the distance permission.
const READ_TYPES = ['steps', 'workouts', 'calories', 'distance']

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

export async function isConnected() {
  const { value } = await Preferences.get({ key: CONNECTED_KEY })
  return value === 'true'
}

// Asks Android for read access. Connected only if all three types were granted.
export async function connect() {
  const status = await Health.requestAuthorization({ read: READ_TYPES })
  const granted = READ_TYPES.every((type) => status.readAuthorized.includes(type))
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
