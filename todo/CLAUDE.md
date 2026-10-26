# todo

Single-page todo app from Ticket #3 (issue #4). Create a task, mark it done, delete it.

## Stack

- Plain HTML, CSS and JavaScript, with no build step and no dependencies.
- Storage is IndexedDB: database `todo-app`, store `tasks`, with auto-increment key `id`.
- A task is `{ id, title, done, createdAt }`.
- Data stays in the browser, per origin. A `file://` page and a page on a local server have separate data.

## Files

| File | Role |
|------|------|
| `index.html` | Markup; loads `db.js` then `app.js` as classic scripts so `file://` works |
| `db.js` | `window.TodoDB`: `all()`, `add(title)`, `update(task)`, `remove(id)` |
| `app.js` | Renders the list and wires up add, toggle and delete |
| `styles.css` | Styles with light and dark themes |

## Run

Open `index.html` in a browser, or serve the folder with `python -m http.server` and open it.

## Conventions

- Render user text with `textContent`, never `innerHTML`.
- Persistence goes through `TodoDB` only; `app.js` never touches IndexedDB directly.
