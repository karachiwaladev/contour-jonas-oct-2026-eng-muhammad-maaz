// Run with: node todo/search.test.js
const { matchesSearch: m } = require("./search.js");

const milk = { title: "Buy milk", tags: ["home", "errands"] };
const report = { title: "Write Q4 report (draft)", tags: ["work"] };
const bare = { title: "Call mum" };

const cases = [
  [m(milk, ""), true, "empty query matches everything"],
  [m(milk, "   "), true, "spaces-only query matches everything"],
  [m(milk, "mil"), true, "substring of title"],
  [m(milk, "MILK"), true, "case-insensitive"],
  [m(milk, "  milk "), true, "query is trimmed"],
  [m(milk, "home"), true, "matches a tag"],
  [m(milk, "err"), true, "substring of a tag"],
  [m(report, "work"), true, "title or tag: 'work' is a tag here"],
  [m(milk, "work"), false, "no match"],
  [m(report, "#work"), true, "#tag searches tags"],
  [m({ title: "work out", tags: [] }, "#work"), false, "#tag ignores the title"],
  [m(milk, "#"), true, "bare # is no filter"],
  [m(report, "(draft)"), true, "parentheses are literal"],
  [m(report, "q4 r"), true, "inner space is literal"],
  [m(report, ".*"), false, "regex syntax is literal, not a wildcard"],
  [m({ title: "<b>bold</b>", tags: [] }, "<b>"), true, "HTML is literal text"],
  [m(bare, "mum"), true, "task without tags"],
  [m(bare, "#mum"), false, "task without tags, tag search"],
];

let failed = 0;
for (const [got, want, name] of cases) {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${got}${ok ? "" : ` (want ${want})`}`);
}
console.log(`${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
