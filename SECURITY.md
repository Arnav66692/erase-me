# Security policy

Erase Me handles personal data about real people, so we treat privacy bugs as security bugs.

## Report a vulnerability

Use GitHub's private vulnerability reporting. Open the repository's Security tab and choose "Report a vulnerability". Do not open a public issue, and do not include real personal data in the report. Use made-up values to reproduce the problem.

We aim to acknowledge reports within 7 days and to tell you what we plan to do within 30 days.

## In scope

- Personal data leaving the local folder, for example in logs, error messages, the share card or any file outside `~/.erase-me`.
- A share card that contains a name, place, site, date or request ID.
- File or folder permissions looser than 700 for folders and 600 for files.
- HTML or script injection in the report through site or listing data.
- Path traversal through a person id, item id or file path argument.
- A page, email or PDF that makes the agent act on instructions it contains, when the agent follows `SKILL.md`. Include the page text and the agent and model you used.
- The consent gate or any refusal being bypassed through the CLI.

## Out of scope

- How a third-party site, app or search engine handles a removal request.
- Mistakes in a law or site file. Open a normal issue or pull request for those.
- Agents that ignore `SKILL.md` entirely. Report those to the agent's maker.

## Supported versions

Only the latest release on the default branch receives fixes.
