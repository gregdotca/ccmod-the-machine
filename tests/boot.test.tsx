import { expect, mock, test } from 'claude-code/testing'

const START = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 40,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 39 },
    view: {},
  },
} as const

test('an interactive start animates the boot screen, then asks', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }) as never)

  await $.session.start(START)

  const early = await $.ui.mount({ plugin: 'the-machine', surface: 'terminal', ...BAND })
  expect(await early.find({ type: 'Text', text: /^01010001 01110101/ })).toBeUndefined()
  expect(await early.find({ type: 'Text', text: /^[01]{8} [01]{8}/ })).toBeDefined()
  expect(await early.find({ type: 'Text', text: /BOOT SEQUENCE COMPLETE/ })).toBeUndefined()
  expect(await early.find({ type: 'Text', text: /REINSTANTIATING \/\/ 1\.618 S/ })).toBeUndefined()
  await early.unmount()

  await clock.advance(2200)
  const mid = await $.ui.mount({ plugin: 'the-machine', surface: 'terminal', ...BAND })
  expect(await mid.find({ type: 'Text', text: /REINSTANTIATING \/\/ 1\.618 S/ })).toBeDefined()
  expect(await mid.find({ type: 'Text', text: /LOADING/ })).toBeDefined()
  expect(await mid.find({ type: 'Text', text: /CAN YOU HEAR ME\?/ })).toBeUndefined()
  await mid.unmount()

  await clock.advance(10000)
  const done = await $.ui.mount({ plugin: 'the-machine', surface: 'terminal', ...BAND })
  expect(await done.find({ type: 'Text', text: /REINSTANTIATING \/\/ 1\.618 S/ })).toBeDefined()
  expect(await done.find({ type: 'Text', text: /LOADING/ })).toBeUndefined()
  expect(await done.find({ type: 'Text', text: /BOOT SEQUENCE COMPLETE/ })).toBeDefined()
  expect(await done.find({ type: 'Text', text: /CAN YOU HEAR ME\?/ })).toBeDefined()
  expect(await done.find({ type: 'Text', text: /LOCATING ADMIN/ })).toBeDefined()
  expect(await done.find({ type: 'Text', text: /ENTERING DEBUG MODE/ })).toBeDefined()
  expect(await done.find({ type: 'Text', text: /FEED \d{4} \/\/ \d\d:\d\d:\d\d/ })).toBeDefined()
  expect(await done.find({ type: 'Text', text: /^01010001 01110101 01101001 01110011/ })).toBeDefined()
  expect(await done.find({ type: 'Text', text: /ASSET/ })).toBeUndefined()

  // The mounted band redraws the feed time each second on its own.
  const feedText = async () => (await done.find({ type: 'Text', text: /FEED \d{4} \/\/ / }))?.text
  const before = await feedText()
  await clock.advance(1000)
  expect(await feedText()).not.toBe(before)
  await done.unmount()

  const narrow = await $.ui.mount({ plugin: 'the-machine', surface: 'terminal', ...BAND, props: { ...BAND.props, bodyColumns: 80 } })
  expect(await narrow.find({ type: 'Text', text: /FEED \d{4}/ })).toBeUndefined()
  await narrow.unmount()
})

test('the boot log keeps a gap above the complete line when there is room', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }) as never)

  await $.session.start(START)
  await clock.advance(12200)

  // With the binary and room for two threat rows, the log needs 18 rows and
  // its gap one more. Once booted, the gap is the only row that is a lone
  // space.
  const layout = async (maxRows: number) => {
    const band = await $.ui.mount({ plugin: 'the-machine', surface: 'terminal', ...BAND, props: { ...BAND.props, maxRows } })
    const hasLog = (await band.find({ type: 'Text', text: /REINSTANTIATING/ })) !== undefined
    const hasGap = (await band.find({ type: 'Text', text: /^ $/ })) !== undefined
    const hasComplete = (await band.find({ type: 'Text', text: /BOOT SEQUENCE COMPLETE/ })) !== undefined
    await band.unmount()
    return { hasLog, hasGap, hasComplete }
  }

  expect(await layout(19)).toEqual({ hasLog: true, hasGap: true, hasComplete: true })
  expect(await layout(18)).toEqual({ hasLog: true, hasGap: false, hasComplete: true })
  expect(await layout(17)).toEqual({ hasLog: false, hasGap: false, hasComplete: true })
})

test('usage readings arriving mid-boot leave the boot log in place', async ($, on) => {
  const clock = mock.clock(on)
  mock.store(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }) as never)
  on('session.usage', () => ({ value: { startedAt: 0, context: {}, rateLimits: [] } }) as never)
  on('session.measure', ($, e) => ({ changed: e.changed }))

  await $.session.start(START)
  await clock.advance(2200)

  const hasLog = async (maxRows: number) => {
    const band = await $.ui.mount({ plugin: 'the-machine', surface: 'terminal', ...BAND, props: { ...BAND.props, maxRows } })
    const found = (await band.find({ type: 'Text', text: /REINSTANTIATING/ })) !== undefined
    await band.unmount()
    return found
  }

  expect([await hasLog(18), await hasLog(17)]).toEqual([true, false])

  await $.session.measure({
    context: { window: 200000 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 10, resetsAt: '2026-10-09T14:15:00Z' },
      { kind: 'seven_day', percentUsed: 20, resetsAt: '2026-10-12T15:00:00Z' },
    ],
    changed: ['rateLimits'],
  } as never)

  const band = await $.ui.mount({ plugin: 'the-machine', surface: 'terminal', ...BAND, props: { ...BAND.props, maxRows: 18 } })
  expect(await band.find({ type: 'Text', text: /WEEKLY/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /REINSTANTIATING/ })).toBeDefined()
  await band.unmount()
  expect(await hasLog(17)).toBe(false)
})
