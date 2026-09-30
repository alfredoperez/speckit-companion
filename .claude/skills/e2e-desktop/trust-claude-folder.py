#!/usr/bin/env python3
"""Answer Claude Code's folder-trust prompt with Yes, once, so a dispatched terminal never stops on it.

  trust-claude-folder.py <dir>   -> prints ACCEPTED, ALREADY_TRUSTED or FAILED (exit 1)

Any folder with its own .claude/ shows the prompt, even with --permission-mode bypassPermissions.
Claude Code records the answer itself; nothing else is written.
"""
import os
import pty
import re
import select
import signal
import sys
import time

folder = sys.argv[1]
pid, fd = pty.fork()
if pid == 0:
    for key in list(os.environ):
        if key.startswith(("CLAUDE", "CODEX", "ANTHROPIC_", "MCP")):
            os.environ.pop(key)
    os.environ["TERM"] = "xterm-256color"
    os.chdir(folder)
    os.execvp("claude", ["claude"])

buf = b""
sent = False
result = "FAILED"
deadline = time.time() + 30
while time.time() < deadline:
    ready, _, _ = select.select([fd], [], [], 0.5)
    if ready:
        try:
            chunk = os.read(fd, 4096)
        except OSError:
            break
        if not chunk:
            break
        buf += chunk
    text = re.sub(r"\s", "", re.sub(rb"\x1b\[[0-9;?]*[a-zA-Z]", b"", buf).decode("utf8", "ignore"))
    if not sent and "Itrustthisfolder" in text:
        time.sleep(0.5)
        os.write(fd, b"\x1b[B")
        time.sleep(0.3)
        os.write(fd, b"\r")
        sent = True
        buf = b""
        continue
    if "shift+tab" in text or "forshortcuts" in text:
        result = "ACCEPTED" if sent else "ALREADY_TRUSTED"
        break
os.kill(pid, signal.SIGKILL)
print(result)
sys.exit(0 if result != "FAILED" else 1)
