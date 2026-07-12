---
name: transform-pages
description: This skill should be used when the user asks to "transform the pages", "build pages.json", "flatten the Directus export", "resolve the blocks", "clean the page content", or wants the exported PSA site pages restructured into a flat, styling-stripped JSON for migrating to WordPress / a page builder.
version: 1.0.0
---

# Transform Pages

## Overview

Flattens the raw Directus export in `directus-export/data/` into a single
`transformed/pages.json` — an array of pages, each with `title`, `slug`,
`status`, and a `blocks` array. Every block is **fully resolved** (child records
inlined), every rich-text field is **stripped of inline styling**, and every
image UUID is turned into a full **asset URL**.

This is the foundation the user builds on when recreating the site in WordPress.

## When to use

- Recreating / migrating the PSA site and you need page content in a usable shape.
- The raw export is too normalized to work with (content spread across
  `page_blocks` + ~15 `block_*` files + mapping tables).
- You need the Word/Office styling noise (`style="font-size: 24pt;"`, `mso-*`,
  `class=`) removed from the content.

## How to run

From the project root:

```bash
node .claude/skills/transform-pages/transform-pages.js
```

No arguments, no dependencies (Node built-ins only). It reads from
`directus-export/data/` and writes `transformed/pages.json`, then prints a
summary (pages written, blocks resolved, counts per block type, anything
skipped).

## Output shape

```json
[
  {
    "title": "Police",
    "slug": "/police",
    "status": "published",
    "blocks": [
      { "type": "block_hero", "title": "...", "description": "...", "images": ["https://.../assets/<uuid>"] },
      { "type": "block_content", "content": "<h2>...</h2><p>...</p>", "widthFull": false },
      { "type": "block_faq", "title": "...", "faqList": [{ "question": "...", "answer": "<p>...</p>" }] }
    ]
  }
]
```

## How it works

1. **Loads + indexes** every needed file once (block tables by `id`, mapping
   tables grouped/indexed).
2. **Resolves each page**: `page.blocks` (int IDs) → `page_blocks` junction →
   `collection` + `item` UUID → the block record → a per-type resolver. Blocks
   are sorted by the junction `order` field.
3. **Resolvers** (one per block type in the `resolvers` map) inline child data:
   - `block_features` → feature cards (via `block_features_item_mapping`)
   - `block_team` → leadership members (via `block_team_leadership` → `leadership`)
   - `block_logos` → logo list (via `block_logos_list`)
   - `block_projects` → projects (via `block_projects_mapping` → `project`)
   - `block_form` → form + its fields (via `form` → `form_field`)
   - `block_hero` → image asset URLs (via `block_hero_files`)
   - `block_announcements` → news items (via `news`)
4. **`cleanHtml()`** strips `style=`, `class=`, `mso-*` attributes and empty
   wrapper spans, keeping semantic tags. Video `<iframe>` embeds are preserved
   untouched (their styles are functional).
5. **`assetUrl()`** maps an image UUID to
   `https://psa-directus-prod.azurewebsites.net/assets/<uuid>`.

## Known limitations / notes

- **Images** resolve to asset URLs only — the `directus_files` collection was
  not part of the export, so no original filenames/metadata are available.
- **HTML cleaning is regex-based** (zero-dependency). It's reliable for this
  controlled CMS output; if the data ever contains malformed markup, switch to a
  real HTML parser.
- `block_communities` is empty in the export and has no dedicated resolver — it
  would pass through the fallback (raw `{ type, ...record }`) if it appeared.

## Extending

- **New block type**: add an entry to the `resolvers` object keyed by the
  collection name. Return `{ type, ...cleanFields }`, run rich text through
  `cleanHtml()` and image UUIDs through `assetUrl()`. Unhandled types already
  fall back to a safe raw passthrough.
- **More page fields**: add them in the final `result.push({...})` in `main`.
- **Per-page files / other output**: change `OUT_FILE` or loop the write.
