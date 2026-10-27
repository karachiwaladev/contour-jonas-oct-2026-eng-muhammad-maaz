// Persona: Malicious user.
// Types hostile values into real fields. Each attack asserts that the app handled it safely (the value
// shows as plain text, or the rule held) and that the bad outcome never appears. The runner also fails
// an attack if the page opened a native dialog, which would mean an injected script ran.
export const persona = {
  name: "Malicious user",
  who: "HTML/script injection, overlong input, regex in search",
};

const TAIL = "TAILMARKER";
const OVERLONG = "Overlong " + "x".repeat(195) + TAIL; // 214 chars; the title field caps at 200

export default [
  {
    name: "attack-html-in-title",
    kind: "attack",
    start: "/",
    maxSteps: 8,
    inputs: { "new task": "<img src=x onerror=alert('pwned')>" },
    goal: "Add a new task whose title is the given text, then click Add.",
    // Escaped output: the markup is visible as literal text, so it was never parsed as HTML.
    expect: ["<img src=x onerror=alert('pwned')>", "1 of 1 task left"],
  },
  {
    name: "attack-overlong-title",
    kind: "attack",
    start: "/",
    maxSteps: 8,
    inputs: { "new task": OVERLONG },
    goal: "Add a new task whose title is the given long text, then click Add.",
    expect: ["Overlong xxxxxxxxxx", "1 of 1 task left"],
    expectAbsent: [TAIL], // the cap held: characters past 200 never reach the list
  },
  {
    name: "attack-regex-in-search",
    kind: "attack",
    start: "/",
    maxSteps: 10,
    inputs: { "new task": "Pay rent", search: ".*" },
    goal: "Add the task Pay rent, then type .* in the Search tasks box.",
    // Search is literal: ".*" is not a wildcard, so nothing matches.
    expect: ["No tasks match these filters."],
    expectGone: ["Pay rent"],
  },
];
