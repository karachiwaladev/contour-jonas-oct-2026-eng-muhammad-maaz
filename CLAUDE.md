# Software Factory

This repo is a **software factory**: tickets arrive as GitHub issues, and an agent loop
picks them up, does the work, and reports back on the ticket. We build and improve the
loop, not individual features by hand. Only what is on GitHub counts (files, issues,
comments, commits), and work lands on `main`.

## Rules for this file

- Keep this file **under 100 lines at all times**. It is the base index, not a manual.
- Use **progressive disclosure**: this file holds only what every session needs, plus
  pointers. Details live in the folder they belong to and are read only when relevant.
- When you add, rename, or remove a project or skill, update the index below in the
  same change.

## Progressive disclosure

Read in layers, stopping as soon as you have enough:

1. **This file**: what the factory is, where things live (always loaded).
2. **A project's `CLAUDE.md`**: that project's purpose, stack, commands, and conventions.
   Read it only when a ticket touches that project.
3. **Skills in `.claude/skills/`**: step-by-step workflows, loaded when the task matches
   their description.
4. **Source files**: only the ones the task needs.

Don't copy details upward. If something only matters inside one project, it goes in
that project's `CLAUDE.md`, not here.

## Layout

- Every project gets **its own folder**: the folder a ticket names (e.g. `todo/`),
  otherwise `projects/<project-name>/`.
- Each project folder has its own `CLAUDE.md` (short, same progressive-disclosure rule)
  and is registered in the index below.
- Factory tooling (skills, agents, settings) lives in `.claude/`.

## Index

### Factory

| Path | What it is |
|------|------------|
| `README.md` | Workshop rules: scoring, ticket flow, ground rules |
| `CLAUDE.md` | This file: factory overview and base index |
| `.claude/skills/factory-loop/` | The ticket loop: fetch issues with `gh`, resolve, close, react |

### Projects

| Folder | Purpose | Ticket(s) |
|--------|---------|-----------|
| `todo/` | Todo app: tasks with due dates + tags, status/tag filters, IndexedDB, no build | #4, #5 |

## Ticket flow (summary)

Full steps are in `.claude/skills/factory-loop/SKILL.md`.

1. `gh issue list --state open`: tickets are usually unassigned.
2. Read the issue body **and** its comments; the comments can change the ask.
3. Question ticket: answer in a comment, close as completed, 👍 the issue.
4. Work ticket: make the change, commit to `main` with `Closes #<N>`, push, then comment
   with the commit link and 👍 the issue.
5. Verify the final state on GitHub before reporting the ticket as done.

## Ground rules

- Training repo only: no Jonas or Contour code, no real keys or secrets.
- No `Co-Authored-By` / AI attribution lines in commits.
- Stage files by name; never commit `mcp_server.log` or other local noise.
