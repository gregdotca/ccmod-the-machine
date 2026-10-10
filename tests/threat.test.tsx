import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
} as const

test('the band boots, then shows the usage limits as threat levels', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-09T12:00:00Z') })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('prompt.submit', ($, e) => e as never)

  const boot = await $.ui.mount({ plugin: 'the-machine', surface: 'terminal', ...BAND })
  expect(await boot.find({ type: 'Text', text: /AWAITING TELEMETRY/ })).toBeDefined()
  await boot.unmount()

  await $.session.measure({
    context: { window: 200000 },
    rateLimits: [
      { kind: 'five_hour', percentUsed: 42.5, resetsAt: '2026-10-09T14:15:00Z' },
      { kind: 'seven_day', percentUsed: 91, resetsAt: '2026-10-12T15:00:00Z' },
    ],
    changed: ['rateLimits'],
  } as never)
  await $.prompt.submit({ text: 'hello', origin: { kind: 'composer' } } as never)

  const band = await $.ui.mount({ plugin: 'the-machine', surface: 'terminal', ...BAND })
  expect(await band.find({ type: 'Text', text: /BOOT SEQUENCE COMPLETE/ })).toBeUndefined()
  expect(await band.find({ type: 'Text', text: /SESSION/ })).toBeDefined()
  // Red is kept for threats: a window turns red from HIGH up.
  expect((await band.find({ type: 'Text', text: /43% ELEVATED/ }))?.props.color).toBe('#ffffff')
  expect((await band.find({ type: 'Text', text: /91% CRITICAL/ }))?.props.color).toBe('#ff3333')
  expect(await band.find({ type: 'Text', text: /RESETS IN 2H 15M/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /RESETS IN 3D 3H/ })).toBeDefined()
  await band.unmount()
})

test('a session starts without usage figures', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('command.register', ($, e) => ({ value: { command: e.name } }) as never)
  on('session.usage', () => {
    throw new Error('usage unavailable')
  })

  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: false } as never)

  const band = await $.ui.mount({ plugin: 'the-machine', surface: 'terminal', ...BAND })
  expect(await band.find({ type: 'Text', text: /AWAITING TELEMETRY/ })).toBeDefined()
  await band.unmount()
})
