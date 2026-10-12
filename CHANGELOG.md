# Changelog

All notable changes to the-machine.

## the-machine 1.0.3 (2026-10-11)

- Changed: the boot screen has a blank row between the boot log and the load bar, so the `BOOT SEQUENCE COMPLETE` line stands apart. The row is dropped when the terminal is one row short, so the boot log still shows

## the-machine 1.0.2 (2026-10-10)

- Added: a privacy policy, `PRIVACY.md`, linked from the plugin manifest and the README
- Added: a plugin icon for Anthropic's plugin directory

## the-machine 1.0.1 (2026-10-10)

- Added: a display name, homepage, repository, and license to the plugin manifest, ready for Anthropic's plugin directory

## the-machine 1.0.0 (2026-10-10)

First public release.

- Added: a boot screen that plays the Machine's reboot from *Person of Interest* until the first prompt: four lines of binary spelling *Quis custodiet ipsos custodes*, a boot log over a load bar, then `BOOT SEQUENCE COMPLETE // ALL FEEDS NOMINAL` and a typed `CAN YOU HEAR ME?`. In a terminal under about 50 rows, the boot log is skipped
- Added: prompts framed as `ADMIN // VOICE INPUT // SPEECH TO TEXT`, replies opening with `● THE MACHINE RESPONSE`, and each turn closing with `ANALYSIS COMPLETE:` and the time taken
- Added: Machine voice, a `◤ … ◢` header and a one-line verdict in capitals at the start of each reply, toggled with `/machine-voice [on|off]`
- Added: a status row above the prompt with `SYSTEM: ONLINE`, a yellow `ADMIN` tag, the Machine's state, and a feed readout (camera number for the project folder and the time) in terminals 90 columns wide and up
- Added: tool marks: `IRRELEVANT` for tools that only look, yellow `ASSET` for tools that act, and red `THREAT` for risky shell commands, checked across every line of a multi-line command
- Added: a threat level for each usage window (5-hour and 7-day), rated LOW to CRITICAL, with a toast when a window first reaches HIGH (60%) or CRITICAL (85%)
- Added: `/machine`, a status report with the mod and Claude Code versions, the Admin's connection, Machine voice, and each usage window's threat level and reset time
- Added: an `ADMIN DISCONNECTED` sign-off in the band for two seconds on `/exit`
- Added: Machine spinner words: ACCESSING FEEDS, CALCULATING PROBABILITIES, COMPILING, EXECUTING, and TRANSMITTING
