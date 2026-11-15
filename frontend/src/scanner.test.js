import { describe, expect, it } from 'vitest'
import { READS_NEEDED, canScanEan, focusAt, nextRead, pickBackCamera, pickEan, tuningFor } from './scanner.js'

const getUserMedia = () => {}

describe('canScanEan', () => {
  it('needs the detector with EAN-13 and the camera', async () => {
    const BarcodeDetector = { getSupportedFormats: async () => ['qr_code', 'ean_13'] }
    expect(await canScanEan({ BarcodeDetector, navigator: { mediaDevices: { getUserMedia } } })).toBe(true)
    expect(await canScanEan({ navigator: { mediaDevices: { getUserMedia } } })).toBe(false)
    expect(await canScanEan({ BarcodeDetector, navigator: {} })).toBe(false)
  })

  it('is false if EAN-13 is not supported or asking fails', async () => {
    const navigator = { mediaDevices: { getUserMedia } }
    expect(await canScanEan({ BarcodeDetector: { getSupportedFormats: async () => ['qr_code'] }, navigator })).toBe(false)
    const failing = { getSupportedFormats: async () => { throw new Error('no service') } }
    expect(await canScanEan({ BarcodeDetector: failing, navigator })).toBe(false)
  })
})

describe('pickEan', () => {
  it('takes the first code with a valid check digit', () => {
    expect(pickEan([{ rawValue: '4311501042228' }, { rawValue: '4311501042229' }])).toBe('4311501042229')
    expect(pickEan([{ rawValue: '036000291452' }])).toBe('036000291452')
  })

  it('is null without a valid EAN', () => {
    expect(pickEan([])).toBeNull()
    expect(pickEan([{ rawValue: 'https://example.org' }, { rawValue: '4311501042228' }])).toBeNull()
  })
})

describe('nextRead', () => {
  it('counts the same code read in a row and starts over for another one', () => {
    let state = { code: null, count: 0 }
    state = nextRead(state, '4311501042229')
    expect(state.count).toBe(1)
    state = nextRead(state, '4311501042229')
    expect(state.count).toBe(READS_NEEDED)
    expect(nextRead(state, '40170725')).toEqual({ code: '40170725', count: 1 })
    expect(nextRead(state, null)).toEqual({ code: null, count: 0 })
  })
})

describe('pickBackCamera', () => {
  it('takes the rear camera with the lowest number, the main one on Android', () => {
    const devices = [
      { kind: 'videoinput', deviceId: 'front', label: 'camera2 1, facing front' },
      { kind: 'videoinput', deviceId: 'wide', label: 'camera2 2, facing back' },
      { kind: 'videoinput', deviceId: 'main', label: 'camera2 0, facing back' },
      { kind: 'audioinput', deviceId: 'mic', label: 'Mikrofon' },
    ]
    expect(pickBackCamera(devices)).toBe('main')
  })

  it('is null when the names do not tell', () => {
    expect(pickBackCamera([{ kind: 'videoinput', deviceId: 'a', label: '' }])).toBeNull()
    expect(pickBackCamera([])).toBeNull()
  })
})

describe('tuningFor', () => {
  it('asks for continuous focus and a slight zoom where possible', () => {
    expect(tuningFor({ focusMode: ['manual', 'continuous'], zoom: { min: 1, max: 8 } }))
      .toEqual({ advanced: [{ focusMode: 'continuous', zoom: 2 }] })
    expect(tuningFor({ zoom: { min: 1, max: 1.6 } })).toEqual({ advanced: [{ zoom: 1.6 }] })
  })

  it('is null without focus modes or a useful zoom', () => {
    expect(tuningFor({})).toBeNull()
    expect(tuningFor(undefined)).toBeNull()
    expect(tuningFor({ zoom: { min: 1, max: 1.2 } })).toBeNull()
  })
})

describe('focusAt', () => {
  it('focuses once on the tapped point', () => {
    expect(focusAt({ focusMode: ['single-shot', 'continuous'] }, 0.5, 0.4))
      .toEqual({ advanced: [{ pointsOfInterest: [{ x: 0.5, y: 0.4 }], focusMode: 'single-shot' }] })
  })

  it('is null if the camera cannot focus on a point', () => {
    expect(focusAt({ focusMode: ['continuous'] }, 0.5, 0.5)).toBeNull()
  })
})
