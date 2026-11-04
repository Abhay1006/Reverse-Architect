# Deploying to the tablet (CI/CD)

Atlas is self-hosted on a tablet. Code is pushed from the PC, and the tablet
picks up each change on its own once CI has checked it:

```
PC                    GitHub Actions                                   Tablet
git push ──► main ──► CI: typecheck, lint, knip, unit tests, build,
                          shellcheck, benchmark, npm package on
                          Node 20/22/24, browser smoke test
                            │ all green
                            ▼
                      deploy branch moved ◄──────── scripts/tab-deploy.sh watch
                                                      (checks every 60s)
                                                      pull → install → build
                                                      → restart → health check
                                                      → roll back if it fails
```

- **CI** (`.github/workflows/ci.yml`) runs on every push to `main`. When every
  job passes, the `promote` job points the `deploy` branch at that commit. A
  commit that fails any job never reaches `deploy`.
- **CD** (`scripts/tab-deploy.sh`) runs on the tablet and watches `deploy`.
  The tablet pulls from GitHub, so it needs no public IP, inbound SSH or
  webhook, and the repository needs no deploy secrets.

This replaces the old `deploy.yml`, which SSHed into the tablet through the
Cloudflare tunnel on every push. That deploy failed whenever the tunnel
dropped, did not wait for the benchmark or browser test, and left a broken
build running with no rollback.

Never push to `deploy` yourself in normal use; CI owns it.

## What a deploy does

1. Fast-forwards the tablet's checkout to the new commit.
2. Runs `npm ci` only if `package-lock.json` or a workspace `package.json`
   changed.
