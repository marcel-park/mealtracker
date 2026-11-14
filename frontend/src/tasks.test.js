import { describe, expect, it } from 'vitest'
import { canSaveTask, formatWeekdays, taskEditorFor, taskRequest, toggleWeekday } from './tasks.js'

const ALL = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

describe('formatWeekdays', () => {
  it('says "Täglich" for every day', () => {
    expect(formatWeekdays(ALL)).toBe('Täglich')
  })

  it('lists the days short, in week order', () => {
    expect(formatWeekdays(['FRIDAY', 'MONDAY', 'WEDNESDAY'])).toBe('Mo, Mi, Fr')
  })
})

describe('toggleWeekday', () => {
  it('takes a selected day away', () => {
    expect(toggleWeekday(['MONDAY', 'FRIDAY'], 'MONDAY')).toEqual(['FRIDAY'])
  })

  it('adds a day in week order', () => {
    expect(toggleWeekday(['MONDAY', 'FRIDAY'], 'WEDNESDAY')).toEqual(['MONDAY', 'WEDNESDAY', 'FRIDAY'])
  })
})

describe('taskEditorFor', () => {
  const powder = { id: 1, name: 'Proteinpulver', unit: 'G', portions: [{ id: 5, name: 'Messlöffel', amount: 30 }] }

  it('starts a new task on every day, without foods', () => {
    expect(taskEditorFor(null)).toEqual({ taskId: null, name: '', weekdays: ALL, entries: [] })
  })

  it('takes over name, days and foods of a task', () => {
    const task = {
      id: 3,
      name: 'Shake',
      weekdays: ['MONDAY'],
      items: [{ food: powder, amount: 30, portionId: 5, portionCount: 1 }],
    }
    const editor = taskEditorFor(task)
    expect(editor).toMatchObject({ taskId: 3, name: 'Shake', weekdays: ['MONDAY'] })
    expect(editor.entries[0]).toMatchObject({ food: powder, amount: 30, portionId: 5, count: 1 })
  })
})

describe('canSaveTask', () => {
  it('needs a name and at least one day', () => {
    expect(canSaveTask({ name: 'Shake', weekdays: ['MONDAY'] })).toBe(true)
    expect(canSaveTask({ name: '  ', weekdays: ['MONDAY'] })).toBe(false)
    expect(canSaveTask({ name: 'Shake', weekdays: [] })).toBe(false)
  })
})

describe('taskRequest', () => {
  it('sends the trimmed name, the days and the foods as amounts or portions', () => {
    const editor = {
      taskId: 3,
      name: ' Shake ',
      weekdays: ['MONDAY'],
      entries: [
        { food: { id: 1 }, amount: 30, portionId: 5, count: 1 },
        { food: { id: 2 }, amount: 200, portionId: null, count: null },
      ],
    }
    expect(taskRequest(editor)).toEqual({
      name: 'Shake',
      weekdays: ['MONDAY'],
      items: [
        { foodId: 1, portionId: 5, portionCount: 1 },
        { foodId: 2, amount: 200 },
      ],
    })
  })
})
