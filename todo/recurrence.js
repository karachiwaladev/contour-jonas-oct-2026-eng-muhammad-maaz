// Recurrence rules for repeating tasks: pure date math, no DOM or storage.
// Dates are "YYYY-MM-DD" strings handled as local dates. Exposed as
// window.Recurrence in the browser, and as module.exports under Node for tests.
(function (root) {
  const LABELS = { daily: "Daily", weekdays: "Weekdays", weekly: "Weekly", monthly: "Monthly" };

  function parse(ymd) {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function format(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function daysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  // Strict schedule: exactly one interval after the previous due date, even if
  // that is still in the past. anchorDay keeps monthly repeats on their original
  // day of the month (31st -> Feb 28 -> Mar 31) instead of drifting after a short month.
  function nextDue(dueDate, repeat, anchorDay) {
    const d = parse(dueDate);
    switch (repeat) {
      case "daily":
        d.setDate(d.getDate() + 1);
        return format(d);
      case "weekdays":
        do {
          d.setDate(d.getDate() + 1);
        } while (d.getDay() === 0 || d.getDay() === 6);
        return format(d);
      case "weekly":
        d.setDate(d.getDate() + 7);
        return format(d);
      case "monthly": {
        const year = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
        const month = (d.getMonth() + 1) % 12;
        const day = Math.min(anchorDay || d.getDate(), daysInMonth(year, month));
        return format(new Date(year, month, day));
      }
      default:
        throw new Error(`Unknown repeat: ${repeat}`);
    }
  }

  const api = { LABELS, nextDue, format, parse, isRepeat: (r) => Object.hasOwn(LABELS, r) };
  root.Recurrence = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
