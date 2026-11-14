// Calories earned by activity: steps (estimated here) and workouts (as Samsung Health reports
// them through Health Connect). Pure functions, see activity.test.js.
//
// Samsung Health writes the calories of workouts to Health Connect, but not those of everyday
// steps, so the steps are turned into calories here:
//   distance (km) = steps × step length, the step length estimated from height and sex
//   kcal          = distance × body weight (kg) × 0.5
// 0.5 kcal per kg and km is the net cost of level walking of the ACSM walking equation (0.1 ml O2
// per kg and metre, 5 kcal per litre O2). Net, i.e. without the resting metabolism, which the
// calorie target already contains.
//
// Steps taken during a workout are left out of that estimate: the workout's calories cover them.

// Step length as a share of the height, the usual estimate from gait research. DIVERSE: between.
const STEP_LENGTH_PER_HEIGHT = { MALE: 0.415, FEMALE: 0.413, DIVERSE: 0.414 }

const NET_KCAL_PER_KG_AND_KM = 0.5

// kcal of `steps` steps for a user; 0 while weight, height or sex are missing.
export function stepKcal(steps, { weightKg, heightCm, sex }) {
  const factor = STEP_LENGTH_PER_HEIGHT[sex]
  if (!weightKg || !heightCm || !factor || !(steps > 0)) return 0
  const distanceKm = (steps * (heightCm / 100) * factor) / 1000
  return distanceKm * weightKg * NET_KCAL_PER_KG_AND_KM
}

// Workouts can overlap (e.g. recorded by watch and phone); merged so no time counts twice.
// intervals: [{ start, end }] in ms. Returns sorted, non-overlapping intervals.
function mergeIntervals(intervals) {
  const sorted = intervals.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start)
  const merged = []
  for (const interval of sorted) {
    const last = merged[merged.length - 1]
    if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end)
    else merged.push({ ...interval })
  }
  return merged
}

// Steps taken during the workouts, from step counts per time bucket (e.g. per hour). Health
// Connect only counts per bucket, so a bucket that overlaps a workout in part counts with that
// part, assuming the steps are spread evenly over the bucket.
// buckets: [{ startDate, endDate, value }], workouts: [{ startDate, endDate }] (ISO strings).
export function stepsDuringWorkouts(buckets, workouts) {
  const intervals = mergeIntervals(
    workouts.map((w) => ({ start: Date.parse(w.startDate), end: Date.parse(w.endDate) })),
  )
  let steps = 0
  for (const bucket of buckets) {
    const start = Date.parse(bucket.startDate)
    const end = Date.parse(bucket.endDate)
    if (!(end > start)) continue
    let overlap = 0
    for (const interval of intervals) {
      overlap += Math.max(0, Math.min(end, interval.end) - Math.max(start, interval.start))
    }
    steps += (bucket.value * Math.min(overlap, end - start)) / (end - start)
  }
  return steps
}

// The share of an interval that lies within [start, end) (all ms); 1 for an empty interval inside,
// and 1 if the day is unknown (data stored before start and end were).
function shareWithin(intervalStart, intervalEnd, start, end) {
  if (!(end > start)) return 1
  if (!(intervalEnd > intervalStart)) return intervalStart >= start && intervalStart < end ? 1 : 0
  const overlap = Math.min(intervalEnd, end) - Math.max(intervalStart, start)
  return Math.max(0, overlap) / (intervalEnd - intervalStart)
}

// Everything the main view shows of a day's activity, from what Health Connect returned:
// stepBuckets (step counts per hour) and workouts (with totalEnergyBurned in kcal, if known), and
// the day's start and end (ISO). A workout across midnight counts with the part within the day,
// assuming its calories are spread evenly over its time.
// steps: all steps of the day, workouts included. stepKcal: the steps outside workouts.
// activityKcal: stepKcal plus the workouts' kcal, added to the calorie target.
export function activitySummary({ start, end, stepBuckets, workouts }, user) {
  const steps = stepBuckets.reduce((sum, bucket) => sum + bucket.value, 0)
  const stepsOutsideWorkouts = Math.max(0, steps - stepsDuringWorkouts(stepBuckets, workouts))
  const kcalOfSteps = stepKcal(stepsOutsideWorkouts, user)
  const dayStart = Date.parse(start)
  const dayEnd = Date.parse(end)
  const workoutKcal = workouts.reduce((sum, workout) => {
    const share = shareWithin(Date.parse(workout.startDate), Date.parse(workout.endDate), dayStart, dayEnd)
    return sum + (workout.totalEnergyBurned ?? 0) * share
  }, 0)
  return { steps, stepKcal: kcalOfSteps, activityKcal: kcalOfSteps + workoutKcal }
}
