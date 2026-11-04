#!/usr/bin/env bash
# Continuous deployment for the self-hosted tablet.
#
# CI moves the `deploy` branch to every commit on main that passes typecheck,
# lint, knip, unit tests, the benchmark, the package test and the browser
# smoke test (.github/workflows/ci.yml). This script runs on the tablet,
# watches that branch, and when it moves:
#
#   1. fast-forwards the checkout to the new commit,
#   2. reinstalls dependencies only if a package.json or the lockfile changed,
#   3. rebuilds only if backend/, frontend/ or shared/ changed,
#   4. restarts the app and waits for the API and the web app to answer,
#   5. rolls back to the previous commit if any of that fails.
#
# Usage (from anywhere; the script finds the repo itself):
#   scripts/tab-deploy.sh            deploy once if there is a new commit
#   scripts/tab-deploy.sh watch [s]  check every s seconds (default 60), forever
#   scripts/tab-deploy.sh restart    restart the app without pulling
#   scripts/tab-deploy.sh stop       stop the app
#   scripts/tab-deploy.sh status     show deployed commit and whether it runs
#
# Settings (environment variables, all optional):
#   DEPLOY_BRANCH   branch to deploy from          (default deploy)
#   DEPLOY_REMOTE   git remote                     (default origin)
#   APP_NAME        pm2 process name               (default reverse-architect)
#   HEALTH_TIMEOUT  seconds to wait for the app    (default 180)
#   BACKEND_PORT    API port to health-check       (default: PORT in backend/.env, else 4000)
#   FRONTEND_PORT   web port to health-check       (default 3000)
#   RESTART_CMD     shell command that (re)starts the app. Set it when
#                   something else already supervises the app (a tmux
#                   watchdog, systemd, ...): the script then only runs this to
#                   restart, never starts its own copy, and leaves crash
#                   recovery to that supervisor.
#   POST_INSTALL    shell command run after every `npm ci`, for host-only
#                   packages that `npm ci` removes again.
#
# Settings can also go in .deploy/env (sourced, gitignored), which keeps them
# with the checkout instead of in whatever starts `watch`.
#
# The app runs under pm2 when it is installed (npm install -g pm2), which also
# restarts it if it crashes. Without pm2 it runs in the background with a pid
# file, and `watch` restarts it if it has died.
#
# See docs/TAB-DEPLOY.md for the one-time tablet setup.

set -u

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$REPO_DIR" || exit 1

DEPLOY_BRANCH="${DEPLOY_BRANCH:-deploy}"
DEPLOY_REMOTE="${DEPLOY_REMOTE:-origin}"
APP_NAME="${APP_NAME:-reverse-architect}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

STATE_DIR="$REPO_DIR/.deploy"
LOG_DIR="$REPO_DIR/logs"
PID_FILE="$STATE_DIR/$APP_NAME.pid"
FAILED_FILE="$STATE_DIR/failed-sha"
LOCK_DIR="$STATE_DIR/lock"
DEPLOY_LOG="$LOG_DIR/deploy.log"
APP_LOG="$LOG_DIR/$APP_NAME.log"

mkdir -p "$STATE_DIR" "$LOG_DIR"

# shellcheck source=/dev/null
[ -f "$STATE_DIR/env" ] && . "$STATE_DIR/env"
RESTART_CMD="${RESTART_CMD:-}"
POST_INSTALL="${POST_INSTALL:-}"

# The repo's `prepare` script installs husky's git hooks; a deploy checkout
# never commits, so skip it.
export HUSKY=0

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$DEPLOY_LOG"
}

# Reads PORT from a workspace's .env, the same file the app itself loads.
env_port() {
  local file="$1" fallback="$2" port=""
  if [ -f "$file" ]; then
    port="$(sed -n 's/^[[:space:]]*PORT[[:space:]]*=[[:space:]]*//p' "$file" | tail -n 1 | tr -d "\"'\r ")"
  fi
  echo "${port:-$fallback}"
}

backend_port() { echo "${BACKEND_PORT:-$(env_port backend/.env 4000)}"; }
# `next start` does not take its port from frontend/.env, only from the
# environment or -p, so 3000 unless the app was started differently.
frontend_port() { echo "${FRONTEND_PORT:-3000}"; }

# True when an outside supervisor owns the app process (see RESTART_CMD).
supervised() {
  [ -n "$RESTART_CMD" ]
}

have_pm2() {
  command -v pm2 >/dev/null 2>&1
}

# --- process control --------------------------------------------------------

