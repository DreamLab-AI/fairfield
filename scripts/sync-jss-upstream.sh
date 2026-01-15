#!/bin/bash
#
# sync-jss-upstream.sh - Pull upstream updates for JavaScriptSolidServer submodule
#
# Usage:
#   ./scripts/sync-jss-upstream.sh           # Show available tags
#   ./scripts/sync-jss-upstream.sh v0.0.XX   # Sync to specific version
#   ./scripts/sync-jss-upstream.sh latest    # Sync to latest release
#
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JSS_DIR="$PROJECT_DIR/JavaScriptSolidServer"
BACKUP_DIR="/tmp/jss-local-backup-$(date +%Y%m%d-%H%M%S)"

# Local files to preserve across syncs
LOCAL_FILES=(
    "Dockerfile.jss"
    "LOCAL_CHANGES.md"
    ".claude-flow"
)

usage() {
    echo "Usage: $0 [version|latest]"
    echo ""
    echo "Examples:"
    echo "  $0              # List available versions"
    echo "  $0 v0.0.46      # Sync to specific version"
    echo "  $0 latest       # Sync to latest release tag"
    exit 1
}

backup_local_files() {
    echo "Backing up local additions to $BACKUP_DIR..."
    mkdir -p "$BACKUP_DIR"

    for file in "${LOCAL_FILES[@]}"; do
        if [ -e "$JSS_DIR/$file" ]; then
            cp -r "$JSS_DIR/$file" "$BACKUP_DIR/"
            echo "  Backed up: $file"
        fi
    done
}

restore_local_files() {
    echo "Restoring local additions..."

    for file in "${LOCAL_FILES[@]}"; do
        if [ -e "$BACKUP_DIR/$file" ]; then
            cp -r "$BACKUP_DIR/$file" "$JSS_DIR/"
            echo "  Restored: $file"
        fi
    done
}

list_versions() {
    echo "Available JavaScriptSolidServer versions:"
    echo ""

    cd "$JSS_DIR"
    git fetch --tags 2>/dev/null || true

    # Show last 10 tags
    git tag -l 'v*' --sort=-v:refname | head -10

    echo ""
    echo "Current version:"
    git describe --tags --always 2>/dev/null || echo "  (no tag)"

    echo ""
    echo "To sync: $0 <version>"
}

sync_to_version() {
    local version="$1"

    cd "$JSS_DIR"

    # Fetch all updates
    echo "Fetching upstream updates..."
    git fetch --all --tags

    # Resolve 'latest' to actual tag
    if [ "$version" = "latest" ]; then
        version=$(git tag -l 'v*' --sort=-v:refname | head -1)
        if [ -z "$version" ]; then
            echo "Error: No version tags found"
            exit 1
        fi
        echo "Latest version: $version"
    fi

    # Check version exists
    if ! git rev-parse "$version" >/dev/null 2>&1; then
        echo "Error: Version '$version' not found"
        echo "Available versions:"
        git tag -l 'v*' --sort=-v:refname | head -5
        exit 1
    fi

    # Backup local files
    backup_local_files

    # Checkout version
    echo "Checking out $version..."
    git checkout "$version"

    # Restore local files
    restore_local_files

    # Update LOCAL_CHANGES.md with sync info
    if [ -f "$JSS_DIR/LOCAL_CHANGES.md" ]; then
        echo ""
        echo "Don't forget to update LOCAL_CHANGES.md with sync details!"
    fi

    echo ""
    echo "Sync complete to $version"
    echo ""
    echo "Next steps:"
    echo "  1. Test the build: cd JavaScriptSolidServer && npm install && npm test"
    echo "  2. Update LOCAL_CHANGES.md with sync date"
    echo "  3. Commit: git add JavaScriptSolidServer && git commit -m 'chore: sync JSS to $version'"
}

# Main
cd "$PROJECT_DIR"

# Initialize submodule if needed
if [ ! -d "$JSS_DIR/.git" ] && [ ! -f "$JSS_DIR/.git" ]; then
    echo "Initializing JSS submodule..."
    git submodule update --init --recursive JavaScriptSolidServer
fi

if [ $# -eq 0 ]; then
    list_versions
else
    sync_to_version "$1"
fi
