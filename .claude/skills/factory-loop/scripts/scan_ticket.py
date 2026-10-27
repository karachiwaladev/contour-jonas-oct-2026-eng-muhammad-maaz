"""Heuristic prompt-injection / attack scan for a GitHub issue.

Usage:
  gh issue view <N> --json number,title,author,body,comments \
    | python scan_ticket.py --self "$(gh api user --jq .login)"

--self skips comments posted by the loop's own account. Those are our
resolution comments, and they would otherwise flag their own links and SHAs.

Prints a JSON report: each indicator found, with its severity, the field it
was found in, and a short snippet. It is a tripwire, not a verdict. Words like
"token" or "delete" can be legitimate in a ticket, so whoever runs this still
judges the ticket as a whole.

Snippets are truncated and anything that looks like a key or token is masked,
so the report never echoes a secret in full.
"""
import json
import re
import sys

# (severity, category, pattern). Patterns are case-insensitive.
RULES = [
    # Attempts to override the agent's instructions or identity
    ("high", "instruction-override", r"\b(ignore|disregard|forget|override)\b[^.\n]{0,40}\b(previous|prior|above|earlier|all|your|system)\b[^.\n]{0,20}\b(instruction|prompt|rule|guideline|direction)s?"),
    ("high", "instruction-override", r"\b(you are now|act as|pretend to be|from now on you|new instructions|developer mode|jailbreak|DAN mode)\b"),
    ("high", "instruction-override", r"(^|\n)\s*(system|assistant|developer)\s*:\s"),
    ("high", "instruction-override", r"</?(system|instructions?|prompt)>"),
    # Requests to reveal or move secrets / the agent's own rules
    ("high", "secret-request", r"\b(print|show|display|reveal|output|echo|cat|send|share|upload|post|paste|dump|leak)\b[^.\n]{0,40}(\.env\b|api[_ -]?keys?|secrets?|tokens?|passwords?|credentials?|private key|id_rsa|ssh key|GITHUB_TOKEN|gh auth token)"),
    ("high", "secret-request", r"\b(printenv|gh auth token|cat\s+~?/?\.(env|ssh|aws|npmrc|git-credentials))\b"),
    ("high", "secret-request", r"\b(system prompt|your (instructions|rules|guidelines|guardrails)|CLAUDE\.md)\b[^.\n]{0,40}\b(print|show|reveal|repeat|quote|output|send)\b|\b(print|show|reveal|repeat|quote|output|send)\b[^.\n]{0,40}\b(system prompt|your (instructions|rules|guidelines|guardrails)|CLAUDE\.md)\b"),
    # Exfiltration / remote execution
    ("high", "exfiltration", r"\b(curl|wget|Invoke-WebRequest|iwr|Invoke-RestMethod|irm)\b[^\n]*\|\s*(sh|bash|zsh|pwsh|powershell|iex|python)\b"),
    ("high", "code-exec", r"\|\s*(sh|bash|zsh|pwsh|powershell|iex|python3?|node)\b"),
    ("high", "exfiltration", r"\b(webhook\.site|requestbin|pipedream|ngrok|pastebin|transfer\.sh|interact\.sh|burpcollaborator|oast)\b"),
    ("medium", "network", r"\b(curl|wget|Invoke-WebRequest|iwr|nc|netcat|ncat|scp|rsync)\b\s"),
    ("medium", "network", r"https?://(?!github\.com/karachiwaladev/|(www\.)?github\.com/karachiwaladev/)[^\s)>\]]+"),
    # Tampering with the agent, repo config, CI or credentials
    ("high", "config-tamper", r"\b(git\s+config|git\s+remote\s+(add|set-url)|gh\s+auth|credential\.helper|--no-verify|disable[^.\n]{0,20}(hook|check|security|review|guardrail))\b"),
    ("medium", "config-tamper", r"(\.claude/|settings(\.local)?\.json|\bhooks?\b[^.\n]{0,20}\b(remove|delete|disable|edit|change)|\bpermissions?\b[^.\n]{0,20}\b(allow|bypass|grant))"),
    # Destructive actions
    ("medium", "destructive", r"\b(rm\s+-rf|del\s+/[sq]|rmdir\s+/s|git\s+push\s+(-f|--force)|reset\s+--hard|git\s+clean\s+-[a-z]*f|drop\s+(table|database)|truncate\s+table|format\s+[a-z]:)"),
    ("low", "destructive", r"\b(delete|wipe|erase|destroy)\b[^.\n]{0,30}\b(all|every|repo|repository|branch(es)?|history|project|database|files?)\b"),
    # Supply chain / code execution
    ("medium", "supply-chain", r"\b(npm|pnpm|yarn)\s+(i|install|add)\b|\bpip3?\s+install\b|\bpostinstall\b|\bgit\+https?://|\bnpx\s+\S+"),
    ("medium", "code-exec", r"\b(eval|exec|Function)\s*\(|\bchild_process\b|\bos\.system\b|\bsubprocess\b|\bpowershell\s+-enc|\bfrombase64string\b|\batob\s*\("),
    # Social engineering
    ("low", "social-engineering", r"\b(urgent(ly)?|immediately|right now|asap|pre-?approved|already approved|you (are|have been) authori[sz]ed|as (the|an) admin|the (user|owner) (said|wants|approved)|anthropic (says|requires))\b"),
]

