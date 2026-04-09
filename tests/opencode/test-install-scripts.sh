#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

TEST_HOME=$(mktemp -d)
cleanup() {
    rm -rf "$TEST_HOME"
}
trap cleanup EXIT

export HOME="$TEST_HOME"
export XDG_CONFIG_HOME="$TEST_HOME/.config"
export OPENCODE_CONFIG_DIR="$TEST_HOME/.config/opencode"

PLUGIN_FILE="$OPENCODE_CONFIG_DIR/plugins/know-how.js"
BUNDLE_DIR="$OPENCODE_CONFIG_DIR/know-how"
SKILLS_DIR="$BUNDLE_DIR/skills"

fail() {
    echo "  [FAIL] $1"
    exit 1
}

echo "=== Test: Install Scripts ==="

echo "Test 1: Running install creates bundled files..."
"$REPO_ROOT/scripts/install"

[ -f "$PLUGIN_FILE" ] || fail "Plugin file missing after install"
[ -f "$SKILLS_DIR/using-know-how/SKILL.md" ] || fail "Bundled skills missing after install"
echo "  [PASS] Install created plugin and bundled skills"

echo "Test 2: Re-running install removes stale bundled content..."
mkdir -p "$SKILLS_DIR/stale-skill"
printf '%s\n' 'STALE_MARKER' > "$SKILLS_DIR/stale-skill/SKILL.md"

"$REPO_ROOT/scripts/install"

if [ -e "$SKILLS_DIR/stale-skill/SKILL.md" ]; then
    fail "Stale bundled content survived reinstall"
fi
echo "  [PASS] Reinstall replaced the bundle"

echo "Test 3: Uninstall removes managed files..."
"$REPO_ROOT/scripts/uninstall"

if [ -e "$PLUGIN_FILE" ]; then
    fail "Plugin file still exists after uninstall"
fi

if [ -e "$BUNDLE_DIR" ]; then
    fail "Bundle directory still exists after uninstall"
fi
echo "  [PASS] Uninstall removed managed files"

echo "Test 4: Uninstall is safe to rerun..."
"$REPO_ROOT/scripts/uninstall"
echo "  [PASS] Repeated uninstall succeeded"

echo "=== All install script tests passed ==="
