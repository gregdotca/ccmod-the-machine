import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

const run = async ($: Engine, command: string) =>
  (await $.command.run({ command, args: '' } as never)).text

test('/machine reports the version, the voice, and the threat levels', async ($, on) => {
  mock.clock(on, { now: Date.parse('2026-10-09T12:00:00Z') })
  mock.store(on, { voice: false })
  on('fs.read', () => ({ value: JSON.stringify({ name: 'the-machine', version: '9.8.7' }) }))
  on('session.version', () => ({ value: { version: '2.1.296' } }) as never)
  on('session.usage', () => ({
    value: {
      rateLimits: [
        { kind: 'five_hour', percentUsed: 42.5, resetsAt: '2026-10-09T14:15:00Z' },
        { kind: 'seven_day', percentUsed: 91 },
      ],
    },
  }) as never)

  const text = await run($, 'machine')
  expect(text).toMatch(/^THE MACHINE \/\/ STATUS REPORT/)
  expect(text).toMatch(/VERSION +9\.8\.7 \/\/ CLAUDE CODE 2\.1\.296/)
  expect(text).toMatch(/MACHINE VOICE +OFFLINE/)
  expect(text).toMatch(/THREAT LEVEL +SESSION +43% ELEVATED RESETS IN 2H 15M/)
  expect(text).toMatch(/\n +WEEKLY +91% CRITICAL$/)
})

test('/machine still answers without usage, version, or manifest', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  on('fs.read', () => {
    throw new Error('no manifest')
  })
  on('session.version', () => {
    throw new Error('no version')
  })
  on('session.usage', () => {
    throw new Error('no usage')
  })

  const text = await run($, 'machine')
  expect(text).toMatch(/VERSION +UNKNOWN \/\/ CLAUDE CODE UNKNOWN/)
  expect(text).toMatch(/MACHINE VOICE +ONLINE/)
  expect(text).toMatch(/THREAT LEVEL +AWAITING TELEMETRY/)
})

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

test('/exit shows the disconnect frame, holds it, then exits, and a cancelled exit restores the band', async ($, on) => {
  const clock = mock.clock(on)
  let hasExited = false
  on('command.run', { command: 'exit' }, () => {
    hasExited = true

    return { text: 'Goodbye!' }
  })

  const exit = run($, 'exit')
  await clock.advance(1900)
  expect(hasExited).toBe(false)

  const band = await $.ui.mount({ plugin: 'the-machine', surface: 'terminal', ...BAND })
  expect(await band.find({ type: 'Text', text: /ADMIN DISCONNECTED/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /THREAT LEVEL/ })).toBeUndefined()

  await clock.advance(200)
  expect(await exit).toBe('Goodbye!')
  expect(hasExited).toBe(true)
  expect(await band.find({ type: 'Text', text: /ADMIN DISCONNECTED/ })).toBeDefined()

  await clock.advance(1100)
  expect(await band.find({ type: 'Text', text: /ADMIN DISCONNECTED/ })).toBeUndefined()
  expect(await band.find({ type: 'Text', text: /THREAT LEVEL/ })).toBeDefined()
})
