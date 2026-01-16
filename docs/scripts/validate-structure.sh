#!/usr/bin/env bash
# validate-structure.sh - Check documentation structure and naming
# Exit codes: 0 = success, 1 = structure errors found

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ERRORS=0
TEMP_FILE=$(mktemp)

echo "📁 Validating documentation structure..."
echo "Docs directory: $DOCS_DIR"
echo ""

# Check required top-level categories exist
REQUIRED_CATEGORIES=("tutorials" "how-to" "reference" "explanation")

for category in "${REQUIRED_CATEGORIES[@]}"; do
    if [[ ! -d "$DOCS_DIR/$category" ]]; then
        echo "❌ MISSING required category: $category/" >> "$TEMP_FILE"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check INDEX.md exists in each category
for category_dir in "$DOCS_DIR"/*/; do
    category=$(basename "$category_dir")

    # Skip non-category directories
    if [[ "$category" =~ ^(scripts|assets|images)$ ]]; then
        continue
    fi

    if [[ ! -f "$category_dir/INDEX.md" ]]; then
        echo "❌ MISSING INDEX.md in $category/" >> "$TEMP_FILE"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check file naming conventions (kebab-case, lowercase)
find "$DOCS_DIR" -type f -name "*.md" | while read -r file; do
    basename=$(basename "$file" .md)

    # Skip special files
    if [[ "$basename" =~ ^(README|INDEX|CONTRIBUTING|MAINTENANCE)$ ]]; then
        continue
    fi

    # Check for uppercase letters
    if [[ "$basename" =~ [A-Z] ]]; then
        echo "❌ UPPERCASE in filename: $file (use kebab-case)" >> "$TEMP_FILE"
        ERRORS=$((ERRORS + 1))
    fi

    # Check for underscores (should use hyphens)
    if [[ "$basename" =~ _ ]]; then
        echo "❌ UNDERSCORES in filename: $file (use hyphens)" >> "$TEMP_FILE"
        ERRORS=$((ERRORS + 1))
    fi

    # Check for spaces
    if [[ "$basename" =~ \  ]]; then
        echo "❌ SPACES in filename: $file (use hyphens)" >> "$TEMP_FILE"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check nesting depth (max 3 levels: category/subcategory/file.md)
find "$DOCS_DIR" -type f -name "*.md" | while read -r file; do
    relative_path="${file#$DOCS_DIR/}"
    depth=$(echo "$relative_path" | tr -cd '/' | wc -c)

    if [[ $depth -gt 2 ]]; then
        echo "❌ TOO DEEP: $relative_path (max 2 levels: category/subcategory/file.md)" >> "$TEMP_FILE"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check for orphaned files (not referenced in any INDEX.md)
find "$DOCS_DIR" -type f -name "*.md" ! -name "INDEX.md" ! -name "README.md" | while read -r file; do
    basename=$(basename "$file")
    relative_path="${file#$DOCS_DIR/}"

    # Search for references in INDEX.md files
    referenced=0
    find "$DOCS_DIR" -type f -name "INDEX.md" | while read -r index; do
        if grep -q "$basename" "$index" 2>/dev/null; then
            referenced=1
            break
        fi
    done

    if [[ $referenced -eq 0 ]]; then
        echo "⚠️  WARNING: Orphaned file (not in any INDEX.md): $relative_path" >> "$TEMP_FILE"
    fi
done

if [[ -s "$TEMP_FILE" ]]; then
    cat "$TEMP_FILE"
    rm "$TEMP_FILE"
    echo ""
    echo "❌ Found $ERRORS structure error(s)"
    exit 1
else
    rm "$TEMP_FILE"
    echo "✅ Documentation structure valid"
    exit 0
fi
