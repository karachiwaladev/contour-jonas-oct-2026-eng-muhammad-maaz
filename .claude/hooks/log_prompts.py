"""Stop hook: append this session's new prompts to .claude/logs/prompts.jsonl.

Reads the hook payload (session_id, transcript_path) from stdin, scans the
transcript, and appends one JSON line per prompt not already logged for this
session. Dedup is by transcript uuid, read back from the log itself, so the
hook keeps no separate state and is safe to run on every stop.

Logged sources:
  human     - a prompt you typed and submitted
  queued    - a message you sent while Claude was mid-turn
  scheduled - a prompt fired by /loop or another scheduled task
Subagent hand-backs, skill bodies, and tool results are not prompts and are skipped.
"""
import json
import os
import re
import sys

CMD_NAME = re.compile(r"<command-name>(.*?)</command-name>", re.S)
CMD_ARGS = re.compile(r"<command-args>(.*?)</command-args>", re.S)


def clean(text):
    # Slash commands are stored as XML-ish tags; log them as the user typed them.
    name = CMD_NAME.search(text)
    if name:
        args = CMD_ARGS.search(text)
        return (name.group(1).strip() + " " + (args.group(1).strip() if args else "")).strip()
    return text


def prompts_from(transcript):
    with open(transcript, encoding="utf-8") as f:
        for line in f:
            try:
                d = json.loads(line)
            except ValueError:
                continue
            kind = d.get("type")
            if kind == "user":
                content = (d.get("message") or {}).get("content")
                if not isinstance(content, str):
                    continue  # tool results and injected text blocks
                origin = (d.get("origin") or {}).get("kind")
                turn = d.get("turnOrigin")
                if origin == "human" or turn == "human":
                    source = "human"
                elif turn == "scheduled":
                    source = "scheduled"
                else:
                    continue  # peer/subagent messages, skill bodies, other meta
                yield d.get("uuid"), d.get("timestamp"), source, clean(content)
            elif kind == "attachment":
                a = d.get("attachment") or {}
                if a.get("type") == "queued_command" and (a.get("origin") or {}).get("kind") == "human":
                    yield d.get("uuid"), a.get("timestamp") or d.get("timestamp"), "queued", clean(a.get("prompt", ""))


def main():
    payload = json.load(sys.stdin)
    session_id = payload.get("session_id")
    transcript = payload.get("transcript_path")
    if not transcript or not os.path.exists(transcript):
        return

    project = os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or os.getcwd()
    log_dir = os.path.join(project, ".claude", "logs")
    log_path = os.path.join(log_dir, "prompts.jsonl")
    os.makedirs(log_dir, exist_ok=True)

    seen = set()
    if os.path.exists(log_path):
        with open(log_path, encoding="utf-8") as f:
            for line in f:
                try:
                    rec = json.loads(line)
                except ValueError:
                    continue
                if rec.get("session_id") == session_id:
                    seen.add(rec.get("uuid"))

    with open(log_path, "a", encoding="utf-8", newline="\n") as out:
        for uuid, ts, source, prompt in prompts_from(transcript):
            if not uuid or uuid in seen or not prompt.strip():
                continue
            seen.add(uuid)
            out.write(json.dumps({
                "timestamp": ts,
                "session_id": session_id,
                "uuid": uuid,
                "source": source,
                "prompt": prompt,
            }, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