# True if the pid file names a live process that is our `npm start`. Checking
# its working directory guards against a stale pid reused by another process
# after a reboot.
pid_running() {
  [ -f "$PID_FILE" ] || return 1
  local pid
  pid="$(cat "$PID_FILE")"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null || return 1
  if [ -e "/proc/$pid/cwd" ]; then
    [ "$(readlink "/proc/$pid/cwd")" = "$REPO_DIR" ]
  fi
}

is_running() {
  if supervised; then
    http_ok
  elif have_pm2; then
    pm2 describe "$APP_NAME" 2>/dev/null | grep -q "status.*online"
  else
    pid_running
  fi
}

stop_app() {
  if supervised; then
    log "the app is managed by RESTART_CMD's supervisor; stop it there"
    return 1
  fi
  if have_pm2; then
    pm2 stop "$APP_NAME" >/dev/null 2>&1
    return 0
  fi
  pid_running || {
    rm -f "$PID_FILE"
    return 0
  }
  local pid _
  pid="$(cat "$PID_FILE")"
  # `npm start` runs the API and the web app under concurrently, all in the
  # process group start_app created (its id is the leader's pid). Signal and
  # wait for the whole group: npm itself exits first, and stopping there left
  # the API running and holding its port.
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
  for _ in $(seq 1 20); do
    kill -0 -- "-$pid" 2>/dev/null || break
    sleep 1
  done
  kill -KILL -- "-$pid" 2>/dev/null
  rm -f "$PID_FILE"
}

start_app() {
  if supervised; then
    bash -c "$RESTART_CMD"
    return
  fi
  if have_pm2; then
    if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
      pm2 restart "$APP_NAME" --update-env >/dev/null || return 1
    else
      pm2 start npm --name "$APP_NAME" --cwd "$REPO_DIR" -- start >/dev/null || return 1
    fi
    pm2 save >/dev/null 2>&1
    return 0
  fi
  stop_app
  # `set -m` gives the app its own process group, so Ctrl+C on `watch` does
  # not take it down too, and stop_app can signal all of it at once.
  (
    set -m
    nohup npm start >>"$APP_LOG" 2>&1 &
    echo $! >"$PID_FILE"
  )
}

# The API must answer /api/health; the web app counts as up on any response
# below 500.
http_ok() {
  node -e '
    const [api, web] = process.argv.slice(1);
    Promise.all([fetch(api), fetch(web)])
      .then(([a, w]) => process.exit(a.ok && w.status < 500 ? 0 : 1), () => process.exit(1));
  ' "http://127.0.0.1:$(backend_port)/api/health" "http://127.0.0.1:$(frontend_port)/"
}

wait_healthy() {
  local waited=0
  # Give a restart a moment to take the old process down, so an app that is
  # still on its way out does not count as the new one answering.
  sleep 5
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    if http_ok; then
      return 0
    fi
    sleep 3
    waited=$((waited + 3))
  done
  return 1
}

restart_app() {
  log "restarting $APP_NAME"
  start_app || return 1
  if wait_healthy; then
    log "$APP_NAME is up (API :$(backend_port), web :$(frontend_port))"
    return 0
  fi
  log "ERROR: $APP_NAME did not answer within ${HEALTH_TIMEOUT}s (see $APP_LOG or 'pm2 logs $APP_NAME')"
  return 1
}

# --- build --------------------------------------------------------------------

# True when dependencies are installed and both workspaces have build output.
built() {
  [ -d node_modules ] && [ -f backend/dist/backend/src/server.js ] && [ -f frontend/.next/BUILD_ID ]
}

# Installs and builds whatever the change from $1 to $2 needs. With an empty $1
# (first deploy) everything is installed and built.
build() {
  local from="$1" to="$2" changed=""
  if [ -n "$from" ]; then
    changed="$(git diff --name-only "$from" "$to")"
  fi

  # One lockfile for all workspaces. Dev dependencies are needed: the build
  # runs tsc and next.
  if [ -z "$from" ] || [ ! -d node_modules ] ||
    grep -qE '^((backend|frontend|shared)/)?package(-lock)?\.json$' <<<"$changed"; then
    log "installing dependencies"
    npm ci --no-audit --no-fund || return 1
    if [ -n "$POST_INSTALL" ]; then
      log "running POST_INSTALL"
      bash -c "$POST_INSTALL" || return 1
    fi
  fi

  if [ -z "$from" ] || ! built ||
    grep -qE '^(backend|frontend|shared)/|^package(-lock)?\.json$' <<<"$changed"; then
    log "building"
    npm run build || return 1
  fi
}

# --- deploy -------------------------------------------------------------------

acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    echo $$ >"$LOCK_DIR/pid"
    return 0
  fi
  # Clear a lock left behind by a run that was killed.
  local owner
  owner="$(cat "$LOCK_DIR/pid" 2>/dev/null)"
  if [ -n "$owner" ] && kill -0 "$owner" 2>/dev/null; then
    return 1
  fi
  rm -rf "$LOCK_DIR"
  mkdir "$LOCK_DIR" 2>/dev/null && echo $$ >"$LOCK_DIR/pid"
}

release_lock() {
  [ "$(cat "$LOCK_DIR/pid" 2>/dev/null)" = "$$" ] && rm -rf "$LOCK_DIR"
}

deploy_once() {
  if ! git fetch --quiet "$DEPLOY_REMOTE" "$DEPLOY_BRANCH" 2>>"$DEPLOY_LOG"; then
    log "could not fetch $DEPLOY_REMOTE/$DEPLOY_BRANCH (offline, or CI has not promoted a commit yet)"
    supervised || is_running || restart_app
    return 0
  fi

  local current target short
  current="$(git rev-parse HEAD)"
  target="$(git rev-parse FETCH_HEAD)"
  short="$(git rev-parse --short "$target")"

  if [ "$current" = "$target" ] || [ "$target" = "$(cat "$FAILED_FILE" 2>/dev/null)" ]; then
    # Nothing new to deploy (or the new commit already failed once): just make
    # sure the app is still running, unless a supervisor already does that.
    if ! supervised && ! is_running; then
      log "$APP_NAME is not running, starting it"
      built || build "" HEAD || return 1
      restart_app
    fi
    return 0
  fi

  if ! git diff --quiet HEAD --; then
    log "ERROR: the tablet checkout has local changes, refusing to deploy $short."
    log "       Run 'git status' in $REPO_DIR, then 'git stash' or 'git checkout -- <file>'."
    return 1
  fi

  if ! git merge-base --is-ancestor "$current" "$target"; then
    log "ERROR: $short is not a fast-forward of the tablet's commit (history was rewritten,"
    log "       or the tablet has its own commits). To take the remote version as-is:"
    log "       git -C $REPO_DIR reset --hard $DEPLOY_REMOTE/$DEPLOY_BRANCH"
    return 1
  fi

  log "deploying $short: $(git log -1 --format=%s "$target")"
  git merge --ff-only --quiet "$target" || return 1

  if build "$current" "$target" && restart_app; then
    rm -f "$FAILED_FILE"
    log "deployed $short"
    return 0
  fi

  log "ERROR: deploy of $short failed, rolling back to $(git rev-parse --short "$current")"
  echo "$target" >"$FAILED_FILE"
  git reset --hard --quiet "$current"
  if build "$target" "$current" && restart_app; then
    log "rolled back; $short will be skipped until a newer commit passes CI"
  else
    log "ERROR: rollback failed too; the app may be down. Check $APP_LOG"
  fi
  return 1
}

locked() {
  if ! acquire_lock; then
    log "another deploy is already running"
    return 0
  fi
  "$@"
  local status=$?
  release_lock
  return $status
}

watch() {
  local interval="${1:-60}" self before
  self="$REPO_DIR/scripts/tab-deploy.sh"
  before="$(cksum <"$self")"
  # On Termux, keep Android from suspending the process while the screen is off.
  command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock
  trap 'release_lock; exit 0' INT TERM
  log "watching $DEPLOY_REMOTE/$DEPLOY_BRANCH every ${interval}s"
  while true; do
    locked deploy_once
    # A deploy can bring a new version of this script; switch to it.
    if [ "$(cksum <"$self")" != "$before" ]; then
      log "tab-deploy.sh was updated, restarting the watcher"
      exec bash "$self" watch "$interval"
    fi
    sleep "$interval"
  done
}

status() {
  echo "deployed commit: $(git log -1 --format='%h %s (%cr)')"
  if [ -f "$FAILED_FILE" ]; then
    echo "skipping failed:  $(git log -1 --format='%h %s' "$(cat "$FAILED_FILE")" 2>/dev/null || cat "$FAILED_FILE")"
  fi
  if http_ok; then
    echo "app:             healthy (API :$(backend_port), web :$(frontend_port))"
  elif is_running; then
    echo "app:             running, NOT answering"
  else
    echo "app:             NOT running"
  fi
}

case "${1:-once}" in
  once) locked deploy_once ;;
  watch) watch "${2:-60}" ;;
  restart) locked restart_app ;;
  stop) stop_app && log "stopped $APP_NAME" ;;
  status) status ;;
  *)
    sed -n '/^# Usage/,/^# Settings/p' "$0" | sed '$d; s/^# \{0,1\}//'
    exit 2
    ;;
esac
