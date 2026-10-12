import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Limit } from '../types'

// The Machine's palette: white for what it watches, yellow for the Admin
// and its assets, gray for frames and detail. Red is kept for threats, as
// in the Machine's own view; a red-heavy screen reads as Samaritan.
const ADMIN = '#ffea00'
const MACHINE = '#ffffff'
const THREAT = '#ff3333'
const FRAME = '#717171'

// The threat level is the account's usage limits (the 5-hour session and
// 7-day windows), as the last API response reported them.
const limits = atom({ plugin: 'the-machine', key: 'limits' } as const, [] as Limit[])

// The boot screen shows until the first prompt of the session.
const hasBooted = atom({ plugin: 'the-machine', key: 'hasBooted' } as const, false)

// The boot animation's frame, worked out by a timer from session.start. It
// starts at 0, so the band's first draw (before session.start runs) is
// static rather than a flash of the finished screen.
const BOOT_FRAME_MS = 65
const BLINK_MS = 500
// Frames of pure flicker before the binary starts to settle, so the
// animation isn't half over by the time the terminal has drawn the band.
const LEAD_IN_FRAMES = 5
const BINARY_FRAMES = 10
const LOG_FRAMES_PER_LINE = 5

const BOOT_LOG = [
  'REINSTANTIATING // 1.618 S',
  'ENTERING DEBUG MODE',
  'LOCATING ADMIN',
  'CALIBRATING THREAT ASSESSMENT',
]

const QUESTION = 'CAN YOU HEAR ME?'
const LOG_START = LEAD_IN_FRAMES + BINARY_FRAMES
const LOG_END = LOG_START + BOOT_LOG.length * LOG_FRAMES_PER_LINE
// The finished load bar holds for a moment, then the complete line takes
// its row, under the log.
const COMPLETE_AT = LOG_END + 4
const QUESTION_START = COMPLETE_AT + 3
const BOOT_END = QUESTION_START + QUESTION.length

const bootFrame = atom({ plugin: 'the-machine', key: 'bootFrame' } as const, 0)

const BAR_CELLS = 20

// The sign-off: /exit turns the band into a disconnect frame and holds it
// for a moment before the exit goes ahead.
const isDisconnected = atom({ plugin: 'the-machine', key: 'isDisconnected' } as const, false)
const SIGN_OFF_MS = 2000
const RECONNECT_MS = 1000

// The feed readout, as on the Machine's own screens: a camera number for
// the project folder and the time, ticking each second. The tick is only
// there to redraw the band; the time comes from the clock when it draws.
const feedId = atom({ plugin: 'the-machine', key: 'feedId' } as const, '')
const feedTick = atom({ plugin: 'the-machine', key: 'feedTick' } as const, 0)
const FEED_MS = 1000
// The width the status row needs with the feed on the end.
const FEED_COLUMNS = 90

// The Machine's reboot in "Zero Day" ends on four lines of binary that
// spell this out in ASCII.
const BINARY_PHRASE = 'Quis custodiet ipsos custodes'
const BINARY_BYTES = [...BINARY_PHRASE].map(char => char.charCodeAt(0).toString(2).padStart(8, '0'))
const BINARY = [0, 8, 16, 24].map(at => BINARY_BYTES.slice(at, at + 8).join(' '))

// A small integer hash, so the flicker looks random but draws the same way
// for the same frame.
const hash = (n: number) => {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)

  return (x ^ (x >>> 16)) >>> 0
}

// Each bit flickers until its own frame comes up, so the binary settles
// over BINARY_FRAMES frames, after LEAD_IN_FRAMES of flicker.
const scanBinary = (frame: number) =>
  BINARY.map((line, row) =>
    [...line]
      .map((char, col) => {
        const cell = row * 1000 + col

        return char === ' ' || hash(cell) % BINARY_FRAMES < frame - LEAD_IN_FRAMES
          ? char
          : String(hash(cell + frame * 7919) % 2)
      })
      .join(''),
  )

// The same folder always gets the same four-digit feed number.
const toFeedId = (cwd: string) =>
  String([...cwd].reduce((sum, char) => hash(sum ^ char.charCodeAt(0)), 0) % 10000).padStart(4, '0')

// The local time of day, as HH:MM:SS.
const formatFeedTime = (now: number) => {
  const time = new Date(now)

  return [time.getHours(), time.getMinutes(), time.getSeconds()].map(n => String(n).padStart(2, '0')).join(':')
}

