import { expect, mock, test } from 'claude-code/testing'

const measure = (percentUsed: number, resetsAt = '2026-10-09T14:00:00Z') =>
  ({
    context: { window: 200000 },
    rateLimits: [{ kind: 'five_hour', percentUsed, resetsAt }],
    changed: ['rateLimits'],
  }) as never

test('a threat alert goes out once per level and usage window', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const toasts: string[] = []
  on('ui.toast', ($, e) => {
    toasts.push(e.text)

    return { value: undefined } as never
  })
  on('session.measure', ($, e) => ({ changed: e.changed }))

  await $.session.measure(measure(45))
  expect(toasts).toEqual([])

  await $.session.measure(measure(62))
  await $.session.measure(measure(70))
  expect(toasts).toEqual(['THREAT LEVEL HIGH // SESSION 62%'])

  await $.session.measure(measure(88))
  await $.session.measure(measure(90))
  expect(toasts).toEqual(['THREAT LEVEL HIGH // SESSION 62%', 'THREAT LEVEL CRITICAL // SESSION 88%'])

  await $.session.measure(measure(65, '2026-10-09T19:00:00Z'))
  expect(toasts.at(-1)).toBe('THREAT LEVEL HIGH // SESSION 65%')
})

test('a window without a reset time alerts again after usage falls', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const toasts: string[] = []
  on('ui.toast', ($, e) => {
    toasts.push(e.text)

    return { value: undefined } as never
  })
  on('session.measure', ($, e) => ({ changed: e.changed }))

  const bare = (percentUsed: number) =>
    ({ context: { window: 200000 }, rateLimits: [{ kind: 'five_hour', percentUsed }], changed: ['rateLimits'] }) as never

  await $.session.measure(bare(70))
  await $.session.measure(bare(10))
  await $.session.measure(bare(65))
  expect(toasts).toEqual(['THREAT LEVEL HIGH // SESSION 70%', 'THREAT LEVEL HIGH // SESSION 65%'])
})

test('a level already alerted in an earlier session stays quiet', async ($, on) => {
  mock.clock(on)
  mock.store(on, { alerts: { five_hour: { resetsAt: '2026-10-09T14:00:00Z', rank: 2 } } })
  const toasts: string[] = []
  on('ui.toast', ($, e) => {
    toasts.push(e.text)

    return { value: undefined } as never
  })
  on('session.measure', ($, e) => ({ changed: e.changed }))

  await $.session.measure(measure(70))
  expect(toasts).toEqual([])
})
