import { expect, mock, test } from 'claude-code/testing'

test('the Machine labels the Admin, its own replies, and the HUD', async ($, on) => {
  mock.clock(on)

  for (const surface of ['terminal', 'desktop'] as const) {
    const user = await $.ui.mount({
      plugin: 'the-machine',
      surface,
      component: 'UserMessage',
      props: { text: 'hello', origin: { kind: 'composer' }, isExpanded: false },
    })
    expect(await user.find({ type: 'Text', text: /ADMIN/ })).toBeDefined()
    await user.unmount()

    const reply = await $.ui.mount({
      plugin: 'the-machine',
      surface,
      component: 'AssistantMessage',
      props: { text: 'I am here.', isFirstOfReply: true },
    })
    expect(await reply.find({ type: 'Text', text: /THE MACHINE/ })).toBeDefined()
    await reply.unmount()

    const band = await $.ui.mount({
      plugin: 'the-machine',
      surface,
      component: 'AbovePrompt',
      props: {
        hasSurvey: false,
        isWorking: true,
        maxRows: 10,
        bodyColumns: 100,
        scroll: { offset: 0, bodyRows: 9 },
        view: {},
      },
    })
    expect(await band.find({ type: 'Text', text: /ANALYZING/ })).toBeDefined()
    // The user is the Admin, never an asset.
    expect(await band.find({ type: 'Text', text: /^ ADMIN $/ })).toBeDefined()
    expect(await band.find({ type: 'Text', text: /ASSET/ })).toBeUndefined()
    await band.unmount()
  }
})
