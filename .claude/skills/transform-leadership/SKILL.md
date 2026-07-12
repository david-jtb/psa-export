---
name: transform-leadership
description: This skill should be used when the user asks to "transform the leadership", "build leadership.json", "flatten the leadership data", "resolve the leadership members", or wants the exported PSA leadership records restructured into a flat, fully-resolved JSON for migrating to WordPress / a page builder.
version: 1.0.0
---

# Transform Leadership

## Overview

Flattens the raw Directus export in `directus-export/data/` into a single
`transformed/leadership.json` — an array of fully-resolved leadership records,
with image UUIDs turned into full **asset URLs** and `see_also` junction IDs
resolved to related member summaries.

## When to use

- Recreating / migrating the PSA site and you need leadership data in a usable shape.
- The raw export stores `image` as a bare UUID and `see_also` as an array of
  junction-table integers rather than inline records.
- You want a flat, self-contained list of members to feed into a WordPress
  migration, a page builder, or a data review.

## How to run

From the project root:

```bash
node .claude/skills/transform-leadership/transform-leadership.js
```

No arguments, no dependencies (Node built-ins only). Reads from
`directus-export/data/` and writes `transformed/leadership.json`, then prints a
summary (record count by status and tag, resolution counts per field).

## Output shape

```json
[
  {
    "id": "fb993a78-59e7-4fc3-aa9c-0d4c03355cb8",
    "status": "published",
    "sort": 1,
    "fullName": "Jean Dyzel",
    "title": "Chief Executive Officer",
    "description": "Jean is a passionate leader with vast experience...",
    "imageUrl": "https://psa-directus-prod.azurewebsites.net/assets/16ee508d-...",
    "block_id": "df7e215b-8109-46ba-891c-1f524175a710",
    "url": null,
    "tag": "Staff",
    "seeAlso": [
      {
        "id": "9ae5a1a2-...",
        "fullName": "Stuart Ellis AM",
        "title": "Nominations Committee Member, AFRC Member",
        "tag": null,
        "imageUrl": "https://psa-directus-prod.azurewebsites.net/assets/36dbc8e1-..."
      }
    ]
  }
]
```

## How it works

1. **Loads + indexes** all leadership-related collections once.
2. **Resolves each record**:
   - `image` (direct UUID) → full asset URL
   - `see_also` (junction IDs) → `leadership_see_also_mapping` → related leadership UUID → `{ id, fullName, title, tag, imageUrl }`
3. **Sorts** output by `sort` ascending, then `fullName` alphabetically for stable output.

## Source collections used

| File | Purpose |
|------|---------|
| `leadership.json` | 103 leadership member records (source) |
| `leadership_see_also_mapping.json` | leadership → related leadership junction (310 rows) |

## Known limitations / notes

- `description` is **Markdown** (not HTML) — the CMS stores it as a markdown
  string. No cleaning is applied; consumers should render it with a Markdown parser.
- `url` may be a direct Directus asset URL (PDF) or an external URL — no
  transformation is applied.
- `block_id` groups members into page sections — it references a page block UUID
  but the block's label/title is not resolved here. Use the `block_id` to group
  members by section if needed.
- Mapping rows where `related_leadership_id` is `null` are silently skipped
  (orphaned junction rows in the export).

## Extending

- **Filter by tag**: filter `members` before the loop
  (e.g. `members.filter(m => m.tag === 'Staff')`).
- **Filter by status**: add `members.filter(m => m.status === 'published')`.
- **Add seeAlso detail**: the full related record is available via `memberById` —
  extend the `.map()` in the `seeAlso` resolver to include `description` or `url`.
