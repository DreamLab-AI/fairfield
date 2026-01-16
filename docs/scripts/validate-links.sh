#!/usr/bin/env bash
# validate-links.sh - Check all internal documentation links
# Exit codes: 0 = success, 1 = broken links found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$DOCS_DIR/.." && pwd)"

BROKEN_LINKS=0
TEMP_FILE=$(mktemp)

echo "🔗 Validating internal documentation links..."
echo "Docs directory: $DOCS_DIR"
echo ""

# Find all markdown files
find "$DOCS_DIR" -type f -name "*.md" | while read -r file; do
    # Extract all markdown links [text](path)
    grep -oP '\]\(\K[^)]+' "$file" 2>/dev/null || true | while read -r link; do
        # Skip external URLs
        if [[ "$link" =~ ^https?:// ]]; then
            continue
        fi

        # Skip anchors only
        if [[ "$link" =~ ^# ]]; then
            continue
        fi

        # Resolve relative path
        file_dir="$(dirname "$file")"

        # Remove anchor if present
        link_path="${link%%#*}"

        # Skip empty paths
        if [[ -z "$link_path" ]]; then
            continue
        fi

        # Check if target exists
        if [[ "$link_path" == /* ]]; then
            # Absolute path from project root
            target="$PROJECT_ROOT$link_path"
        else
            # Relative path from current file
            target="$(cd "$file_dir" && realpath -m "$link_path" 2>/dev/null || echo "INVALID")"
        fi

        if [[ ! -e "$target" ]]; then
            echo "❌ BROKEN LINK in $file" >> "$TEMP_FILE"
            echo "   Target: $link" >> "$TEMP_FILE"
            echo "   Resolved: $target" >> "$TEMP_FILE"
            echo "" >> "$TEMP_FILE"
            BROKEN_LINKS=$((BROKEN_LINKS + 1))
        fi
    done
done

if [[ -s "$TEMP_FILE" ]]; then
    cat "$TEMP_FILE"
    rm "$TEMP_FILE"
    echo "❌ Found $BROKEN_LINKS broken link(s)"
    exit 1
else
    rm "$TEMP_FILE"
    echo "✅ All internal links valid"
    exit 0
fi
