---
rating: B4d
spec: "0.1"
updated: 2026-10-09
---

# AI Code Rating

**ACR B4d** (Maintainer: Experienced · AI Share: 76–100% · Oversight: Tested Only)

This project is rated with [AI Code Rating](https://aicoderating.com/spec/0.1/), spec version 0.1.

## How AI Was Used

This mod is written by Claude Code, which wrote all of the code, the tests, and the docs, including the README and the changelog. Greg Chetcuti decides what the mod should do and how it should look, and directs every change, but doesn't read the AI's code before it's kept. Instead, each change is checked by running it: the mod's automated tests (`claude plugin test`) run after every change, and Greg restarts Claude Code and tries the result himself before signing off on it.

For screen changes that the tests can't see, such as the boot animation, Claude Code also recorded a real Claude Code session in a virtual terminal and replayed it frame by frame to confirm what's on screen. That check caught a bug the tests had missed.

Codex also reviewed the whole repository for bugs before the first public release, in several rounds, with each round's findings fixed or checked and rejected before the next. It's an AI review, so it doesn't change the oversight level.