3. Runs `npm run build` only if something under `backend/`, `frontend/` or
   `shared/` changed. Docs, benchmark and CI changes just pull. The build it
   replaces (`backend/dist` and `frontend/.next`, minus Next's build cache)
   is kept in `.deploy/build-prev/`.
4. Restarts the app and waits up to 3 minutes for the API's `/api/health`
   and the web app to answer.
5. If any step fails, it goes back to the previous commit, puts the kept
   build back (seconds, instead of another `next build` on the tablet), and
   skips the bad commit until a newer one arrives.

It also restarts the app if it finds it has stopped.

The site can be briefly unavailable while a build runs, because
`next build` replaces `frontend/.next` under the running server.

## One-time tablet setup (Android + Termux)

These steps assume [Termux](https://f-droid.org/packages/com.termux/) from
F-Droid. On a Linux machine, skip the `pkg` and Termux:Boot parts.

1. **Install the tools**

   ```bash
   pkg update && pkg install git nodejs
   npm install -g pm2   # optional but recommended: restarts the app if it crashes
   ```

2. **Clone the repo, or update the clone you already have**

   ```bash
   git clone https://github.com/Abhay1006/Reverse-Architect.git ~/Reverse-Architect
   cd ~/Reverse-Architect
   cp backend/.env.example backend/.env     # then adjust
   cp frontend/.env.example frontend/.env   # then adjust
   ```

   If the tablet already has a clone (the old SSH deploy used
   `~/Reverse-Architect`), `cd` into it, run `git pull origin main` once to get
   the script, and keep your existing `.env` files. The deploy script refuses
   to run while tracked files have local edits, so check `git status` is
   clean.

3. **Deploy once by hand**

   ```bash
   ./scripts/tab-deploy.sh            # installs, builds and (re)starts the app
   ./scripts/tab-deploy.sh status
   ```

   With pm2 installed, this reuses the existing `reverse-architect` pm2
   process the old deploy created.

4. **Keep watching for new commits**

   ```bash
   ./scripts/tab-deploy.sh watch      # checks every 60 seconds; Ctrl+C stops watching, not the app
   ```

   `watch` takes a wake lock so Android does not suspend Termux with the
   screen off. Also set Android's battery setting for Termux to Unrestricted
   (Apps → Termux → Battery). Started over SSH, run it inside `tmux` so it
   survives the session.

5. **Start everything when the tablet boots** (optional). Install
   [Termux:Boot](https://f-droid.org/packages/com.termux.boot/), open it once,
   then:

   ```bash
   mkdir -p ~/.termux/boot
   cat > ~/.termux/boot/reverse-architect <<'EOF'
   #!/data/data/com.termux/files/usr/bin/sh
   termux-wake-lock
   cd ~/Reverse-Architect && ./scripts/tab-deploy.sh watch >/dev/null 2>&1 &
   EOF
   chmod +x ~/.termux/boot/reverse-architect
   ```

   `watch` starts the app on its first check, so nothing else is needed.

6. **Remove the old deploy secrets** (optional). `SSH_HOST`, `SSH_USERNAME`,
   `SSH_KEY`, `SSH_KNOWN_HOSTS`, `APP_DIR`, `DEPLOY_PAT` and
   `HEALTHCHECK_URL` are no longer used; delete them under the repository's
   Settings → Secrets and variables → Actions.

## Day to day

```bash
git push origin main
```

Once CI is green (its slowest job is the browser test) and within 60 more
seconds, the tablet starts deploying. Follow along in the repo's **Actions**
tab, and on the tablet with `tail -f logs/deploy.log`.

## Commands

| Command                                 | What it does                                                  |
| --------------------------------------- | ------------------------------------------------------------- |
| `scripts/tab-deploy.sh`                 | Deploy once if `deploy` has moved; start the app if it is down |
| `scripts/tab-deploy.sh watch [seconds]` | Do that forever, every 60 seconds by default                  |
| `scripts/tab-deploy.sh status`          | Deployed commit, skipped failed commit, whether the app runs  |
| `scripts/tab-deploy.sh restart`         | Restart the app without pulling (e.g. after editing `.env`)   |
| `scripts/tab-deploy.sh rollback`        | Go back to the commit before the last deploy; again to undo   |
| `scripts/tab-deploy.sh stop`            | Stop the app                                                  |

Logs: `logs/deploy.log` for deploys; `logs/reverse-architect.log` for the
app, or `pm2 logs reverse-architect` when pm2 is installed.

Optional settings, as environment variables or in `.deploy/env` (sourced by
the script, gitignored): `DEPLOY_BRANCH` (default `deploy`), `DEPLOY_REMOTE`
(`origin`), `APP_NAME` (`reverse-architect`), `HEALTH_TIMEOUT` (`180`
seconds), `BACKEND_PORT` (read from `backend/.env`, else `4000`),
`FRONTEND_PORT` (`3000`; `next start` ignores `PORT` in `frontend/.env`),
`RESTART_CMD` and `POST_INSTALL` (below), `NOTIFY_CMD` (below) and
`LOG_MAX_BYTES` (default 5 MB). Values in `.deploy/env` win over the
environment.

Logs in `logs/` are rotated on each check once they pass `LOG_MAX_BYTES`,
keeping one older copy as `.1`. When the deploy branch can't be fetched, that
is logged once, plus once more when it is back, rather than on every check.

When `watch` deploys a commit that changes `tab-deploy.sh` itself, it
restarts on the new version.

## Rolling back a bad commit by hand

A commit can pass the health check and still be broken in use. To go back to
the commit that ran before the last deploy:

```bash
./scripts/tab-deploy.sh rollback
```

When the kept build belongs to that commit (it does right after a deploy that
rebuilt), this takes seconds. Running it again returns to the newer commit,
reusing its build the same way. The rolled-back commit is not redeployed; the
next commit CI promotes deploys as usual, so push a fix or a revert to `main`.
`status` shows the commit `rollback` would return to and whether its build is
kept.

## Notifications

Set `NOTIFY_CMD` in `.deploy/env` to hear about deploys without reading logs.
It runs after a deploy, an automatic rollback, a failed rollback and a manual
rollback, with `DEPLOY_EVENT` (`deployed`, `rolled-back`, `rollback-failed`,
`manual-rollback`) and `DEPLOY_MESSAGE` set. It gets 30 seconds, and its
failure never affects the deploy.

An Android notification (needs the Termux:API app and `pkg install termux-api`):

```bash
NOTIFY_CMD='termux-notification --title "Atlas $DEPLOY_EVENT" --content "$DEPLOY_MESSAGE"'
```

A push to your phone through [ntfy](https://ntfy.sh) (pick a hard-to-guess topic):

```bash
NOTIFY_CMD='curl -fsS -d "$DEPLOY_MESSAGE" -H "Title: Atlas $DEPLOY_EVENT" https://ntfy.sh/<your-topic>'
```

## When something else already runs the app

If a supervisor (a tmux watchdog, systemd, ...) already starts the app and
revives it after crashes, don't let the script start a second copy on the
same ports. Set `RESTART_CMD` to the command that restarts it through that
supervisor. The script then only runs that command when deploying and leaves
crash recovery to the supervisor; `stop` is refused.

`POST_INSTALL` runs after every `npm ci`, for packages the host needs but the
lockfile doesn't list. Example `.deploy/env` for a tablet whose services run
in tmux session `services`:

```bash
RESTART_CMD='tmux kill-window -t services:=atlas 2>/dev/null; tmux new-window -d -t services -n atlas "cd $HOME/Reverse-Architect && npm start"'
```

The `=` in `services:=atlas` makes tmux match the window name exactly.

## Troubleshooting

- **"refusing to deploy … local changes"**: someone edited files on the
  tablet. Commit those changes on the PC instead, then on the tablet run
  `git stash` or `git checkout -- <file>`.
- **"not a fast-forward"**: `main` was force-pushed. If the remote version is
  right, run `git reset --hard origin/deploy` on the tablet, then
  `./scripts/tab-deploy.sh`.
- **A commit was rolled back**: the build failed or the app would not start,
  usually a missing `.env` setting or the tablet running out of memory during
  `next build`. `logs/deploy.log` and `logs/reverse-architect.log` show why.
  Push a fix; the next green commit deploys normally.
- **Nothing deploys**: check that the CI run on `main` is green and that its
  _Promote to the deploy branch_ job ran. Then run `./scripts/tab-deploy.sh`
  by hand on the tablet and read its output.
- **Deploy without waiting for CI** (emergencies only):
  `git push origin main:deploy --force` from the PC.
