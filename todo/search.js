// Live search for the task list: pure functions, no DOM or storage.
// Exposed as window.Search in the browser, and as module.exports under Node for tests.
(function (root) {
  // Case-insensitive substring match on the title or any tag. A query starting
  // with "#" searches tags only. Plain String#includes, so characters like
  // ( [ . * < > match literally: no regex, no HTML.
  function matchesSearch(task, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    const tags = task.tags || []; // stored lowercase by the app
    if (q.startsWith("#")) {
      const tq = q.replace(/^#+/, "");
      return !tq || tags.some((t) => t.includes(tq));
    }
    return String(task.title || "").toLowerCase().includes(q) || tags.some((t) => t.includes(q));
  }

  const api = { matchesSearch };
  root.Search = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
