import { describe, expect, it } from 'vitest'
import { activitySummary, stepKcal, stepsDuringWorkouts } from './activity.js'

const max = { weightKg: 80, heightCm: 180, sex: 'MALE' }

// Hour buckets of one day from 0:00 UTC, steps per hour as given.
function hours(counts) {
  return counts.map((value, hour) => ({
    startDate: new Date(Date.UTC(2026, 10, 14, hour)).toISOString(),
    endDate: new Date(Date.UTC(2026, 10, 14, hour + 1)).toISOString(),
    value,
  }))
}

const at = (hour, minute = 0) => new Date(Date.UTC(2026, 10, 14, hour, minute)).toISOString()
const day = { start: at(0), end: new Date(Date.UTC(2026, 10, 15)).toISOString() }

describe('stepKcal', () => {
  it('estimates the net calories from distance and weight', () => {
    // 10,000 steps × 1.80 m × 0.415 = 7.47 km; × 80 kg × 0.5 = 298.8 kcal
    expect(stepKcal(10000, max)).toBeCloseTo(298.8, 6)
  })

  it('takes a slightly shorter step for women, in between for diverse', () => {
    expect(stepKcal(10000, { ...max, sex: 'FEMALE' })).toBeCloseTo(297.36, 6)
    expect(stepKcal(10000, { ...max, sex: 'DIVERSE' })).toBeCloseTo(298.08, 6)
  })

  it('is 0 without body data or steps', () => {
    expect(stepKcal(10000, { weightKg: null, heightCm: 180, sex: 'MALE' })).toBe(0)
    expect(stepKcal(10000, { weightKg: 80, heightCm: null, sex: 'MALE' })).toBe(0)
    expect(stepKcal(10000, { weightKg: 80, heightCm: 180, sex: null })).toBe(0)
    expect(stepKcal(0, max)).toBe(0)
  })
})

describe('stepsDuringWorkouts', () => {
  it('counts the part of each hour a workout covers', () => {
    const buckets = hours([0, 0, 0, 0, 0, 0, 0, 6000, 1200])
    // 7:30 to 8:30: half of hour 7 and half of hour 8
    expect(stepsDuringWorkouts(buckets, [{ startDate: at(7, 30), endDate: at(8, 30) }])).toBe(3600)
  })

  it('counts overlapping workouts only once', () => {
    const buckets = hours([0, 0, 0, 0, 0, 0, 0, 6000])
    const workouts = [
      { startDate: at(7), endDate: at(7, 30) },
      { startDate: at(7, 15), endDate: at(7, 45) },
    ]
    expect(stepsDuringWorkouts(buckets, workouts)).toBe(4500)
  })

  it('is 0 without workouts', () => {
    expect(stepsDuringWorkouts(hours([500, 800]), [])).toBe(0)
  })
})

describe('activitySummary', () => {
  it('adds the steps outside workouts and the workouts kcal', () => {
    const stepBuckets = hours([0, 0, 0, 0, 0, 0, 0, 6000, 4000])
    const workouts = [{ startDate: at(7), endDate: at(8), totalEnergyBurned: 350 }]
    const summary = activitySummary({ ...day, stepBuckets, workouts }, max)
    expect(summary.steps).toBe(10000)
    // only the 4,000 steps outside the run: 4,000 × 1.8 × 0.415 / 1000 × 80 × 0.5
    expect(summary.stepKcal).toBeCloseTo(119.52, 6)
    expect(summary.activityKcal).toBeCloseTo(469.52, 6)
  })

  it('counts a workout without known kcal as 0', () => {
    const summary = activitySummary(
      { ...day, stepBuckets: hours([1000]), workouts: [{ startDate: at(5), endDate: at(6) }] },
      max,
    )
    expect(summary.activityKcal).toBeCloseTo(summary.stepKcal, 6)
  })

  it('counts a workout across midnight with the part within the day', () => {
    // 23:30 the day before to 0:30: half of it today
    const workouts = [
      {
        startDate: new Date(Date.UTC(2026, 10, 13, 23, 30)).toISOString(),
        endDate: at(0, 30),
        totalEnergyBurned: 300,
      },
    ]
    expect(activitySummary({ ...day, stepBuckets: [], workouts }, max).activityKcal).toBeCloseTo(150, 6)
  })
})
