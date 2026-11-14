// Tasks of the checklist and the form that plans them. Pure functions, see tasks.test.js.

import { quantityFields, quantityFromItem } from './quantities.js'

// Monday first, as the backend names them (java.time.DayOfWeek).
export const WEEKDAYS = [
  { key: 'MONDAY', short: 'Mo' },
  { key: 'TUESDAY', short: 'Di' },
  { key: 'WEDNESDAY', short: 'Mi' },
  { key: 'THURSDAY', short: 'Do' },
  { key: 'FRIDAY', short: 'Fr' },
  { key: 'SATURDAY', short: 'Sa' },
  { key: 'SUNDAY', short: 'So' },
]

// "Täglich" for all seven, otherwise e.g. "Mo, Mi, Fr" in week order.
export function formatWeekdays(weekdays) {
  if (weekdays.length === WEEKDAYS.length) return 'Täglich'
  return WEEKDAYS.filter(({ key }) => weekdays.includes(key))
    .map(({ short }) => short)
    .join(', ')
}

// Adds the day or takes it away, keeping week order.
export function toggleWeekday(weekdays, day) {
  const next = weekdays.includes(day) ? weekdays.filter((other) => other !== day) : [...weekdays, day]
  return WEEKDAYS.map(({ key }) => key).filter((key) => next.includes(key))
}

// What the task form edits: { taskId, name, weekdays, entries }. A new task (task null) is due on
// every day. entries like those of a meal draft (see meals.js), so the amount views can be reused.
export function taskEditorFor(task) {
  if (task === null) {
    return { taskId: null, name: '', weekdays: WEEKDAYS.map(({ key }) => key), entries: [] }
  }
  return {
    taskId: task.id,
    name: task.name,
    weekdays: task.weekdays,
    entries: task.items.map((item) => ({
      food: item.food,
      ...quantityFromItem(item.food, item),
      baseAmount: item.amount,
      labels: [item.food.name],
    })),
  }
}

export const canSaveTask = (editor) => editor.name.trim() !== '' && editor.weekdays.length > 0

// The body of POST / PUT /api/tasks.
export function taskRequest(editor) {
  return {
    name: editor.name.trim(),
    weekdays: editor.weekdays,
    items: editor.entries.map((entry) => ({ foodId: entry.food.id, ...quantityFields(entry) })),
  }
}
