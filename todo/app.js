// UI for the todo app. All persistence goes through window.TodoDB (db.js).
(function () {
  const form = document.getElementById("new-task-form");
  const input = document.getElementById("new-task-title");
  const dueInput = document.getElementById("new-task-due");
  const tagsInput = document.getElementById("new-task-tags");
  const list = document.getElementById("task-list");
  const empty = document.getElementById("empty-state");
  const counter = document.getElementById("counter");
  const errorBox = document.getElementById("error");
  const statusButtons = document.querySelectorAll(".status-filter button");
  const tagSelect = document.getElementById("tag-filter");

  let tasks = [];
  const filters = { status: "all", tag: "" };

  function showError(err) {
    errorBox.textContent = "Something went wrong: " + (err && err.message ? err.message : err);
    errorBox.hidden = false;
  }

  // "work, Home, #home ,," -> ["work", "home"]
  function parseTags(text) {
    const tags = text
      .split(",")
      .map((t) => t.trim().replace(/^#+/, "").toLowerCase())
      .filter(Boolean);
    return [...new Set(tags)].slice(0, 10);
  }

  // Parse "YYYY-MM-DD" as a local date (new Date("YYYY-MM-DD") would be UTC midnight).
  function localDate(ymd) {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function startOfToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function dueInfo(task) {
    if (!task.dueDate) return null;
    const due = localDate(task.dueDate);
    const today = startOfToday();
    const days = Math.round((due - today) / 86400000);
    const sameYear = due.getFullYear() === today.getFullYear();
    let text = due.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
    });
    if (days === 0) text = "Today";
    else if (days === 1) text = "Tomorrow";
    return { text: "Due " + text, overdue: !task.done && days < 0, today: !task.done && days === 0 };
  }

  function allTags() {
    return [...new Set(tasks.flatMap((t) => t.tags))].sort();
  }

  function matches(task) {
    if (filters.status === "active" && task.done) return false;
    if (filters.status === "completed" && !task.done) return false;
    if (filters.tag && !task.tags.includes(filters.tag)) return false;
    return true;
  }

  function renderTagOptions() {
    const tags = allTags();
    // A deleted task can take the last use of the selected tag with it.
    if (filters.tag && !tags.includes(filters.tag)) filters.tag = "";
    const options = [new Option("All tags", "")].concat(tags.map((t) => new Option("#" + t, t)));
    tagSelect.replaceChildren(...options);
    tagSelect.value = filters.tag;
    tagSelect.disabled = tags.length === 0;
  }

  function renderStatusButtons() {
    statusButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.status === filters.status)));
  }

  function render() {
    renderTagOptions();
    renderStatusButtons();

    const visible = tasks.filter(matches);
    list.replaceChildren(...visible.map(renderTask));

    empty.hidden = visible.length > 0;
    empty.textContent = tasks.length ? "No tasks match these filters." : "No tasks yet. Add one above.";

    const left = tasks.filter((t) => !t.done).length;
    const filtered = visible.length !== tasks.length;
    counter.textContent = tasks.length
      ? `${left} of ${tasks.length} task${tasks.length === 1 ? "" : "s"} left` +
        (filtered ? ` · showing ${visible.length}` : "")
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

    const body = document.createElement("div");
    body.className = "task-body";

    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.textContent = task.title; // textContent, never innerHTML: titles are user input
    body.append(label);

    const due = dueInfo(task);
    if (due || task.tags.length) {
      const meta = document.createElement("div");
      meta.className = "task-meta";
      if (due) {
        const badge = document.createElement("span");
        badge.className = "due" + (due.overdue ? " overdue" : "") + (due.today ? " today" : "");
        badge.textContent = due.overdue ? due.text + " · overdue" : due.text;
        meta.append(badge);
      }
      for (const tag of task.tags) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "tag";
        chip.textContent = "#" + tag;
        chip.title = `Show only #${tag}`;
        chip.addEventListener("click", () => setTagFilter(tag));
        meta.append(chip);
      }
      body.append(meta);
    }

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete";
    del.textContent = "Delete";
    del.setAttribute("aria-label", `Delete "${task.title}"`);
    del.addEventListener("click", () => remove(task));

    li.append(checkbox, body, del);
    return li;
  }

  function setTagFilter(tag) {
    filters.tag = tag;
    render();
  }

  async function add(title, options) {
    const task = await TodoDB.add(title, options);
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
    add(title, { dueDate: dueInput.value || null, tags: parseTags(tagsInput.value) })
      .then(() => {
        form.reset();
        input.focus();
      })
      .catch(showError);
  });

  statusButtons.forEach((b) =>
    b.addEventListener("click", () => {
      filters.status = b.dataset.status;
      render();
    })
  );

  tagSelect.addEventListener("change", () => setTagFilter(tagSelect.value));

  // Surface failures from toggle/delete too, without wrapping every handler.
  window.addEventListener("unhandledrejection", (e) => showError(e.reason));

  TodoDB.all()
    .then((stored) => {
      tasks = stored;
      render();
    })
    .catch(showError);
})();