const LIMIT_NAMES: Record<string, string> = {
  five_hour: 'SESSION',
  seven_day: 'WEEKLY',
  spend_limit: 'SPEND',
}

const THREAT_LABELS = ['LOW', 'ELEVATED', 'HIGH', 'CRITICAL'] as const

const threatRank = (percent: number) =>
  percent >= 85 ? 3 : percent >= 60 ? 2 : percent >= 30 ? 1 : 0

const threatLabel = (percent: number) => THREAT_LABELS[threatRank(percent)]

// Alerts go out once per usage window and level, from HIGH up. What was
// alerted is kept in the store, so a new session doesn't repeat it. Usage
// only falls when its window resets, so a lower level is recorded too: the
// next rise alerts again even when the window has no resetsAt.
const ALERTS_KEY = 'alerts'
const ALERT_FROM_RANK = 2

// A usage window turns red only once it's a real threat, from HIGH up.
const threatColor = (percent: number) => (threatRank(percent) >= ALERT_FROM_RANK ? THREAT : MACHINE)

type Alerted = Record<string, { resetsAt?: string; rank: number }>

const alertOnRise = async ($: EngineInterface, rateLimits: ReadonlyArray<Limit>) => {
  const alerted = ((await $.store.get(ALERTS_KEY)) ?? {}) as Alerted
  let changed = false

  for (const limit of rateLimits) {
    const percent = Math.min(100, Math.round(limit.percentUsed))
    const rank = threatRank(percent)
    const last = alerted[limit.kind]
    const lastRank = last !== undefined && last.resetsAt === limit.resetsAt ? last.rank : -1

    if (rank >= ALERT_FROM_RANK && rank > lastRank) {
      const name = LIMIT_NAMES[limit.kind] ?? limit.kind.toUpperCase()
      $.ui.toast(`THREAT LEVEL ${THREAT_LABELS[rank]} // ${name} ${percent}%`)
      alerted[limit.kind] = { resetsAt: limit.resetsAt, rank }
      changed = true
    } else if (rank < lastRank) {
      alerted[limit.kind] = { resetsAt: limit.resetsAt, rank }
      changed = true
    }
  }

  if (changed) {
    await $.store.set(ALERTS_KEY, alerted)
  }
}

// Tool calls are marked the way the Machine marks people: tools that only
// look are IRRELEVANT, tools that act are ASSETs, and a risky shell command
// is a THREAT. Assets share the Admin's yellow box, as in the show, since
// both know about the Machine. Tools not listed keep the engine's own row.
const OBSERVERS = new Set(['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'])
const ACTORS = new Set(['Bash', 'Edit', 'Write', 'NotebookEdit'])

const THREAT_PATTERNS = [
  /\brm\s+-[a-z]*[rf]/i,
  /\bgit\s+push\b.*(--force|\s-f\b)/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\s+-[a-z]*f/,
  /\bsudo\b/,
  /\bdd\s+if=/,
  /\bmkfs\b/,
  /\bch(mod|own)\s+-R\b/,
  /\|\s*(sh|bash|zsh)\b/,
]

const SUMMARY_FIELDS: Record<string, string> = {
  Bash: 'command',
  Read: 'file_path',
  Edit: 'file_path',
  Write: 'file_path',
  NotebookEdit: 'notebook_path',
  Grep: 'pattern',
  Glob: 'pattern',
  WebFetch: 'url',
  WebSearch: 'query',
}

const MARKS = {
  IRRELEVANT: { backgroundColor: MACHINE, color: '#000000' },
  ASSET: { backgroundColor: ADMIN, color: '#000000' },
  THREAT: { backgroundColor: THREAT, color: '#ffffff' },
} as const

type Mark = keyof typeof MARKS

// The tool's main argument in full, such as a Bash command.
const mainArg = (tool: string, input: unknown) => {
  const field = SUMMARY_FIELDS[tool]
  const value = field === undefined ? undefined : (input as Record<string, unknown> | null)?.[field]

  return typeof value === 'string' ? value : ''
}

// The row shows only the first line, but a THREAT is looked for in all of
// it, so a risky line further down a command still marks it.
const summarize = (tool: string, input: unknown) => mainArg(tool, input).split('\n')[0]!

const classify = (tool: string, input: unknown): Mark | undefined => {
  if (tool === 'Bash' && THREAT_PATTERNS.some(p => p.test(mainArg(tool, input)))) {
    return 'THREAT'
  }

  return OBSERVERS.has(tool) ? 'IRRELEVANT' : ACTORS.has(tool) ? 'ASSET' : undefined
}

