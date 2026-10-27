// Persona: Busy professional.
// Fills the list fast with work items, sets priorities and tags, ticks things off, and searches
// to find one task among many. Every typed value comes from `inputs`; code judges pass or fail.
export const persona = {
  name: "Busy professional",
  who: "work tasks, priorities, tags, quick search",
};

export default [
  {
    name: "pro-add-high-priority-work-task",
    start: "/",
    maxSteps: 10,
    inputs: { "new task": "Send Q4 invoice", priority: "High", tags: "work" },
    goal: "Add a new task: type Send Q4 invoice in the New task box, choose High in the Priority dropdown "
      + "next to the Due date, type work in Tags, then click Add.",
    expect: ["Send Q4 invoice", "High", "#work", "1 of 1 task left"],
  },
  {
    name: "pro-complete-task",
    start: "/",
    maxSteps: 8,
    inputs: { "new task": "Call the bank" },
    goal: "Add the task Call the bank, then tick its checkbox to mark it done.",
    expect: ["Call the bank", "0 of 1 task left"],
  },
  {
    name: "pro-search-narrows-list",
    start: "/",
    maxSteps: 12,
    inputs: { "first task": "Draft budget", "second task": "Book dentist", search: "budget" },
    goal: "Add two tasks, first Draft budget and then Book dentist, clicking Add after each. "
      + "Then type budget in the Search tasks box.",
    expect: ["Draft budget", "2 of 2 tasks left · showing 1"],
    expectGone: ["Book dentist"],
  },
];
