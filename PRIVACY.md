# Privacy

The Machine keeps no personal data and makes no network requests. Apart from the Machine voice instruction described below, everything it does happens inside Claude Code on your computer. Some of what it reads, such as a shell command or a file path, can contain personal information, so this page lists all of it.

## What it reads

- **Usage limits:** each usage limit's kind (such as the 5-hour session or 7-day weekly window), percentage used, and reset time, from Claude Code, to show the threat level and raise its alerts.
- **Your prompts and Claude's replies:** the text of each, to draw it inside the Admin and Machine frames. The mod only displays the text and doesn't store it.
- **Tool calls:** Claude Code passes the mod every tool call. It reads the name of each one, and the main argument of these tools only: the command for Bash, the file path for Read, Edit, Write, and NotebookEdit, the pattern for Grep and Glob, the URL for WebFetch, and the query for WebSearch. The mod uses them to mark the call `IRRELEVANT`, `ASSET`, or `THREAT`, and shows the argument's first line beside the mark. It doesn't store them.
- **Project folder:** its path, turned into the four-digit camera number on the status row. The path itself isn't shown or kept.
- **Versions:** the mod's own version and Claude Code's, for the `/machine` status report.

## What it stores

Two settings, in Claude Code's local storage for the mod:

- whether Machine voice is on or off
- the highest threat level already alerted for each usage window, with that window's reset time, so a new session doesn't repeat an alert

Everything else lasts only for the session.

## Machine voice

When Machine voice is on, the mod adds a short style instruction to Claude's system prompt. It tells Claude how to open each reply and nothing else. The instruction travels to Anthropic with the rest of the system prompt, as part of your normal Claude Code session. Turn it off with `/machine-voice off`.

## Contact

Questions about this policy: open an issue at https://github.com/gregdotca/ccmod-the-machine/issues.
