# The Machine

[![ACR B4d](https://img.shields.io/badge/ACR-B4d-2140B5)](ACR.md)

A mod for [Claude Code](https://claude.com/claude-code) that restyles it as The Machine from *Person of Interest*. This repository is a Claude Code plugin marketplace called `ccmod-the-machine`, with the mod `the-machine` at its root.

Your prompts come in as the Admin's voice, replies come back from the Machine, tool calls are marked the way the Machine marks people, and the threat level is your real usage limit.

See it in action, including the animated boot screen: [greg.ca/the-machine](https://greg.ca/the-machine/)

- **Boot screen:** until your first prompt, the band above the prompt plays the Machine's reboot from *Person of Interest*. Four lines of binary settle out of flicker (they spell *Quis custodiet ipsos custodes*, as at the end of the Machine's reboot in "Zero Day"), a boot log ticks to `OK` over a load bar, then `BOOT SEQUENCE COMPLETE // ALL FEEDS NOMINAL` and a typed `CAN YOU HEAR ME?`.
- **Admin voice:** your prompts sit in a gray frame tagged `ADMIN // VOICE INPUT // SPEECH TO TEXT`.
- **Machine response:** each reply opens with `● THE MACHINE RESPONSE`, and each turn closes with `ANALYSIS COMPLETE:` and the time taken.
- **Machine voice:** each reply starts with a `◤ … ◢` header and a one-line verdict in capitals, then reads as normal. This adds a short instruction to the system prompt. Turn it off with `/machine-voice off`, and back on with `/machine-voice on`.
- **Status row:** the band above the prompt shows `SYSTEM: ONLINE`, your yellow `ADMIN` tag, whether the Machine is analyzing or awaiting input, and a feed readout like the Machine's own screens: a camera number for the project folder and the time, ticking each second. The readout needs a terminal at least 90 columns wide.
- **Colours, as in the Machine's view:** yellow is the Admin, white is what the Machine watches, and red only marks a threat.
- **Tool marks:** tools that only look (Read, Grep, Glob, WebFetch, WebSearch) are `IRRELEVANT`, tools that act (Bash, Edit, Write, NotebookEdit) are yellow `ASSET`s, and a risky shell command such as `sudo`, `rm -rf`, `git push --force`, or `git reset --hard` is a red `THREAT`.
- **Threat level:** one bar per usage window (5-hour session and 7-day weekly), read live, rated LOW, ELEVATED, HIGH, or CRITICAL. A bar turns red at HIGH (60%) and up. A toast alerts once when a window first reaches HIGH (60%) or CRITICAL (85%).
- **Status report:** `/machine` shows the mod and Claude Code versions, the Admin's connection, whether Machine voice is on, and the threat level and reset time for each usage window.
- **Sign-off:** on `/exit`, the band shows `ADMIN DISCONNECTED` for two seconds before Claude Code closes.
- **Spinner words:** ACCESSING FEEDS, CALCULATING PROBABILITIES, COMPILING, EXECUTING, and TRANSMITTING.

The boot log needs a terminal tall enough to hold it (about 50 rows). In a shorter one the boot screen skips the log and shows the binary, the complete line, and the question.

## Install

At the Claude Code prompt, in a terminal session:

```
/plugin install the-machine --marketplace gregdotca/ccmod-the-machine
```

Answer `y` to add the `ccmod-the-machine` marketplace, then pick a scope (user scope loads it in every session). If the install summary says to run `/reload-plugins`, run it, or start a new session, to load the mod.

From a shell instead:

```
claude plugin marketplace add gregdotca/ccmod-the-machine
claude plugin install the-machine@ccmod-the-machine --scope user
```

The mod loads the next time you start Claude Code.

## Update

Claude Code keeps its own copy of an installed mod, so pull the latest version with:

```
claude plugin marketplace update ccmod-the-machine
claude plugin update the-machine@ccmod-the-machine
```

Then restart Claude Code. [`CHANGELOG.md`](CHANGELOG.md) lists what changed in each version.

## Uninstall

```
claude plugin uninstall the-machine@ccmod-the-machine
```

## Developing

The mod is a hooks module (`hooks/register.tsx`) with a manifest (`.claude-plugin/plugin.json`), types (`types/index.d.ts`), and tests (`tests/`). From the repository root:

```
claude plugin validate .
claude plugin test .
```

To try a change without installing it, start a session with the mod loaded from this folder:

```
claude --plugin-dir .
```

## Privacy

The mod keeps no personal data and makes no network requests. [`PRIVACY.md`](PRIVACY.md) lists what it reads and the two settings it stores.

## License

[MIT](LICENSE)

*Person of Interest* was created by Jonathan Nolan and produced by Kilter Films, Bad Robot, and Warner Bros. Television for CBS. This is a fan project, not affiliated with or endorsed by any of them.
