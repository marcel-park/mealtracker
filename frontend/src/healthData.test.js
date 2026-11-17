import { describe, expect, it } from 'vitest'
import {
  COPIED_ENTRIES,
  TYPE_GROUPS,
  TYPE_INFO,
  activityCalculation,
  dayLabel,
  describeAll,
  entryLine,
  formatValue,
  isError,
  shiftDay,
  sourceLabel,
  sumWithin,
  summarizeBySource,
  timeRange,
  workoutRows,
} from './healthData.js'

const DAY = '2026-11-17'
// Local times of DAY (the tests run in the machine's time zone, as the app does).
const at = (hour, minute = 0, day = 17) => new Date(2026, 10, day, hour, minute).toISOString()

const watch = { sourceName: 'Galaxy Watch7', sourceId: 'com.sec.android.app.shealth', deviceType: 'watch' }
const phone = { sourceName: 'com.google.android.apps.healthdata', sourceId: 'com.google.android.apps.healthdata' }

const entry = (from, to, value, source = watch) => ({ startDate: from, endDate: to, value, ...source })

describe('types', () => {
  it('puts every type except the workouts into exactly one group', () => {
    const grouped = TYPE_GROUPS.flatMap((group) => group.types)
    expect(new Set(grouped).size).toBe(grouped.length)
    expect([...grouped, 'workouts'].sort()).toEqual(Object.keys(TYPE_INFO).sort())
  })
})

describe('sourceLabel', () => {
  it('names device, package and kind of device, each once', () => {
    expect(sourceLabel(watch)).toBe('Galaxy Watch7 · com.sec.android.app.shealth · watch')
    expect(sourceLabel(phone)).toBe('com.google.android.apps.healthdata')
    expect(sourceLabel({})).toBe('unbekannte Quelle')
  })
})

describe('timeRange', () => {
  it('shows the clock for times of the day and the date for others', () => {
    expect(timeRange(at(8, 15), at(8, 45), DAY)).toBe('08:15–08:45')
    expect(timeRange(at(23, 40, 16), at(0, 20), DAY)).toBe('16.11. 23:40–00:20')
  })

  it('shows one time for a measurement at one moment', () => {
    expect(timeRange(at(7, 5), at(7, 5), DAY)).toBe('07:05')
    expect(timeRange(at(7, 5), null, DAY)).toBe('07:05')
  })
})

describe('summarizeBySource', () => {
  it('adds up the entries of each source, the one with most entries first', () => {
    const entries = [entry(at(8), at(9), 300), entry(at(8), at(9), 280, phone), entry(at(9), at(10), 500)]
    expect(summarizeBySource(entries, 'sum')).toEqual([
      { source: sourceLabel(watch), count: 2, sum: 800 },
      { source: sourceLabel(phone), count: 1, sum: 280 },
    ])
  })

  it('takes lowest, average and highest value of measurements', () => {
    const entries = [entry(at(8), at(8), 60), entry(at(9), at(9), 90), entry(at(10), at(10), 75)]
    expect(summarizeBySource(entries, 'level')).toEqual([
      { source: sourceLabel(watch), count: 3, min: 60, max: 90, average: 75 },
    ])
  })
})

describe('sumWithin', () => {
  it('counts an entry with the part of its time inside', () => {
    // 8:00 to 9:00 with 60 kcal, the range 8:30 to 10:00 covers half of it
    expect(sumWithin([entry(at(8), at(9), 60)], Date.parse(at(8, 30)), Date.parse(at(10)))).toBeCloseTo(30, 6)
  })

  it('counts a measurement at one moment only if it lies inside', () => {
    const entries = [entry(at(8), at(8), 5), entry(at(11), at(11), 7)]
    expect(sumWithin(entries, Date.parse(at(8)), Date.parse(at(10)))).toBe(5)
  })
})

describe('workoutRows', () => {
  const workout = {
    workoutType: 'running',
    startDate: at(18),
    endDate: at(19),
    totalEnergyBurned: 3.3,
    ...watch,
  }

  it('shows what the plugin reports next to the active and total calories in the workout', () => {
    const entries = {
      calories: [entry(at(18, 10), at(18, 11), 3.3), entry(at(12), at(13), 50)],
      totalCalories: [entry(at(18), at(19), 692)],
    }
    expect(workoutRows([workout], entries)).toEqual([
      {
        workoutType: 'running',
        startDate: at(18),
        endDate: at(19),
        minutes: 60,
        source: sourceLabel(watch),
        pluginKcal: 3.3,
        activeKcal: 3.3,
        totalKcal: 692,
      },
    ])
  })

  it('leaves out calories that could not be read, and a missing plugin value', () => {
    const [row] = workoutRows([{ ...workout, totalEnergyBurned: undefined }], { calories: { error: 'kein Zugriff' } })
    expect(row.pluginKcal).toBeNull()
    expect(row.activeKcal).toBeNull()
    expect(row.totalKcal).toBeNull()
  })
})

