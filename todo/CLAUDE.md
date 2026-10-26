# todo

Single-page todo app.
- Ticket #3 (issue #4): create a task, mark it done, delete it.
- Ticket #4 (issue #5): filter by status (all / active / completed), optional due date, tags with a tag filter.

## Stack

- Plain HTML, CSS and JavaScript, with no build step and no dependencies.
- Storage is IndexedDB: database `todo-app`, store `tasks`, with auto-increment key `id`.
- A task is `{ id, title, done, createdAt, dueDate, tags }`.
  - `dueDate` is `"YYYY-MM-DD"` or `null`. Parse it as a local date, not with `new Date(str)`, which reads it as UTC.
  - `tags` is lowercase, deduplicated, and has no leading `#`.
  - Tasks saved before Ticket #4 have no `dueDate` or `tags`; `db.js` `normalize()` fills in defaults when loading, so the DB version stays 1.
- Filters (status, plus at most one tag) live only in memory, so a reload resets them.
- Data stays in the browser, per origin. A `file://` page and a page on a local server have separate data.

## Files

| File | Role |
|------|------|
| `index.html` | Markup; loads `db.js` then `app.js` as classic scripts so `file://` works |
| `db.js` | `window.TodoDB`: `all()`, `add(title, { dueDate, tags })`, `update(task)`, `remove(id)` |
| `app.js` | Renders the list, applies the filters, and wires up add, toggle, delete and tag clicks |
| `styles.css` | Styles with light and dark themes |

## Run

Open `index.html` in a browser, or serve the folder with `python -m http.server` and open it.

## Conventions

- Render user text with `textContent`, never `innerHTML`.
- Persistence goes through `TodoDB` only; `app.js` never touches IndexedDB directly.
