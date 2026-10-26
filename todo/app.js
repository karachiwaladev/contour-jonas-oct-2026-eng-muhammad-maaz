// UI for the todo app. All persistence goes through window.TodoDB (db.js).
(function () {
  const form = document.getElementById("new-task-form");
  const input = document.getElementById("new-task-title");
  const list = document.getElementById("task-list");
  const empty = document.getElementById("empty-state");
  const counter = document.getElementById("counter");
  const errorBox = document.getElementById("error");

  let tasks = [];

  function showError(err) {
    errorBox.textContent = "Something went wrong: " + (err && err.message ? err.message : err);
    errorBox.hidden = false;
  }

  function render() {
    list.replaceChildren(...tasks.map(renderTask));
    empty.hidden = tasks.length > 0;
    const left = tasks.filter((t) => !t.done).length;
    counter.textContent = tasks.length
      ? `${left} of ${tasks.length} task${tasks.length === 1 ? "" : "s"} left`
      : "";
  }

  function renderTask(task) {
    const li = document.createElement("li");
    li.className = "task" + (task.done ? " done" : "");
    li.dataset.id = task.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `task-${task.id}`;
    checkbox.checked = task.done;
    checkbox.addEventListener("change", () => toggle(task));

    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.textContent = task.title; // textContent, never innerHTML: titles are user input

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete";
    del.textContent = "Delete";
    del.setAttribute("aria-label", `Delete "${task.title}"`);
    del.addEventListener("click", () => remove(task));

    li.append(checkbox, label, del);
    return li;
  }

  async function add(title) {
    const task = await TodoDB.add(title);
    tasks.push(task);
    render();
  }

  async function toggle(task) {
    const updated = { ...task, done: !task.done };
    await TodoDB.update(updated);
    tasks = tasks.map((t) => (t.id === task.id ? updated : t));
    render();
  }

  async function remove(task) {
    await TodoDB.remove(task.id);
    tasks = tasks.filter((t) => t.id !== task.id);
    render();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = input.value.trim();
    if (!title) {
      input.focus();
      return;
    }
    add(title)
      .then(() => {
        input.value = "";
        input.focus();
      })
      .catch(showError);
  });

  // Surface failures from toggle/delete too, without wrapping every handler.
  window.addEventListener("unhandledrejection", (e) => showError(e.reason));

  TodoDB.all()
    .then((stored) => {
      tasks = stored;
      render();
    })
    .catch(showError);
})();
