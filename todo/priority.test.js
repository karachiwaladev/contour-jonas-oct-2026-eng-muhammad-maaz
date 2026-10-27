// Run with: node todo/priority.test.js
const P = require("./priority.js");

const t = (id, priority, dueDate, createdAt) => ({ id, priority, dueDate, createdAt });
const tasks = [
  t("a", null, "2026-11-01", 1),
  t("b", "low", null, 2),
  t("c", "high", "2026-11-05", 3),
  t("d", "medium", "2026-10-30", 4),
  t("e", "high", "2026-10-28", 5),
  t("f", null, null, 6),
  t("g", "high", null, 7),
  t("h", "medium", "2026-10-30", 8),
];
const ids = (list) => list.map((x) => x.id).join("");

const cases = [
  [ids(P.sortTasks(tasks, "created")), "abcdefgh", "created: insertion order"],
  [ids(P.sortTasks(tasks, "priority")), "ecgdhbaf", "priority: high > medium > low > none, then due (no date last), then created"],
  [ids(P.sortTasks(tasks, "due")), "edhacbfg", "due: soonest first, no date last, ties by created"],
  [ids(P.sortTasks(tasks, "bogus")), "abcdefgh", "unknown mode falls back to created"],
  [ids(tasks), "abcdefgh", "sortTasks does not mutate its input"],
  [String(P.isPriority("high") && P.isPriority("low") && !P.isPriority("urgent") && !P.isPriority(null)), "true", "isPriority"],
  [String(P.rank(undefined)), "3", "missing priority ranks after low"],
];

let failed = 0;
for (const [got, want, name] of cases) {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${got}${ok ? "" : ` (want ${want})`}`);
}
console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
