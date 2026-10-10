import type { Engine } from 'claude-code/testing'
import { expect, mock, test } from 'claude-code/testing'

const INPUT = {
  model: 'claude-opus-5-5',
  promptModel: 'claude-opus-5-5',
  surfaces: ['terminal'],
  tools: [],
  outputStyle: null,
  traits: [],
} as const

const BASE = { id: 'intro', text: 'You are Claude Code.', scope: 'shared' } as const

const compose = async ($: Engine) =>
  (await $.prompt.compose(INPUT)).sections.find(section => section.id === 'the-machine:voice')

test('the Machine voice is on by default and keeps the reply body in normal case', async ($, on) => {
  mock.store(on)
  on('prompt.compose', () => ({ sections: [BASE] }))

  const voice = await compose($)
  expect(voice?.scope).toBe('session')
  expect(voice?.text).toMatch(/◤ QUERY RECEIVED: ADMIN ◢/)
  expect(voice?.text).toMatch(/Never write the reply itself in capitals/)
})

test('/machine-voice turns it off, on, and toggles', async ($, on) => {
  mock.store(on)
  on('prompt.compose', () => ({ sections: [BASE] }))

  expect((await $.command.run({ command: 'machine-voice', args: 'off' } as never)).text).toBe('MACHINE VOICE OFFLINE')
  expect(await compose($)).toBeUndefined()

  expect((await $.command.run({ command: 'machine-voice', args: 'on' } as never)).text).toBe('MACHINE VOICE ONLINE')
  expect(await compose($)).toBeDefined()

  expect((await $.command.run({ command: 'machine-voice', args: '' } as never)).text).toBe('MACHINE VOICE OFFLINE')
  expect(await compose($)).toBeUndefined()

  expect((await $.command.run({ command: 'machine-voice', args: 'loud' } as never)).text).toBe('Usage: /machine-voice [on|off]')
})

test('an unexpected stored value leaves the Machine voice on', async ($, on) => {
  mock.store(on, { voice: 'off' })
  on('prompt.compose', () => ({ sections: [BASE] }))

  expect(await compose($)).toBeDefined()
})
