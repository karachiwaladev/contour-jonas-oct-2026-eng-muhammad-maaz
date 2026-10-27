# todo

Single-page todo app.
- Ticket #3 (issue #4): create a task, mark it done, delete it.
- Ticket #4 (issue #5): filter by status (all / active / completed), optional due date, tags with a tag filter.
- Ticket #5 (issue #7): recurring tasks (daily / weekdays / weekly / monthly) that roll forward when ticked.
- Ticket #6 (issue #10): priority (high / medium / low / none) with a filter and sort, plus inline editing of title, due date, tags and priority.
- Ticket #10 (issue #16): live search by title and tag, combined with the other filters.

## Stack

- Plain HTML, CSS and JavaScript, with no build step and no dependencies.
- Storage is IndexedDB: database `todo-app`, store `tasks`, with auto-increment key `id`.
- A task is `{ id, title, done, createdAt, dueDate, tags, repeat, anchorDay, priority }`.
  - `priority` is `null`, `"high"`, `"medium"` or `"low"`. A recurring task's next copy keeps it.
  - `repeat` is `null`, `"daily"`, `"weekdays"`, `"weekly"` or `"monthly"`.
  - `anchorDay` is a monthly task's original day of the month, so the 31st clamps to the month's end and comes back.
  - Ticking a repeating task keeps it as a completed copy with `repeat` cleared, and adds the next copy in one transaction (`TodoDB.completeRecurring`).
  - The next copy is due on a strict schedule: exactly one interval after the previous due date, even if that's still overdue.
  - `dueDate` is `"YYYY-MM-DD"` or `null`. Parse it as a local date, not with `new Date(str)`, which reads it as UTC.
  - `tags` is lowercase, deduplicated, and has no leading `#`.
  - Tasks saved by older versions lack `dueDate`, `tags`, `repeat`, `anchorDay` or `priority`; `db.js` `normalize()` fills in defaults when loading, so the DB version stays 1.
- Filters (status, at most one tag, priority, search) and the sort (created / priority / due) live only in memory, so a reload resets them.
- Search is a case-insensitive substring match on the title or a tag (`#x` searches tags only). It's literal: no regex or HTML. Esc or ✕ clears it.
- Inline edit works on one task at a time. A draft keeps the typed values across re-renders until Save or Cancel (Esc). Editing a monthly task's due date moves its `anchorDay`.
- Data stays in the browser, per origin. A `file://` page and a page on a local server have separate data.

## Files

| File | Role |
|------|------|
| `index.html` | Markup; loads `db.js` then `app.js` as classic scripts so `file://` works |
| `recurrence.js` | `window.Recurrence`: `nextDue(dueDate, repeat, anchorDay)` and the labels; pure date math |
| `recurrence.test.js` | `node todo/recurrence.test.js` checks the date rules |
| `priority.js` | `window.Priority`: levels, labels, `sortTasks(tasks, mode)`; pure functions |
| `priority.test.js` | `node todo/priority.test.js` checks the sort orders |
| `search.js` | `window.Search`: `matchesSearch(task, query)`; pure function |
| `search.test.js` | `node todo/search.test.js` checks the matching rules |
| `db.js` | `window.TodoDB`: `all()`, `add(title, { dueDate, tags, repeat, anchorDay, priority })`, `update(task)`, `remove(id)`, `completeRecurring(doneTask, next)` |
| `app.js` | Renders the list, applies the filters and sort, and wires up add, toggle, delete, inline edit and tag clicks |
| `styles.css` | Styles with light and dark themes |

## Run

Open `index.html` in a browser, or serve the folder with `python -m http.server` and open it.

## Conventions

- Render user text with `textContent`, never `innerHTML`.
- Persistence goes through `TodoDB` only; `app.js` never touches IndexedDB directly.
