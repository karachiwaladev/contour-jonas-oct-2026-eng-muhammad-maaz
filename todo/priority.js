// Task priority levels and list ordering: pure functions, no DOM or storage.
// Exposed as window.Priority in the browser, and as module.exports under Node for tests.
(function (root) {
  const LABELS = { high: "High", medium: "Medium", low: "Low" };
  const RANK = { high: 0, medium: 1, low: 2 }; // no priority sorts after low

  const rank = (p) => (Object.hasOwn(RANK, p) ? RANK[p] : 3);
  const byCreated = (a, b) => a.createdAt - b.createdAt;
  // Soonest due first; tasks without a due date go last. "YYYY-MM-DD" sorts as text.
  const byDue = (a, b) => {
    if (a.dueDate === b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  };

  const SORTS = {
    created: byCreated,
    priority: (a, b) => rank(a.priority) - rank(b.priority) || byDue(a, b) || byCreated(a, b),
    due: (a, b) => byDue(a, b) || byCreated(a, b),
  };

  function sortTasks(tasks, mode) {
    return [...tasks].sort(SORTS[mode] || byCreated);
  }

  const api = { LABELS, isPriority: (p) => Object.hasOwn(LABELS, p), rank, sortTasks };
  root.Priority = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
