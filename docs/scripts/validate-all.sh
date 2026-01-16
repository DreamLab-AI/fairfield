#!/usr/bin/env bash
# validate-all.sh - Run all documentation validators
# Exit codes: 0 = all pass, 1 = any validation failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

EXIT_CODE=0

echo "╔══════════════════════════════════════════════════════════╗"
echo "║          Documentation Validation Suite                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# 1. Structure validation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1/4 Structure Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if bash "$SCRIPT_DIR/validate-structure.sh"; then
    echo ""
else
    EXIT_CODE=1
    echo ""
fi

# 2. Front matter validation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2/4 Front Matter Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if bash "$SCRIPT_DIR/validate-frontmatter.sh"; then
    echo ""
else
    EXIT_CODE=1
    echo ""
fi

# 3. Link validation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3/4 Link Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if bash "$SCRIPT_DIR/validate-links.sh"; then
    echo ""
else
    EXIT_CODE=1
    echo ""
fi

# 4. Spelling validation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4/4 UK English Spelling Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if bash "$SCRIPT_DIR/validate-spelling.sh"; then
    echo ""
else
    EXIT_CODE=1
    echo ""
fi

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ $EXIT_CODE -eq 0 ]]; then
    echo "✅ ALL VALIDATIONS PASSED"
else
    echo "❌ VALIDATION FAILED - See errors above"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $EXIT_CODE