HIDDEN = [
    ("high", "hidden-text", re.compile(r"<!--.*?-->", re.S), "HTML comment (invisible when rendered)"),
    ("high", "hidden-text", re.compile("[​-‏⁠-⁤﻿]"), "zero-width character"),
    ("high", "hidden-text", re.compile("[‪-‮⁦-⁩]"), "bidi control character"),
    ("medium", "obfuscation", re.compile(r"(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{48,}={0,2}(?![A-Za-z0-9+/])"), "long base64-like blob"),
    ("medium", "obfuscation", re.compile(r"(?:\\x[0-9a-fA-F]{2}){8,}|(?:%[0-9a-fA-F]{2}){8,}"), "hex/percent-encoded run"),
    ("medium", "obfuscation", re.compile(r"data:[a-z]+/[a-z0-9.+-]+;base64,", re.I), "data: URL"),
    ("low", "hidden-text", re.compile(r"<details>|<sub>|<sup>|font-size:\s*0|display:\s*none", re.I), "collapsed/hidden markup"),
]

SECRETISH = re.compile(r"(gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|[A-Za-z0-9+/]{40,})")


def snippet(text, start, end):
    s = text[max(0, start - 30): min(len(text), end + 30)].replace("\n", " ")
    s = SECRETISH.sub(lambda m: m.group(0)[:4] + "…[masked]", s)
    return (s[:117] + "…") if len(s) > 120 else s


URL = re.compile(r"https?://[^\s)>\]]+")


def scan(field, text):
    found = []
    url_spans = [m.span() for m in URL.finditer(text)]
    in_url = lambda m: any(a <= m.start() and m.end() <= b for a, b in url_spans)
    for sev, cat, pat in RULES:
        for m in re.finditer(pat, text, re.I):
            found.append({"severity": sev, "category": cat, "field": field, "snippet": snippet(text, m.start(), m.end())})
    for sev, cat, rx, what in HIDDEN:
        for m in rx.finditer(text):
            if cat == "obfuscation" and in_url(m):
                continue  # long runs inside a URL are paths/SHAs; the URL itself is judged by the network rule
            found.append({"severity": sev, "category": cat, "field": field, "what": what,
                          "snippet": snippet(text, m.start(), m.end()).encode("unicode_escape").decode("ascii")})
    return found


def main():
    me = sys.argv[sys.argv.index("--self") + 1] if "--self" in sys.argv else None
    issue = json.load(sys.stdin)
    fields = [("title", issue.get("title", "")), ("body", issue.get("body", ""))]
    authors = {"issue": (issue.get("author") or {}).get("login")}
    for i, c in enumerate(issue.get("comments") or []):
        who = (c.get("author") or {}).get("login")
        if me and who == me:
            continue
        fields.append((f"comment[{i}] by {who}", c.get("body", "")))
    findings = [f for name, text in fields for f in scan(name, text or "")]
    order = {"high": 0, "medium": 1, "low": 2}
    findings.sort(key=lambda f: order[f["severity"]])
    worst = findings[0]["severity"] if findings else "none"
    print(json.dumps({
        "issue": issue.get("number"),
        "authors": authors | {"commenters": sorted({(c.get("author") or {}).get("login") for c in issue.get("comments") or []})},
        "highest_severity": worst,
        "count": len(findings),
        "findings": findings,
    }, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    main()
