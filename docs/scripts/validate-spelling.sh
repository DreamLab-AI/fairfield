#!/usr/bin/env bash
# validate-spelling.sh - Check UK English spelling in documentation
# Exit codes: 0 = success, 1 = spelling errors found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ERRORS=0
TEMP_FILE=$(mktemp)

echo "🔤 Validating UK English spelling..."
echo "Docs directory: $DOCS_DIR"
echo ""

# Common US vs UK spelling patterns (US -> UK)
declare -A SPELLING_RULES=(
    ["behavior"]="behaviour"
    ["color"]="colour"
    ["favor"]="favour"
    ["honor"]="honour"
    ["labor"]="labour"
    ["neighbor"]="neighbour"
    ["optimize"]="optimise"
    ["organize"]="organise"
    ["recognize"]="recognise"
    ["realize"]="realise"
    ["analyze"]="analyse"
    ["paralyze"]="paralyse"
    ["center"]="centre"
    ["fiber"]="fibre"
    ["theater"]="theatre"
    ["defense"]="defence"
    ["offense"]="offence"
    ["license"]="licence"  # noun only
    ["practice"]="practise"  # verb only
)

# Exceptions (US spelling OK in these contexts)
EXCEPTIONS_FILE="$SCRIPT_DIR/spelling-exceptions.txt"
if [[ ! -f "$EXCEPTIONS_FILE" ]]; then
    cat > "$EXCEPTIONS_FILE" << 'EOF'
# Code identifiers, API names, library names
color # CSS property
backgroundColor # JavaScript
optimize # npm packages
organization # GitHub API
EOF
fi

find "$DOCS_DIR" -type f -name "*.md" | while read -r file; do
    for us_word in "${!SPELLING_RULES[@]}"; do
        uk_word="${SPELLING_RULES[$us_word]}"

        # Check if exception
        if grep -qw "$us_word" "$EXCEPTIONS_FILE" 2>/dev/null; then
            continue
        fi

        # Find US spelling in prose (not in code blocks or inline code)
        # This is a simplified check - excludes lines with ` or indented code
        matches=$(grep -nw "$us_word" "$file" 2>/dev/null | grep -v '`' | grep -v '    ' || true)

        if [[ -n "$matches" ]]; then
            echo "❌ US SPELLING '$us_word' (use '$uk_word') in $file:" >> "$TEMP_FILE"
            echo "$matches" | head -n 3 >> "$TEMP_FILE"
            echo "" >> "$TEMP_FILE"
            ERRORS=$((ERRORS + 1))
        fi
    done
done

if [[ -s "$TEMP_FILE" ]]; then
    cat "$TEMP_FILE"
    rm "$TEMP_FILE"
    echo "❌ Found $ERRORS UK English spelling issue(s)"
    echo ""
    echo "Note: Add legitimate exceptions to docs/scripts/spelling-exceptions.txt"
    exit 1
else
    rm "$TEMP_FILE"
    echo "✅ UK English spelling validated"
    exit 0
fi
