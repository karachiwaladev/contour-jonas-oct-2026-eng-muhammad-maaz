// Thin promise wrapper around IndexedDB: one database, one "tasks" store.
// A task is { id, title, done, createdAt, dueDate, tags }, where dueDate is
// "YYYY-MM-DD" or null and tags is an array of lowercase strings. Exposed as
// window.TodoDB so the app works from file:// without a module loader or build step.
(function () {
  const DB_NAME = "todo-app";
  const DB_VERSION = 1;
  const STORE = "tasks";

  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB is not available in this browser."));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  // Run fn against the store inside a transaction; resolve with the request's result.
  async function withStore(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // Tasks saved before due dates and tags existed lack those fields; default them.
  function normalize(task) {
    return { dueDate: null, tags: [], ...task };
  }

  window.TodoDB = {
    all() {
      return withStore("readonly", (s) => s.getAll()).then((tasks) =>
        tasks.map(normalize).sort((a, b) => a.createdAt - b.createdAt)
      );
    },
    add(title, { dueDate = null, tags = [] } = {}) {
      const task = { title, done: false, createdAt: Date.now(), dueDate, tags };
      return withStore("readwrite", (s) => s.add(task)).then((id) => ({ ...task, id }));
    },
    update(task) {
      return withStore("readwrite", (s) => s.put(task)).then(() => task);
    },
    remove(id) {
      return withStore("readwrite", (s) => s.delete(id));
    },
  };
})();
