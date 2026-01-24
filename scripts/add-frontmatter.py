#!/usr/bin/env python3
"""Add YAML front matter to documentation files."""

import os
import re
from pathlib import Path
from datetime import date

# Standard tags vocabulary
STANDARD_TAGS = {
    # Audience
    'user', 'developer', 'architect', 'devops', 'admin',
    # Topic
    'nostr', 'authentication', 'messaging', 'channels', 'security', 'deployment',
    # Type
    'guide', 'reference', 'tutorial', 'concept', 'api', 'config',
    # Feature
    'dm', 'search', 'calendar', 'zones', 'pwa',
    # Specific
    'architecture', 'adr', 'ddd', 'documentation'
}

# File-specific metadata mappings
METADATA_MAP = {
    'adr/002-three-tier-hierarchy.md': {
        'title': 'ADR-002: Three-Tier BBS Hierarchy',
        'description': 'Decision to use three-tier hierarchy (Zone/Section/Forum) for BBS organization',
        'category': 'reference',
        'tags': ['adr', 'architecture', 'nostr', 'channels', 'design'],
        'difficulty': 'advanced'
    },
    'adr/003-gcp-cloud-run-infrastructure.md': {
        'title': 'ADR-003: GCP Cloud Run Infrastructure',
        'description': 'Decision to deploy relay on Google Cloud Run with PostgreSQL storage',
        'category': 'reference',
        'tags': ['adr', 'deployment', 'gcp', 'infrastructure', 'devops'],
        'difficulty': 'advanced'
    },
    'adr/004-zone-based-access-control.md': {
        'title': 'ADR-004: Zone-Based Access Control',
        'description': 'Decision to implement zone-based cohort access control using admin whitelists',
        'category': 'reference',
        'tags': ['adr', 'security', 'access-control', 'zones', 'admin'],
        'difficulty': 'advanced'
    },
    'adr/005-nip-44-encryption-mandate.md': {
        'title': 'ADR-005: NIP-44 Encryption Mandate',
        'description': 'Decision to mandate NIP-44 encryption for all new encrypted content',
        'category': 'reference',
        'tags': ['adr', 'security', 'encryption', 'nostr', 'nip-44'],
        'difficulty': 'advanced'
    },
    'adr/006-client-side-wasm-search.md': {
        'title': 'ADR-006: Client-Side WASM Search',
        'description': 'Decision to implement client-side semantic search using WASM and HNSW indexing',
        'category': 'reference',
        'tags': ['adr', 'search', 'wasm', 'performance', 'pwa'],
        'difficulty': 'advanced'
    },
    'adr/007-sveltekit-ndk-frontend.md': {
        'title': 'ADR-007: SvelteKit + NDK Frontend',
        'description': 'Decision to use SvelteKit with NDK for frontend development',
        'category': 'reference',
        'tags': ['adr', 'architecture', 'frontend', 'svelte', 'ndk'],
        'difficulty': 'intermediate'
    },
    'adr/008-postgresql-relay-storage.md': {
        'title': 'ADR-008: PostgreSQL Relay Storage',
        'description': 'Decision to use PostgreSQL for relay event storage with strfry',
        'category': 'reference',
        'tags': ['adr', 'database', 'postgresql', 'relay', 'storage'],
        'difficulty': 'advanced'
    },
    'adr/009-user-registration-flow.md': {
        'title': 'ADR-009: User Registration Flow',
        'description': 'Decision on simplified user registration with password-based key derivation',
        'category': 'reference',
        'tags': ['adr', 'authentication', 'user', 'registration', 'security'],
        'difficulty': 'intermediate'
    },
}

def has_frontmatter(filepath):
    """Check if file already has YAML front matter."""
    with open(filepath, 'r', encoding='utf-8') as f:
        first_line = f.readline()
    return first_line.strip() == '---'

def extract_title_from_heading(content):
    """Extract title from first H1 heading."""
    match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    return match.group(1).strip() if match else None

def infer_category(filepath):
    """Infer Diataxis category from file path and content."""
    path_str = str(filepath).lower()

    # Path-based inference
    if 'tutorial' in path_str or 'getting-started' in path_str:
        return 'tutorial'
    if 'howto' in path_str or 'guide' in path_str:
        return 'howto'
    if 'reference' in path_str or 'api' in path_str or 'adr' in path_str:
        return 'reference'
    if 'explanation' in path_str or 'architecture' in path_str or 'ddd' in path_str:
        return 'explanation'

    # Default based on audience
    if 'user' in path_str:
        return 'tutorial'
    if 'developer' in path_str:
        return 'reference'

    return 'reference'

