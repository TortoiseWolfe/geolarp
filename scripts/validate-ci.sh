#!/bin/bash

# CI Validation Script
# Runs the CI checks locally to catch issues before pushing to GitHub.
#
# Approximates the GitHub Actions pipeline; it is not a mirror of it. ci.yml has
# steps this lacks (detect-project, test:scripts), and the chunk-parse check
# below lives in deploy.yml rather than ci.yml. Treat a green run here as "very
# likely green in CI", not a guarantee.

set -e  # Exit on any error

echo "🚀 Starting CI Validation..."
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if we're in Docker or not
if [ -f /.dockerenv ]; then
    IN_DOCKER=true
else
    IN_DOCKER=false
fi

# A LINKED WORKTREE MUST NOT `docker compose exec` (#22).
#
# `exec` enters the running container, whose /app is the PRIMARY checkout. From a
# worktree there are exactly two ways to make that command succeed and BOTH ARE WRONG:
#
#   1. Give the worktree its own COMPOSE_PROJECT_NAME — `exec` targets a project with
#      no running container, and it fails anyway.
#   2. Give the worktree a .env naming the PRIMARY project — `exec` succeeds against a
#      container whose /app is somebody else's tree. Every check then passes or fails on
#      code that is not what you are pushing.
#
# The second is the dangerous one, and it is easy to reach by copying .env — which is
# exactly why CLAUDE.md says never to copy it verbatim into a worktree. A green pre-push
# that validated the wrong tree is worse than no pre-push.
#
# `git rev-parse` disagrees with itself in a linked worktree: --git-dir is the worktree's
# own directory, --git-common-dir the shared one. Same test `.husky/pre-commit` and
# `.husky/pre-push` already use.
in_worktree() {
    [ "$(git rev-parse --git-dir 2>/dev/null)" != "$(git rev-parse --git-common-dir 2>/dev/null)" ]
}

IN_WORKTREE=false
if [ "$IN_DOCKER" = false ] && in_worktree; then
    IN_WORKTREE=true
fi
SKIPPED_IN_WORKTREE=0

# NOTE: do NOT add a `rm -rf .next` here. This script used to open with one
# (exec'd into the live dev container, so it wiped the running dev server's
# .next and 500'd every route on every push — #293). Its stated reason,
# "avoid permission issues", was obsolete: docker/Dockerfile:117-119 pre-creates
# /app/.next node-owned. Nothing below needs a clean .next — `next build` cleans
# its own distDir (cleanDistDir), and it now runs in its own container anyway.

# Function to run a check
run_check() {
    local name=$1
    local command=$2

    echo -e "\n${YELLOW}🔍 Running: ${name}${NC}"
    echo "--------------------------------"

    if [ "$IN_DOCKER" = true ]; then
        # Running inside Docker, execute directly
        if $command; then
            echo -e "${GREEN}✅ ${name} passed${NC}"
        else
            echo -e "${RED}❌ ${name} failed${NC}"
            exit 1
        fi
    elif [ "$IN_WORKTREE" = true ]; then
        # SKIPPED, NOT FAILED, and the distinction is the whole point of #22. The old
        # behaviour let `docker compose exec` fail on a missing .env and reported
        # "❌ ESLint failed" — which reads as though ESLint found problems in the code
        # being pushed. It had not run at all.
        echo -e "${YELLOW}⚠️  Skipped: this is a git worktree.${NC}"
        echo "   \`docker compose exec\` would run this against the PRIMARY checkout's"
        echo "   /app, not the tree you are pushing, so a pass would mean nothing."
        echo "   Run it by hand from the primary checkout, or from inside the container:"
        echo "     docker compose exec geolarp $command"
        SKIPPED_IN_WORKTREE=$((SKIPPED_IN_WORKTREE + 1))
    else
        # Running outside Docker, use docker compose exec
        if docker compose exec -T geolarp $command; then
            echo -e "${GREEN}✅ ${name} passed${NC}"
        else
            echo -e "${RED}❌ ${name} failed${NC}"
            exit 1
        fi
    fi
}

# Same, but runs the command verbatim on the host rather than exec'ing it into
# the dev container — for steps that drive docker themselves.
run_host_check() {
    local name=$1
    local command=$2

    echo -e "\n${YELLOW}🔍 Running: ${name}${NC}"
    echo "--------------------------------"

    # ALSO GUARDED, and the first version of this fix was not. These steps drive
    # `docker compose` themselves rather than exec'ing into it, so they looked exempt —
    # but a worktree has no .env, compose cannot resolve a project, and the failure
    # surfaced as "❌ Production build failed": the same shape as the ESLint message
    # this ticket is about, one function down. Caught by running the fix in a real
    # worktree instead of reasoning about it.
    if [ "$IN_WORKTREE" = true ]; then
        echo -e "${YELLOW}⚠️  Skipped: this is a git worktree.${NC}"
        echo "   This step drives \`docker compose\`, which needs a .env this worktree"
        echo "   does not have — and copying one in would point it at the primary"
        echo "   project's containers. Run it from the primary checkout."
        SKIPPED_IN_WORKTREE=$((SKIPPED_IN_WORKTREE + 1))
        return 0
    fi

    if $command; then
        echo -e "${GREEN}✅ ${name} passed${NC}"
    else
        echo -e "${RED}❌ ${name} failed${NC}"
        exit 1
    fi
}

