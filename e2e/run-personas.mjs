// Persona test runner: serves an app folder on 127.0.0.1, then runs every persona spec in
// e2e/personas/ with quicke2e and the hosted Jev model (OpenRouter).
//
//   npm run personas                       # all personas against todo/
//   npm run personas -- --only pro-complete-task
//   npm run personas -- --emit generated/  # passing runs -> plain Playwright specs (no model on replay)
//   npm run personas -- --app todo --persona malicious-user
//
// The API key: the repo-root .env holds API_KEY_FOR_JEV. Only that one value is parsed and handed to
// the quicke2e process as OPENROUTER_API_KEY; nothing else from .env is loaded, and the key is never
// printed, logged or written. An OPENROUTER_API_KEY already in the environment wins.
import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv, parseArgs } from "node:util";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(HERE, "..");
const QUICKE2E = join(HERE, "node_modules", "quicke2e", "bin", "quicke2e.mjs");

const { values: args } = parseArgs({
  options: {
    app: { type: "string", default: "todo" },
    persona: { type: "string" },
    only: { type: "string" },
    emit: { type: "string" },
    runs: { type: "string" },
    trace: { type: "string" },
    headed: { type: "boolean", default: false },
  },
});

function fail(msg, code = 2) {
  console.error(`persona tests: ${msg}`);
  process.exit(code);
}

// ---- the key: one value from .env, mapped for quicke2e, never echoed ----
function engineEnv() {
  const env = { ...process.env };
  if (!env.OPENROUTER_API_KEY) {
    const file = join(ROOT, ".env");
    // trim(): a stray space or a Windows \r around the value breaks the Bearer header.
    const key = existsSync(file) ? parseEnv(readFileSync(file, "utf8")).API_KEY_FOR_JEV?.trim() : undefined;
    if (!key) fail("no Jev key: set API_KEY_FOR_JEV in the repo-root .env (or OPENROUTER_API_KEY in the environment).");
    env.OPENROUTER_API_KEY = key;
  }
  return env;
}

// ---- a minimal static server for the app folder, loopback only ----
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

function serve(dir) {
  const base = resolve(dir) + sep;
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = resolve(base, "." + path);
    if (!(file + sep).startsWith(base)) { res.writeHead(403).end(); return; } // no path traversal out of the app folder
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) { res.writeHead(404).end("not found"); return; }
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

function quicke2e(cliArgs, env) {
  return new Promise((ok) => {
    const child = spawn(process.execPath, [QUICKE2E, ...cliArgs], { env, stdio: ["ignore", "pipe", "inherit"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("close", (code) => ok({ code, out }));
  });
}

// ---- main ----
const appDir = join(ROOT, args.app);
if (!existsSync(join(appDir, "index.html"))) fail(`no ${args.app}/index.html in the repo.`);
if (!existsSync(QUICKE2E)) fail("quicke2e is not installed: run `npm ci` in e2e/.");

const personaDir = join(HERE, "personas");
const specs = readdirSync(personaDir).filter((f) => f.endsWith(".spec.mjs"))
  .filter((f) => !args.persona || f === `${args.persona}.spec.mjs`).sort();
if (!specs.length) fail(`no persona spec matched${args.persona ? ` "${args.persona}"` : ""} in e2e/personas/.`);

const env = engineEnv();
const server = await serve(appDir);
const baseUrl = `http://127.0.0.1:${server.address().port}`;
console.log(`persona tests: serving ${args.app}/ at ${baseUrl}, engine jev (OpenRouter)\n`);

const rows = [];
let exit = 0;
for (const file of specs) {
  const specPath = join(personaDir, file);
  const { persona = {} } = await import(pathToFileURL(specPath).href);
  console.log(`== ${persona.name || file}${persona.who ? ` (${persona.who})` : ""}`);

  const check = await quicke2e(["check", specPath, "--base", baseUrl], env);
  process.stdout.write(check.out);
  if (check.code !== 0) { exit = Math.max(exit, check.code); continue; }

  const runArgs = ["run", specPath, "--base", baseUrl, "--engine", "jev", "--json", args.headed ? "--headed" : "--headless"];
  for (const k of ["only", "runs", "trace"]) if (args[k]) runArgs.push(`--${k}`, args[k]);
  if (args.emit) runArgs.push("--emit", resolve(HERE, args.emit));
  const run = await quicke2e(runArgs, env);

  const lines = run.out.trimEnd().split("\n");
  let records = [];
  try { records = JSON.parse(lines.at(-1)); lines.pop(); } catch { /* no JSON: the human output says why */ }
  if (lines.length) console.log(lines.join("\n"));
  exit = Math.max(exit, run.code);

  for (const r of records) {
    // An attack also fails when the page opened a native dialog: an injected script ran.
    const injected = r.kind === "attack" && (r.dialogs || []).length > 0;
    if (injected) exit = Math.max(exit, 1);
    rows.push({ persona: persona.name || file, flow: r.flow, kind: r.kind || "", pass: r.passed && !injected,
      outcome: injected ? "DIALOG_OPENED" : r.outcome, steps: (r.steps || []).length, s: (r.wallMs || 0) / 1000, cost: r.cost || 0 });
  }
  console.log();
}
server.close();

if (rows.length) {
  console.log("persona            flow                              kind    result  outcome         steps   time      cost");
  for (const r of rows) {
    console.log(`${r.persona.padEnd(18)} ${r.flow.padEnd(33)} ${r.kind.padEnd(7)} ${(r.pass ? "PASS" : "FAIL").padEnd(7)} ${r.outcome.padEnd(15)} ${String(r.steps).padStart(5)} ${r.s.toFixed(1).padStart(6)}s  $${r.cost.toFixed(5)}`);
  }
  const passed = rows.filter((r) => r.pass).length;
  const cost = rows.reduce((a, r) => a + r.cost, 0), time = rows.reduce((a, r) => a + r.s, 0);
  console.log(`\n${passed}/${rows.length} passed · ${time.toFixed(1)}s of runs · $${cost.toFixed(5)} total`);
}
process.exit(exit);