def infer_tags(filepath, title):
    """Infer tags from file path and title."""
    tags = set()
    path_str = str(filepath).lower()
    title_lower = title.lower() if title else ''

    # Audience tags
    if 'user' in path_str:
        tags.add('user')
    if 'developer' in path_str or 'dev' in path_str:
        tags.add('developer')
    if 'admin' in path_str:
        tags.add('admin')

    # Topic tags
    if 'nostr' in path_str or 'nostr' in title_lower:
        tags.add('nostr')
    if 'auth' in path_str or 'auth' in title_lower:
        tags.add('authentication')
    if 'message' in path_str or 'dm' in path_str:
        tags.add('messaging')
    if 'channel' in path_str or 'chat' in path_str:
        tags.add('channels')
    if 'security' in path_str or 'security' in title_lower:
        tags.add('security')
    if 'deploy' in path_str:
        tags.add('deployment')

    # Type tags
    if 'adr' in path_str:
        tags.add('adr')
    if 'architecture' in path_str or 'architecture' in title_lower:
        tags.add('architecture')
    if 'ddd' in path_str:
        tags.add('ddd')
    if 'guide' in path_str or 'guide' in title_lower:
        tags.add('guide')
    if 'reference' in path_str or 'api' in path_str:
        tags.add('reference')

    # Feature tags
    if 'calendar' in path_str or 'event' in path_str:
        tags.add('calendar')
    if 'search' in path_str:
        tags.add('search')
    if 'zone' in path_str:
        tags.add('zones')
    if 'pwa' in path_str:
        tags.add('pwa')

    # Ensure at least 2 tags
    if len(tags) == 0:
        tags.add('documentation')
    if len(tags) == 1:
        tags.add('guide')

    return sorted(list(tags))

def infer_difficulty(filepath):
    """Infer difficulty level from file path."""
    path_str = str(filepath).lower()

    if 'user' in path_str or 'getting-started' in path_str:
        return 'beginner'
    if 'adr' in path_str or 'architecture' in path_str or 'ddd' in path_str:
        return 'advanced'
    if 'developer' in path_str:
        return 'intermediate'

    return None  # Optional field

def create_frontmatter(filepath, content):
    """Create YAML front matter for a file."""
    relative_path = str(filepath).replace('/home/devuser/workspace/project2/docs/', '')

    # Check for pre-defined metadata
    if relative_path in METADATA_MAP:
        meta = METADATA_MAP[relative_path]
        title = meta['title']
        description = meta['description']
        category = meta['category']
        tags = meta['tags']
        difficulty = meta.get('difficulty')
    else:
        # Extract title from content
        title = extract_title_from_heading(content)
        if not title:
            title = filepath.stem.replace('-', ' ').replace('_', ' ').title()

        # Generate description (first paragraph or from title)
        desc_match = re.search(r'^(?:#.*?\n+)?(.+?)(?:\n\n|\n##)', content, re.MULTILINE | re.DOTALL)
        if desc_match:
            description = desc_match.group(1).strip()
            description = re.sub(r'\s+', ' ', description)[:200]
        else:
            description = f"{title} documentation"

        category = infer_category(filepath)
        tags = infer_tags(filepath, title)
        difficulty = infer_difficulty(filepath)

    # Build frontmatter
    frontmatter = f"""---
title: "{title}"
description: "{description}"
category: {category}
tags: {tags}
"""

    if difficulty:
        frontmatter += f"difficulty: {difficulty}\n"

    frontmatter += f"last-updated: {date.today().isoformat()}\n"
    frontmatter += "---\n\n"

    return frontmatter

def add_frontmatter_to_file(filepath):
    """Add frontmatter to a single file."""
    if has_frontmatter(filepath):
        return False

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    frontmatter = create_frontmatter(filepath, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(frontmatter + content)

    return True

def main():
    """Process all markdown files in docs directory."""
    docs_dir = Path('/home/devuser/workspace/project2/docs')
    updated_files = []

    for md_file in docs_dir.rglob('*.md'):
        if add_frontmatter_to_file(md_file):
            relative_path = md_file.relative_to(docs_dir)
            updated_files.append(str(relative_path))
            print(f"✓ {relative_path}")

    print(f"\n\nUpdated {len(updated_files)} files")

    if updated_files:
        print("\nUpdated files:")
        for f in sorted(updated_files):
            print(f"  - {f}")

if __name__ == '__main__':
    main()
