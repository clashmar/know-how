#!/usr/bin/env bash
# Test: Plugin Loading
# Verifies that the know-how plugin loads correctly in OpenCode
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Test: Plugin Loading ==="

# Source setup to create isolated environment
source "$SCRIPT_DIR/setup.sh"

# Trap to cleanup on exit
trap cleanup_test_env EXIT

plugin_file="$OPENCODE_CONFIG_DIR/plugins/know-how.js"

# Test 1: Verify installer-managed plugin layout exists
echo "Test 1: Checking installer-managed plugin layout..."
if [ -f "$plugin_file" ]; then
    echo "  [PASS] Plugin file exists"
else
    echo "  [FAIL] Plugin file not found at $plugin_file"
    exit 1
fi

# Verify installer-managed bundled skills directory exists
if [ -d "$SKILLS_DIR" ]; then
    echo "  [PASS] Bundled skills directory exists"
else
    echo "  [FAIL] Bundled skills directory does not exist"
    exit 1
fi

# Test 2: Verify installed bundle is populated
echo "Test 2: Checking installed skills bundle..."
skill_count=$(find "$SKILLS_DIR" -name "SKILL.md" | wc -l)
if [ "$skill_count" -gt 0 ]; then
    echo "  [PASS] Found $skill_count skills"
else
    echo "  [FAIL] No skills found in $SKILLS_DIR"
    exit 1
fi

# Test 3: Check using-know-how skill exists (critical for bootstrap)
echo "Test 3: Checking using-know-how skill (required for bootstrap)..."
if [ -f "$SKILLS_DIR/using-know-how/SKILL.md" ]; then
    echo "  [PASS] using-know-how skill exists"
else
    echo "  [FAIL] using-know-how skill not found (required for bootstrap)"
    exit 1
fi

# Test 4: Verify plugin JavaScript syntax (basic check)
echo "Test 4: Checking plugin JavaScript syntax..."
if node --check "$PLUGIN_FILE" 2>/dev/null; then
    echo "  [PASS] Plugin JavaScript syntax is valid"
else
    echo "  [FAIL] Plugin has JavaScript syntax errors"
    exit 1
fi

# Test 5: Verify bootstrap references the renamed starter skill
echo "Test 5: Checking bootstrap references using-know-how..."
if grep -qi 'using-know-how' "$PLUGIN_FILE"; then
    echo "  [PASS] Plugin references the renamed starter skill"
else
    echo "  [FAIL] Plugin does not reference using-know-how"
    exit 1
fi

# Test 6: Verify bootstrap text does not reference a misleading old path
echo "Test 6: Checking bootstrap does not advertise a wrong skills path..."
if grep -qi 'skills/legacy-plugin-name' "$PLUGIN_FILE"; then
    echo "  [FAIL] Plugin still references old skills path"
    exit 1
else
    echo "  [PASS] Plugin does not advertise a misleading skills path"
fi

# Test 7: Verify personal test skill was created
echo "Test 7: Checking test fixtures..."
if [ -f "$OPENCODE_CONFIG_DIR/skills/personal-test/SKILL.md" ]; then
    echo "  [PASS] Personal test skill fixture created"
else
    echo "  [FAIL] Personal test skill fixture not found"
    exit 1
fi

echo ""
echo "=== All plugin loading tests passed ==="
