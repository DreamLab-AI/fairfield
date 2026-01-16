#!/usr/bin/env bash
# validate-frontmatter.sh - Check YAML front matter in documentation
# Exit codes: 0 = success, 1 = validation errors found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ERRORS=0
TEMP_FILE=$(mktemp)

echo "📋 Validating YAML front matter..."
echo "Docs directory: $DOCS_DIR"
echo ""

# Required fields for different document types
declare -A REQUIRED_FIELDS=(
    ["tutorials"]="title,description,category,difficulty,duration,prerequisites"
    ["how-to"]="title,description,category,applies_to"
    ["reference"]="title,description,category,type"
    ["explanation"]="title,description,category,concepts"
)

find "$DOCS_DIR" -type f -name "*.md" | while read -r file; do
    # Skip files without front matter
    if ! grep -q "^---$" "$file" 2>/dev/null; then
        continue
    fi

    # Extract front matter (between first two ---)
    frontmatter=$(awk '/^---$/{if(++count==2) exit; next} count==1' "$file")

    if [[ -z "$frontmatter" ]]; then
        echo "⚠️  WARNING: Empty front matter in $file" >> "$TEMP_FILE"
        continue
    fi

    # Determine document category from path
    doc_type=""
    for category in tutorials how-to reference explanation; do
        if [[ "$file" == *"/$category/"* ]]; then
            doc_type="$category"
            break
        fi
    done

    if [[ -z "$doc_type" ]]; then
        continue
    fi

    # Check required fields
    required="${REQUIRED_FIELDS[$doc_type]}"
    IFS=',' read -ra fields <<< "$required"

    for field in "${fields[@]}"; do
        if ! echo "$frontmatter" | grep -q "^$field:"; then
            echo "❌ MISSING FIELD '$field' in $file" >> "$TEMP_FILE"
            ERRORS=$((ERRORS + 1))
        fi
    done

    # Validate enum values
    if echo "$frontmatter" | grep -q "^difficulty:"; then
        difficulty=$(echo "$frontmatter" | grep "^difficulty:" | cut -d: -f2- | xargs)
        if [[ ! "$difficulty" =~ ^(beginner|intermediate|advanced)$ ]]; then
            echo "❌ INVALID difficulty '$difficulty' in $file (must be: beginner, intermediate, advanced)" >> "$TEMP_FILE"
            ERRORS=$((ERRORS + 1))
        fi
    fi

    if echo "$frontmatter" | grep -q "^type:"; then
        type=$(echo "$frontmatter" | grep "^type:" | cut -d: -f2- | xargs)
        if [[ ! "$type" =~ ^(api|cli|architecture|glossary)$ ]]; then
            echo "❌ INVALID type '$type' in $file (must be: api, cli, architecture, glossary)" >> "$TEMP_FILE"
            ERRORS=$((ERRORS + 1))
        fi
    fi
done

if [[ -s "$TEMP_FILE" ]]; then
    cat "$TEMP_FILE"
    rm "$TEMP_FILE"
    echo ""
    echo "❌ Found $ERRORS front matter error(s)"
    exit 1
else
    rm "$TEMP_FILE"
    echo "✅ All front matter valid"
    exit 0
fi
