"""Stop hook: commit and push whatever work is in the tree when Claude stops.

It acts only on ticket branches (issue-<N>), which reach main through a PR the
user merges. On main or any other branch it never commits or pushes. It only
warns if there are real uncommitted changes, so nothing lands on main directly.

Non-destructive by design: it only ever adds commits and does a plain push.
It never force-pushes, resets, rebases, stashes, or deletes anything. When it
can't act safely (detached HEAD, a merge or rebase in progress, no upstream,
push rejected), it skips and says why in a systemMessage instead of
trying to repair the repo.

Changes that touch only the prompt log (.claude/logs/prompts.jsonl) don't get
their own commit, since the /loop would otherwise commit every minute. The log
goes along with the next real commit instead.
"""
import json
import os
import subprocess
import sys

LOG_ONLY = {".claude/logs/prompts.jsonl"}
TICKET_PREFIX = "issue-"
PUSH_AUTH = ["-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential"]


def git(*args, check=True):
    r = subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip() or r.stdout.strip()}")
    return r


def say(msg):
    print(json.dumps({"systemMessage": f"auto-commit: {msg}"}))


def main():
    try:
        sys.stdin.read()  # drain the hook payload; not needed
    except Exception:
        pass
    os.chdir(os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())

    if git("rev-parse", "--is-inside-work-tree", check=False).returncode != 0:
        return
    git_dir = git("rev-parse", "--git-dir").stdout.strip()
    if any(os.path.exists(os.path.join(git_dir, p)) for p in ("MERGE_HEAD", "rebase-merge", "rebase-apply", "CHERRY_PICK_HEAD")):
        say("skipped, a merge/rebase/cherry-pick is in progress.")
        return
    branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    if branch == "HEAD":
        say("skipped, detached HEAD.")
        return
    if not branch.startswith(TICKET_PREFIX):
        changed = [line[3:] for line in git("status", "--porcelain").stdout.splitlines() if line[3:]]
        if set(changed) - LOG_ONLY:
            say(f"not committing on '{branch}', since only {TICKET_PREFIX}<N> branches are auto-committed. "
                f"Uncommitted: {', '.join(changed[:5])}")
        return

    git("add", "-A")
    staged = [p for p in git("diff", "--cached", "--name-only").stdout.splitlines() if p]
    committed = None
    if staged and not set(staged) <= LOG_ONLY:
        shown = ", ".join(staged[:5]) + (f" (+{len(staged) - 5} more)" if len(staged) > 5 else "")
        git("commit", "-q", "-m", f"Auto-commit on stop: {len(staged)} file(s)", "-m", shown)
        committed = git("rev-parse", "--short", "HEAD").stdout.strip()
    elif staged:
        git("reset", "-q", "--", *staged)  # unstage only; the working tree is untouched

    # Push if this branch has commits its remote doesn't (ours just now, or earlier ones).
    if git("rev-parse", "--verify", "-q", f"origin/{branch}", check=False).returncode != 0:
        if committed:
            say(f"committed {committed}; not pushed (no origin/{branch}).")
        return
    ahead = int(git("rev-list", "--count", f"origin/{branch}..HEAD").stdout.strip() or 0)
    if not ahead:
        return
    push = git(*PUSH_AUTH, "push", "origin", branch, check=False)
    if push.returncode != 0:
        say(f"push to origin/{branch} failed ({ahead} commit(s) waiting); nothing was forced. {push.stderr.strip()[-200:]}")
        return
    say(f"{'committed ' + committed + ' and ' if committed else ''}pushed {ahead} commit(s) to origin/{branch}.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # never break the session over a hook
        say(f"error: {e}")
