// Run with: node todo/recurrence.test.js
const R = require("./recurrence.js");

const cases = [
  ["2026-10-26", "daily", undefined, "2026-10-27", "daily"],
  ["2026-12-31", "daily", undefined, "2027-01-01", "daily year rollover"],
  ["2026-03-28", "daily", undefined, "2026-03-29", "daily across EU DST change"],
  ["2026-10-23", "daily", undefined, "2026-10-24", "strict: overdue stays on schedule"],
  ["2026-10-30", "weekdays", undefined, "2026-11-02", "weekdays Fri -> Mon"],
  ["2026-10-31", "weekdays", undefined, "2026-11-02", "weekdays Sat -> Mon"],
  ["2026-10-27", "weekdays", undefined, "2026-10-28", "weekdays Tue -> Wed"],
  ["2026-10-26", "weekly", undefined, "2026-11-02", "weekly"],
  ["2026-01-31", "monthly", 31, "2026-02-28", "monthly 31st clamps to Feb 28"],
  ["2026-02-28", "monthly", 31, "2026-03-31", "monthly anchor restores the 31st"],
  ["2028-01-30", "monthly", 30, "2028-02-29", "monthly leap year"],
  ["2026-12-15", "monthly", 15, "2027-01-15", "monthly Dec -> Jan"],
];

let failed = 0;
for (const [due, repeat, anchor, want, name] of cases) {
  const got = R.nextDue(due, repeat, anchor);
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${got}${ok ? "" : ` (want ${want})`}`);
}
console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
