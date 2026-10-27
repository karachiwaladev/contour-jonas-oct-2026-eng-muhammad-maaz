"""PreToolUse hook: block dangerous commands before they run.

Second layer behind permissions.deny in .claude/settings.json. Deny rules match
each subcommand by its exact spelling, so they miss `rm -fr`, `/bin/rm -rf`,
`bash -c 'rm -rf x'`, `git -c k=v push --force` and `curl … | sh`. This hook
regex-checks the whole command text, including nested and quoted commands, and
blocks with exit code 2. Claude sees the stderr message as the reason.

Blocks:
  - recursive + force deletes:  rm -rf / -fr / -r -f / --recursive --force,
    and PowerShell Remove-Item (and its aliases) with -Recurse and -Force
  - force pushes:               git push --force / -f / --force-with-lease / +refspec
  - pipe-to-shell:              curl|wget|iwr|irm … | sh|bash|pwsh|iex|python|node…,
                                iex (irm …), bash <(curl …), sh -c "$(curl …)"
  - reading .env files:         the Read tool, or cat/type/Get-Content/less/head/… .env*
"""
import json
import os
import re
import sys

I = re.I
SEG = r"[^;&|\n]*"  # stay inside one simple command

RULES = [
    ("recursive force delete (rm -rf)", re.compile(
        r"(?<![\w-])(?:\S*/)?rm\s+(?:-\S+\s+)*?-(?=[a-zA-Z]*[rR])(?=[a-zA-Z]*f)[a-zA-Z]+\b")),
    ("recursive force delete (rm -r … -f)", re.compile(
        rf"(?<![\w-])(?:\S*/)?rm\b{SEG}\s(?:-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)\b{SEG}\s(?:-[a-zA-Z]*f[a-zA-Z]*|--force)\b")),
    ("recursive force delete (rm -f … -r)", re.compile(
        rf"(?<![\w-])(?:\S*/)?rm\b{SEG}\s(?:-[a-zA-Z]*f[a-zA-Z]*|--force)\b{SEG}\s(?:-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)\b")),
    ("recursive force delete (Remove-Item -Recurse -Force)", re.compile(
        r"(?<![\w-])(?:remove-item|ri|rm|del|erase|rd|rmdir)\b[^;|\n]*\s-r(?:e(?:c(?:u(?:r(?:se?)?)?)?)?)?\b[^;|\n]*\s-fo(?:r(?:ce?)?)?\b", I)),
    ("recursive force delete (Remove-Item -Force -Recurse)", re.compile(
        r"(?<![\w-])(?:remove-item|ri|rm|del|erase|rd|rmdir)\b[^;|\n]*\s-fo(?:r(?:ce?)?)?\b[^;|\n]*\s-r(?:e(?:c(?:u(?:r(?:se?)?)?)?)?)?\b", I)),
    ("force push (git push --force / -f / +refspec)", re.compile(
        rf"(?<![\w-])git\b{SEG}\bpush\b{SEG}(?:\s--force(?:-with-lease|-if-includes)?\b|\s-(?=[a-zA-Z]*f)[a-zA-Z]+\b|\s\+[\w./:-]+)")),
    ("pipe-to-shell (curl/wget … | sh)", re.compile(
        r"\b(?:curl|wget|iwr|irm|invoke-webrequest|invoke-restmethod)\b[^;\n]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|dash|ksh|pwsh|powershell|iex|invoke-expression|python3?|node|perl|ruby)\b", I)),
    ("pipe-to-shell (iex (irm …))", re.compile(
        r"\b(?:iex|invoke-expression)\b\s*\(?\s*(?:\(|\$\()?\s*(?:irm|iwr|invoke-restmethod|invoke-webrequest|new-object\s+net\.webclient)", I)),
    ("pipe-to-shell (bash <(curl …) / sh -c \"$(curl …)\")", re.compile(
        r"\b(?:sh|bash|zsh|dash)\b[^;\n]*(?:<\(|\$\(|`)\s*(?:curl|wget)\b", I)),
    ("reading a .env file", re.compile(
        r"(?<![\w-])(?:cat|tac|type|get-content|gc|less|more|head|tail|bat|nl|strings|xxd|od|hexdump|source|cp|copy|copy-item|mv|scp|base64|sed|awk|grep|rg|select-string"
        r"|curl|wget|nc|ncat|http|iwr|irm|invoke-webrequest|invoke-restmethod)\b"
        r"[^;|\n]*(?:^|[\s/\\'\"=@])\.env(?:\.[\w.-]+)?(?=$|[\s'\";|&)])", I)),
    ("reading a .env file (redirect / dot-source)", re.compile(
        r"(?:<\s*|(?:^|[;&|]\s*)\.\s+)(?:\S*[/\\])?\.env(?:\.[\w.-]+)?(?=$|[\s'\";|&)])", I)),
]


def blocked_reason(tool, tool_input):
    if tool == "Read":
        name = os.path.basename(str(tool_input.get("file_path", "")).replace("\\", "/"))
        if name == ".env" or name.startswith(".env."):
            return "reading a .env file"
        return None
    command = str(tool_input.get("command", ""))
    for reason, rx in RULES:
        if rx.search(command):
            return reason
    return None


def main():
    try:
        payload = json.load(sys.stdin)
    except ValueError:
        return 0
    reason = blocked_reason(payload.get("tool_name", ""), payload.get("tool_input") or {})
    if reason:
        print(
            f"Blocked by the factory's safety hook: {reason}. This is never allowed in this repo "
            f"(see .claude/hooks/block_dangerous.py). Don't retry it in another form; if it's really "
            f"needed, stop and ask the user to do it themselves.",
            file=sys.stderr,
        )
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