describe('activityCalculation', () => {
  const user = { weightKg: 80, heightCm: 180, sex: 'MALE' }
  const hour = (h, value) => ({ startDate: at(h), endDate: at(h + 1), value })

  it('shows the steps of the main view step by step', () => {
    const activity = {
      start: at(0),
      end: at(0, 0, 18),
      stepBuckets: [hour(8, 10000), hour(18, 2000)],
      workouts: [{ startDate: at(18), endDate: at(19), totalEnergyBurned: 692 }],
    }
    const calculation = activityCalculation(activity, user)
    expect(calculation.steps).toBe(12000)
    expect(calculation.stepsInWorkouts).toBe(2000)
    expect(calculation.stepsOutside).toBe(10000)
    expect(calculation.stepLengthM).toBeCloseTo(0.747, 6)
    expect(calculation.distanceKm).toBeCloseTo(7.47, 6)
    // 7.47 km × 80 kg × 0.5 kcal per kg and km
    expect(calculation.stepKcal).toBeCloseTo(298.8, 6)
    expect(calculation.workoutKcal).toBeCloseTo(692, 6)
    expect(calculation.activityKcal).toBeCloseTo(990.8, 6)
    expect(calculation.missing).toEqual([])
  })

  it('names the body data the estimate still needs', () => {
    const activity = { start: at(0), end: at(0, 0, 18), stepBuckets: [hour(8, 1000)], workouts: [] }
    const calculation = activityCalculation(activity, { weightKg: null, heightCm: 180, sex: null })
    expect(calculation.stepKcal).toBe(0)
    expect(calculation.missing).toEqual(['Gewicht', 'Geschlecht'])
  })

  it('is null without data', () => {
    expect(activityCalculation(null, user)).toBeNull()
    expect(activityCalculation({ error: 'nicht verbunden' }, user)).toBeNull()
  })
})

describe('entryLine', () => {
  it('shows time, value with unit and, if asked, the source', () => {
    expect(entryLine(entry(at(8), at(8, 1), 3.3), 'calories', DAY)).toBe('08:00–08:01  3,3 kcal')
    expect(entryLine(entry(at(8), at(8), 52), 'restingHeartRate', DAY, true)).toBe(`08:00  52 bpm  (${sourceLabel(watch)})`)
  })

  it('shows blood pressure as systolic over diastolic', () => {
    const pressure = { ...entry(at(7), at(7), 120), systolic: 120, diastolic: 80 }
    expect(entryLine(pressure, 'bloodPressure', DAY)).toBe('07:00  120/80 mmHg')
  })
})

describe('describeAll', () => {
  const data = {
    day: DAY,
    readAt: at(21, 30),
    access: ['steps', 'calories'],
    activity: { error: 'nicht verbunden' },
    workouts: [],
    totals: { steps: 1800, calories: { error: 'kein Zugriff' } },
    entries: { steps: [entry(at(8), at(9), 1800)], calories: { error: 'kein Zugriff' }, weight: [] },
    truncated: [],
  }

  it('lists access, totals, workouts and every type with its entries', () => {
    const text = describeAll(data, {})
    expect(text).toContain('Zugriff auf 2 von 23 Datenarten')
    expect(text).toContain('nicht gelesen: nicht verbunden')
    expect(text).toContain('Schritte: 1.800')
    expect(text).toContain('Aktiv verbrannte Kalorien: Fehler: kein Zugriff')
    expect(text).toContain('Workouts:\n  keine')
    expect(text).toContain(`${sourceLabel(watch)}: 1 Einträge, zusammen 1.800`)
    expect(text).toContain('Gewicht: keine Einträge')
  })

  it('copies at most COPIED_ENTRIES entries of a type', () => {
    const many = Array.from({ length: COPIED_ENTRIES + 2 }, (_, i) => entry(at(8, 0), at(8, 0), 60 + (i % 5)))
    const text = describeAll({ ...data, entries: { steps: many } }, {})
    expect(text).toContain('… 2 weitere')
  })
})

describe('helpers', () => {
  it('formats numbers the German way', () => {
    expect(formatValue(1234.56, 'kcal')).toBe('1.234,6 kcal')
    expect(formatValue(null, 'kcal')).toBe('–')
  })

  it('tells errors from data', () => {
    expect(isError({ error: 'x' })).toBe(true)
    expect(isError([])).toBe(false)
    expect(isError(12)).toBe(false)
  })
})

describe('days', () => {
  it('moves across month and year ends', () => {
    expect(shiftDay('2026-11-30', 1)).toBe('2026-12-01')
    expect(shiftDay('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('names today and yesterday, other days with their date', () => {
    expect(dayLabel('2026-11-17', '2026-11-17')).toBe('Heute')
    expect(dayLabel('2026-11-16', '2026-11-17')).toBe('Gestern')
    expect(dayLabel('2026-11-15', '2026-11-17')).toBe('So., 15.11.2026')
  })
})
