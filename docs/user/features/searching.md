---
title: "Searching"
description: "Find messages, people, events, and content across your zones."
category: tutorial
tags: ['developer', 'search', 'user']
difficulty: beginner
last-updated: 2026-01-16
---

# Searching

Find messages, people, events, and content across your zones.

---

## Quick Search

### Opening Search

Press `Ctrl + K` (or `Cmd + K` on Mac) or click the search icon (🔍) in the header.

### Basic Search

1. Type your search terms
2. Results appear as you type
3. Click a result to jump to it

---

## What You Can Search

| Content Type | Examples |
|--------------|----------|
| **Messages** | Channel posts, replies |
| **People** | Display names, usernames |
| **Events** | Calendar events, gatherings |
| **Channels** | Channel names, descriptions |

---

## Search Tips

### Finding Messages

| Goal | Search Example |
|------|----------------|
| Exact phrase | `"coffee morning"` |
| From someone | `from:Alice` |
| In a channel | `in:#events` |
| With a link | `has:link` |
| Recent | `after:yesterday` |

### Finding People

Search by:
- Display name: `Alice Smith`
- Username: `@alice`
- Part of name: `ali`

### Finding Events

Search by:
- Event title: `Monthly meetup`
- Location: `Manchester`
- Date: `January`

---

## Filtering Results

### By Type

After searching, filter results by:
- **All** — Everything
- **Messages** — Channel posts only
- **People** — User profiles only
- **Events** — Calendar events only

### By Zone

If you're in multiple zones, results show which zone each item belongs to. Click a zone filter to narrow down.

### By Date

| Filter | Shows |
|--------|-------|
| **Any time** | All results |
| **Today** | Last 24 hours |
| **This week** | Last 7 days |
| **This month** | Last 30 days |
| **Custom** | Your chosen range |

---

## Search Results

### Message Results

Each message result shows:
- Sender's name and picture
- Message preview with highlighted matches
- Channel and timestamp
- Click to jump to the full message in context

### People Results

Each person result shows:
- Profile picture
- Display name and username
- Which zones you share
- Click to view their profile

### Event Results

Each event result shows:
- Event title
- Date and time
- Location
- Click to see full details

---

## Advanced Search

### Combining Filters

Combine multiple filters for precise results:

```
from:Alice in:#general after:2024-01-01 "project update"
```

This finds messages from Alice in #general since January 2024 containing "project update".

### Search Operators

| Operator | Purpose | Example |
|----------|---------|---------|
| `"..."` | Exact phrase | `"next meeting"` |
| `from:` | Specific sender | `from:Bob` |
| `in:` | Specific channel | `in:#announcements` |
| `has:` | Contains type | `has:link` |
| `before:` | Before date | `before:2024-06-01` |
| `after:` | After date | `after:yesterday` |

---

## Search History

### Recent Searches

Your recent searches appear when you open the search box:
- Click a recent search to run it again
- Clear individual searches or all history

### Saved Searches

For searches you run frequently:
1. Run your search
2. Click **Save Search**
3. Give it a name
4. Access from your saved searches list

---

## Troubleshooting

<details>
<summary><strong>No results found</strong></summary>

Try these:
- Check your spelling
- Use fewer or different words
- Remove filters to broaden the search
- Search is limited to zones you belong to

</details>

<details>
<summary><strong>Too many results</strong></summary>

Narrow your search:
- Add more specific terms
- Use filters (date, type, channel)
- Use exact phrases with quotes
- Combine multiple operators

</details>

<details>
<summary><strong>Can't find a message I know exists</strong></summary>

Check these:
- Was it in a zone you have access to?
- Was it deleted?
- Are you searching the right date range?
- Try different keywords from the message

</details>

---

## Privacy

### What's Searchable

- **Channel messages** — All messages in channels you can access
- **Events** — Events in zones you belong to
- **People** — Members of your zones

### What's Not Searchable

- **Private messages** — End-to-end encrypted, not searchable
- **Deleted content** — Removed from search
- **Other zones** — Only your zones' content appears

---

[← Back to Features](index.md) | [Previous: Calendar](calendar.md) | [Next: Bookmarks →](bookmarks.md)
