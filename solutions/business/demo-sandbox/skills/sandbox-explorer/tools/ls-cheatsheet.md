# `ls` under just-bash

just-bash supports the standard `ls` flags you expect:

| Flag | Effect |
|---|---|
| `-l` | long format (perms, size, mtime) |
| `-a` | show dotfiles |
| `-h` | human-readable sizes (1.2K vs 1234) |
| `-R` | recurse |
| `-1` | one entry per line (handy for piping into other commands) |

## Common patterns

```bash
ls entities/                       # top-level: customers/ revenue/ plans/
ls -la entities/customers/         # detail incl. mtime
ls -R resources/playbooks/         # walk all subdirectories
ls entities/**/*.json              # glob — JSON files anywhere under entities/
```

## Sandboxing notes

- The **root you see is the session workspace**, not host `/`. There is
  no `/etc`, `/usr`, `/Users` etc.
- Absolute paths from the host (`/private/tmp/...`) WILL fail with
  exit=2 — they don't exist in your view.
- Use **relative paths from your CWD** (which starts at the session root).