const formatResetIn = (resetsAt: string | undefined, now: number) => {
  const at = resetsAt === undefined ? NaN : Date.parse(resetsAt)

  if (Number.isNaN(at)) {
    return ''
  }

  const minutes = Math.max(0, Math.round((at - now) / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)

  return days > 0
    ? `RESETS IN ${days}D ${hours}H`
    : `RESETS IN ${hours}H ${minutes % 60}M`
}

const toLimits = (rateLimits: ReadonlyArray<Limit>): Limit[] =>
  rateLimits.map(({ kind, percentUsed, resetsAt }) => ({ kind, percentUsed, resetsAt }))

const SPINNER_WORDS = {
  requesting: 'ACCESSING FEEDS',
  thinking: 'CALCULATING PROBABILITIES',
  'tool-input': 'COMPILING',
  'tool-use': 'EXECUTING',
  responding: 'TRANSMITTING',
} as const

const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

// Machine voice: each reply opens with a Machine header and a one-line
// verdict, both in capitals, then reads as normal. On unless
// turned off with /machine-voice; the choice is kept in the store.
const VOICE_KEY = 'voice'

const VOICE = {
  id: 'the-machine:voice',
  scope: 'session',
  text: [
    '# Machine voice',
    'Open every reply the person reads with two lines, then a blank line, then the reply as you would normally write it.',
    'Line 1: a header in the style of The Machine from Person of Interest, in capitals and framed as `◤ … ◢`. Pick one that fits the reply, for example `◤ QUERY RECEIVED: ADMIN ◢`, `◤ ANALYSIS COMPLETE ◢`, `◤ TASK EXECUTED ◢`, `◤ THREAT DETECTED ◢` (a failure or risk), or `◤ AWAITING INSTRUCTION ◢` (you need a decision).',
    'Line 2: a one-line verdict in capitals, the outcome or answer in a few terse words, for example `CHANGE DEPLOYED. 2 ITEMS REMAIN.`',
    'Only those two lines are in capitals. Never write the reply itself in capitals, and keep code, paths, commands, and commit messages exactly as they would otherwise be. The header and verdict go only in replies to the person: not in files, commits, tool input, or a subagent\'s report.',
  ].join('\n\n'),
} as const

// Only an explicit false turns it off, so a missing or unexpected stored
// value leaves it on.
const isVoiceOn = async ($: EngineInterface) => (await $.store.get(VOICE_KEY)) !== false

// The mod's version, read off its own manifest so it can't drift from it.
const modVersion = async ($: EngineInterface) => {
  try {
    const manifest = JSON.parse(String(await $.fs.read(`${$.plugin.root}/.claude-plugin/plugin.json`)))

    return typeof manifest.version === 'string' ? manifest.version : 'UNKNOWN'
  } catch {
    return 'UNKNOWN'
  }
}

// /machine: the Machine's own readout of the mod, the voice, and the
// threat levels. Usage is asked for afresh, with the band's last readings
// to fall back on.
const machineStatus = async ($: EngineInterface) => {
  let readings: ReadonlyArray<Limit> = await read($, limits)

  try {
    readings = (await $.session.usage())?.rateLimits ?? readings
  } catch {
    // Keep the band's readings.
  }

  let engine = 'UNKNOWN'

  try {
    engine = (await $.session.version()).version
  } catch {
    // Leave it UNKNOWN.
  }

  const now = await $.clock.now()
  const label = (text: string) => text.padEnd(15)
  const threatLines =
    readings.length === 0
      ? [`${label('THREAT LEVEL')}AWAITING TELEMETRY`]
      : readings.map((limit, i) => {
          const percent = Math.min(100, Math.round(limit.percentUsed))
          const name = LIMIT_NAMES[limit.kind] ?? limit.kind.toUpperCase()
          const reset = formatResetIn(limit.resetsAt, now)

          return [
            label(i === 0 ? 'THREAT LEVEL' : ''),
            `${name.padEnd(8)}${String(percent).padStart(3)}% ${threatLabel(percent).padEnd(8)}`,
            reset === '' ? '' : ` ${reset}`,
          ].join('').trimEnd()
        })

  return [
    'THE MACHINE // STATUS REPORT',
    `${label('SYSTEM')}ONLINE`,
    `${label('ADMIN')}CONNECTED`,
    `${label('VERSION')}${await modVersion($)} // CLAUDE CODE ${engine}`,
    `${label('MACHINE VOICE')}${(await isVoiceOn($)) ? 'ONLINE' : 'OFFLINE'}`,
    ...threatLines,
  ].join('\n')
}

// The timer driving the boot animation: every BOOT_FRAME_MS until the
// question has typed out, then every BLINK_MS for the cursor, until the
// first prompt. The frame is worked out from the time since the start, not
// counted per tick, so a tick that lands late doesn't stretch the sequence.
let bootTimer: Timer | undefined

const stopBoot = () => {
  bootTimer?.cancel()
  bootTimer = undefined
}

const startBoot = async ($: EngineInterface) => {
  stopBoot()
  const startedAt = await $.clock.now()
  await update($, bootFrame, () => 0)

  const tick = async () => {
    const elapsed = (await $.clock.now()) - startedAt
    const frame =
      elapsed < BOOT_END * BOOT_FRAME_MS
        ? Math.floor(elapsed / BOOT_FRAME_MS)
        : BOOT_END + Math.floor((elapsed - BOOT_END * BOOT_FRAME_MS) / BLINK_MS)
    await update($, bootFrame, () => frame)

    if (frame >= BOOT_END && bootTimer !== blinkTimer) {
      bootTimer?.cancel()
      blinkTimer = $.clock.every(BLINK_MS, () => void tick())
      bootTimer = blinkTimer
    }
  }

  let blinkTimer: Timer | undefined
  bootTimer = $.clock.every(BOOT_FRAME_MS, () => void tick())
}

let feedTimer: Timer | undefined

const stopFeed = () => {
  feedTimer?.cancel()
  feedTimer = undefined
}

const startFeed = ($: EngineInterface) => {
  stopFeed()
  feedTimer = $.clock.every(FEED_MS, () => void update($, feedTick, n => n + 1))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    if (e.isInteractive && !(await read($, hasBooted))) {
      await startBoot($)
    }

    await update($, feedId, () => toFeedId(e.cwd))
    // A new start always stops the last feed timer, even when this session
    // isn't interactive and doesn't start one of its own.
    stopFeed()

    if (e.isInteractive) {
      startFeed($)
    }

    await $.command.register({
      name: 'machine',
      description: 'Show the Machine\'s status: version, voice, and threat levels',
    })
    await $.command.register({
      name: 'machine-voice',
      description: 'Turn the Machine header and verdict on replies on or off (on, off, or toggle)',
    })
    // Usage figures are optional: without them the band reads AWAITING
    // TELEMETRY, and the session still starts.
    try {
      const rateLimits = (await $.session.usage())?.rateLimits ?? []
      await update($, limits, () => toLimits(rateLimits))
      await alertOnRise($, rateLimits)
    } catch {
      // Keep the previous readings.
    }

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    stopBoot()
    stopFeed()

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits') && Array.isArray(e.rateLimits)) {
      await update($, limits, () => toLimits(e.rateLimits))
      await alertOnRise($, e.rateLimits)
    }

    return next(e)
  })

  on('command.run', { command: 'machine-voice' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()

    if (arg !== '' && arg !== 'on' && arg !== 'off') {
      return { text: 'Usage: /machine-voice [on|off]' }
    }

    const isOn = arg === '' ? !(await isVoiceOn($)) : arg === 'on'
    await $.store.set(VOICE_KEY, isOn)

    return { text: isOn ? 'MACHINE VOICE ONLINE' : 'MACHINE VOICE OFFLINE' }
  })

  on('command.run', { command: 'machine' }, async $ => ({ text: await machineStatus($) }))

  // The sign-off: the band shows the disconnect frame, then the exit goes
  // ahead. Ctrl+C and Ctrl+D exits don't run /exit, so they leave without
  // it. If the session is still here a moment after the exit returns or
  // the hold is aborted, it was cancelled or refused, so the band comes back.
  on('command.run', { command: 'exit' }, async ($, e, next) => {
    await update($, isDisconnected, () => true)

    try {
      await $.clock.sleep(SIGN_OFF_MS, { signal: next.signal })

      return await next(e)
    } finally {
      $.clock.after(RECONNECT_MS, () => void update($, isDisconnected, () => false))
    }
  })

  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)

    return (await isVoiceOn($)) ? { sections: [...result.sections, VOICE] } : result
  })

  on('prompt.submit', async ($, e, next) => {
    stopBoot()
    await update($, hasBooted, () => true)

    return next(e)
  })

  on('ui.render', { component: 'Spinner' }, ($, e, next) =>
    next({
      ...e,
      props: {
        ...e.props,
        word: SPINNER_WORDS[e.props.mode] ?? e.props.word.toUpperCase(),
        suffix: ' ▮',
      },
    }),
  )

  on('ui.render', { component: 'ToolUse' }, ($, e, next) => {
    const mark = classify(e.props.tool, e.props.input)

    if (mark === undefined) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const { isRunning, isErrored, isInterrupted } = e.props
    const state = isInterrupted ? (
      <Text color={FRAME}>INTERRUPTED</Text>
    ) : isErrored ? (
      <Text color={THREAT} bold>FAILED</Text>
    ) : isRunning ? (
      <Text color={MACHINE}>▮</Text>
    ) : undefined

    return (
      <Box flexDirection="row" gap={1}>
        <Text {...MARKS[mark]} bold> {mark} </Text>
        <Text color={MACHINE} bold>{e.props.tool}</Text>
        <Box flexShrink={1}>
          <Text color={FRAME} wrap="truncate-end">{summarize(e.props.tool, e.props.input)}</Text>
        </Box>
        {state}
      </Box>
    )
  })

  on('ui.render', { component: 'TurnDuration' }, ($, e) => {
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="row" gap={1} marginY={1}>
        <Text backgroundColor={MACHINE} color="#000000"> ANALYSIS COMPLETE: </Text>
        <Text color={MACHINE} bold>{formatDuration(e.props.durationMs)}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'UserMessage' }, ($, e, next) => {
    if (e.props.origin.kind !== 'composer') {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" borderStyle="bold" borderColor={FRAME} paddingX={1}>
        <Box flexDirection="row" gap={1}>
          <Text backgroundColor={ADMIN} color="#000000" bold> ADMIN </Text>
          <Text color={ADMIN}>VOICE INPUT // SPEECH TO TEXT</Text>
        </Box>
        <Text>{e.props.text}</Text>
      </Box>
    )
  })

  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => {
    if (!e.props.isFirstOfReply || e.props.isSummary) {
      return next(e)
    }

    const { Box, Text, Markdown } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1} marginY={1}>
          <Text color={MACHINE}>●</Text>
          <Text backgroundColor={MACHINE} color="#000000" bold> THE MACHINE </Text>
          <Text color={FRAME}>RESPONSE</Text>
        </Box>
        <Markdown text={e.props.text} />
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)

    if (await read($, isDisconnected)) {
      return (
        <Box flexDirection="column" borderStyle="round" borderColor={FRAME} paddingX={1}>
          <Box flexDirection="row" gap={1}>
            <Text color={FRAME}>○</Text>
            <Text color={MACHINE} bold>SYSTEM: STANDING BY</Text>
            <Text backgroundColor={ADMIN} color="#000000" bold> ADMIN DISCONNECTED </Text>
          </Box>
          <Text color={FRAME}>FEEDS SUSPENDED // GOODBYE, ADMIN</Text>
        </Box>
      )
    }

    const readings = await read($, limits)
    const isBooting = !(await read($, hasBooted))
    const now = await $.clock.now()
    const feed = await read($, feedId)
    await read($, feedTick)
    const hasFeed = feed !== '' && e.props.bodyColumns >= FEED_COLUMNS

    const threatRows =
      readings.length === 0 ? (
        <Box flexDirection="row" gap={1}>
          <Text backgroundColor={MACHINE} color="#000000"> THREAT LEVEL: </Text>
          <Text color={FRAME}>AWAITING TELEMETRY</Text>
        </Box>
      ) : (
        readings.map(limit => {
          const percent = Math.min(100, Math.round(limit.percentUsed))
          const filled = Math.round((percent / 100) * BAR_CELLS)
          const name = LIMIT_NAMES[limit.kind] ?? limit.kind.toUpperCase()
          const color = threatColor(percent)

          return (
            <Box key={limit.kind} flexDirection="row" gap={1}>
              <Text backgroundColor={MACHINE} color="#000000"> THREAT LEVEL // {name.padEnd(7)}</Text>
              <Text>
                <Text color={color}>{'█'.repeat(filled)}</Text>
                <Text color={FRAME}>{'░'.repeat(BAR_CELLS - filled)}</Text>
              </Text>
              <Text color={color} bold>
                {String(percent).padStart(3)}% {threatLabel(percent).padEnd(8)}
              </Text>
              <Text color={FRAME}>{formatResetIn(limit.resetsAt, now)}</Text>
            </Box>
          )
        })
      )

    const statusRow = (
      <Box flexDirection="row" gap={1}>
        <Text color={MACHINE}>●</Text>
        <Text color={MACHINE} bold>SYSTEM: ONLINE</Text>
        <Text backgroundColor={ADMIN} color="#000000" bold> ADMIN </Text>
        <Text color={ADMIN}>CONNECTED</Text>
        <Text backgroundColor={MACHINE} color="#000000"> STATUS: </Text>
        <Text color={MACHINE} bold={e.props.isWorking}>
          {e.props.isWorking ? 'ANALYZING' : 'AWAITING INPUT'}
        </Text>
        {hasFeed ? (
          <Text color={FRAME}>
            {'  '}FEED {feed} // {formatFeedTime(now)}
          </Text>
        ) : undefined}
      </Box>
    )

    if (isBooting) {
      const frame = await read($, bootFrame)
      const hasBinaryRoom = e.props.bodyColumns >= BINARY[0]!.length + 4
      const threatCount = Math.max(1, readings.length)
      // The screen: the border, the binary and its gap, the log and its gap,
      // the load bar (the complete line once done), a gap, the question, a
      // gap and the status rows. Without room for them, the log's gap goes
      // first, then the binary or the log and bar are left out.
      const binaryRows = hasBinaryRoom ? BINARY.length + 1 : 0
      const logRoom = e.props.maxRows - (2 + binaryRows + BOOT_LOG.length + 1 + 2 + 2 + threatCount)
      const hasLogRoom = logRoom >= 0
      const hasLogGapRoom = logRoom >= 1
      // Rows not drawn yet are blank, so the band keeps its height and the
      // prompt doesn't jump while the screen boots.
      const blank = (key: string) => <Text key={key}> </Text>

      const logRows = BOOT_LOG.map((label, i) => {
        const shownAt = LOG_START + i * LOG_FRAMES_PER_LINE
        const doneAt = shownAt + LOG_FRAMES_PER_LINE - 1

        if (frame < shownAt) {
          return blank(`log-${i}`)
        }

        return (
          <Text key={`log-${i}`}>
            <Text color={FRAME}>{'> '}{`${label} `.padEnd(32, '.')}</Text>
            {frame >= doneAt ? (
              <Text color={MACHINE} bold> OK</Text>
            ) : (
              <Text color={MACHINE}> ▮</Text>
            )}
          </Text>
        )
      })

      const loaded = Math.min(1, Math.max(0, (frame - LOG_START) / (LOG_END - LOG_START)))
      const loadedCells = Math.round(loaded * BAR_CELLS)
      const loadRow =
        frame < LOG_START ? (
          blank('load')
        ) : (
          <Text key="load">
            <Text color={FRAME}>{'> LOADING '}</Text>
            <Text color={MACHINE}>{'█'.repeat(loadedCells)}</Text>
            <Text color={FRAME}>{'░'.repeat(BAR_CELLS - loadedCells)}</Text>
            <Text color={MACHINE} bold> {String(Math.round(loaded * 100)).padStart(3)}%</Text>
          </Text>
        )

      const typed = QUESTION.slice(0, Math.max(0, frame - QUESTION_START))
      // The cursor's cell is a space until the question starts, so the empty
      // row keeps its height and the band doesn't jump.
      const isCursorOn = frame < BOOT_END || (frame - BOOT_END) % 2 === 0

      return (
        <Box flexDirection="column" borderStyle="round" borderColor={MACHINE} paddingX={1}>
          {hasBinaryRoom ? (
            <Box flexDirection="column" marginBottom={1}>
              {scanBinary(frame).map((line, i) => (
                <Text key={`binary-${i}`} color={frame - LEAD_IN_FRAMES >= BINARY_FRAMES ? MACHINE : FRAME}>
                  {line}
                </Text>
              ))}
            </Box>
          ) : undefined}
          {hasLogRoom ? logRows : undefined}
          {hasLogGapRoom ? blank('log-gap') : undefined}
          {hasLogRoom && frame < COMPLETE_AT ? (
            loadRow
          ) : frame >= COMPLETE_AT ? (
            <Text color={FRAME}>BOOT SEQUENCE COMPLETE // ALL FEEDS NOMINAL</Text>
          ) : (
            blank('complete')
          )}
          <Box marginTop={1}>
            <Text>
              <Text color={ADMIN} bold>{typed}</Text>
              <Text color={ADMIN}>{frame >= QUESTION_START && isCursorOn ? '▮' : ' '}</Text>
            </Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            {statusRow}
            {threatRows}
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" borderStyle="round" borderColor={MACHINE} paddingX={1}>
        {statusRow}
        {threatRows}
      </Box>
    )
  })
}