# 1. Lint check
run_check "ESLint" "pnpm lint"

# 2. Type check
run_check "TypeScript type check" "pnpm type-check"

# 2b. Breakpoint drift. The script existed and already failed — CSS said the `sm`
# breakpoint was 430px while src/config/breakpoints.ts said 428px — and it was
# wired into no workflow and no hook, so nothing ever ran it (#373 B2).
run_check "Breakpoint config" "pnpm validate:breakpoints"

# 3. Unit tests — FULL RUN ONLY, never under --quick.
#
# --quick is what .husky/pre-push invokes, on every single push. This step is
# ~3m45s and `Test (20.x)` re-runs the identical suite minutes later; it is the
# largest single duplication in the loop (#573). The fast checks above (lint,
# type-check, breakpoints — ~37s combined) stay, because catching a typo before
# burning a CI slot is worth 37 seconds. Re-running 4282 tests to learn what CI
# will tell you anyway is not.
#
# This also removes a reason to reach for `git push --no-verify`, which
# pre-push's own help text advertises — a gate routinely bypassed is not a gate.
if [ "$1" != "--quick" ]; then
    run_check "Unit tests" "pnpm test --run"
    run_check "Test coverage" "pnpm test:coverage"
fi

# 5. Production build — in its OWN container (#293).
#
# This must never be `docker compose exec geolarp pnpm build`. That is the
# dev server's container; `next dev` and `next build` both own /app/.next, so the
# build wipes what the dev server is serving and every route 500s until it
# recompiles. That is what this script did on every push for months.
#
# The `builder` service is the same image with its own .next volume, so the two
# cannot collide. out/ still lands on the bind mount, so the chunk check below
# sees this build's output exactly as it would in CI.
if [ "$IN_DOCKER" = true ]; then
    # Already inside a container. That is fine — UNLESS it is the one serving
    # `next dev`, which is precisely the collision above. Check for the dev
    # server rather than for "am I in Docker": running this inside the builder
    # container is legitimate, running it inside the dev container is the bug.
    if pgrep -f 'next-server|next/dist/bin/next' >/dev/null 2>&1; then
        echo -e "\n${RED}❌ Refusing to build inside the dev-server container (#293).${NC}"
        echo -e "   It would wipe the .next this container is serving from and"
        echo -e "   500 every route. Run it from the host instead:"
        echo -e "     ${YELLOW}./scripts/validate-ci.sh $*${NC}"
        exit 1
    fi
    run_check "Production build" "pnpm build"
else
    run_host_check "Production build" "docker compose run --rm builder pnpm build"
fi

# 5b. Browser-parseability of emitted chunks (#294). `next build` succeeds even
# when it emits a chunk the browser cannot PARSE (e.g. an inlined WASM binary as
# a template literal with octal escapes). That passes every check above and only
# fails at browser parse time — killing client JS on every route. This gate is
# the one that catches it.
run_check "Chunk parse check (#294)" "node scripts/check-chunks-parse.mjs"

# 5c. First-load budget (#291): three.js (2.66MB) must not ship in the initial
# payload of any non-3D route. `next build` never measured first-load JS, so
# three silently rode the initial vendor chunk on every route. This gate fails
# the push if it regresses (a lost cacheGroup entry or a new static three import).
run_check "First-load budget (#291)" "node scripts/check-first-load-budget.mjs"

# 6. Storybook build (optional - can be slow)
if [ "$1" != "--quick" ]; then
    run_check "Storybook build" "pnpm build-storybook"
fi

echo -e "\n================================"
if [ "$SKIPPED_IN_WORKTREE" -gt 0 ]; then
    # A GREEN THAT MEANS NOTHING IS WORSE THAN A RED (#22). Every check above ran
    # against the primary checkout or not at all, so "all passed" would be a claim
    # about a tree nobody is pushing. Say the number, and do not say "safe".
    echo -e "${YELLOW}⚠️  ${SKIPPED_IN_WORKTREE} check(s) SKIPPED — this is a git worktree.${NC}"
    echo -e "   Nothing above validated the code you are pushing."
    echo -e "   CLAUDE.md's worktree rule applies: run the equivalent checks by hand"
    echo -e "   and say so, rather than treating this as a pass.\n"
else
    echo -e "${GREEN}🎉 All CI checks passed!${NC}"
    echo -e "Safe to push to GitHub.\n"
fi