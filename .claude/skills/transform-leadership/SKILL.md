---
name: transform-leadership
description: This skill should be used when the user asks to "transform the leadership", "build people.json", "flatten the leadership data", "resolve the leadership members", "split out partners", or wants the exported PSA leadership records restructured into flat, fully-resolved JSON for migrating to WordPress / a page builder.
version: 2.2.0
---

# Transform Leadership

## Overview

Flattens the raw Directus export in `directus-export/data/` into three files:

- `transformed/people.json` — leadership/board/staff members
- `transformed/partners.json` — records whose `URL` field points to an external (non-Directus-asset) link, e.g. partner organisations
- `transformed/resources.json` — records whose `URL` field points to a Directus asset (PDF, etc.) or whose title is `Download`

Image UUIDs are turned into full **asset URLs**.

## When to use

- Recreating / migrating the PSA site and you need leadership data in a usable shape.
- The raw export stores `image` as a bare UUID.
- You want partner-organisation records (external links) kept separate from actual people/leadership records.
- You want a flat, self-contained list to feed into a WordPress migration, a page builder, or a data review.

## How to run

From the project root:

```bash
node .claude/skills/transform-leadership/transform-leadership.js
```

No arguments, no dependencies (Node built-ins only). Reads from
`directus-export/data/` and `directus-export/people-tags.json`, and writes
`transformed/people.json`, `transformed/partners.json`, and
`transformed/resources.json`, then prints a summary (record counts by
status/tag, resolution counts per field).

## Output shape

All three files share the same record shape:

```json
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
  "tags": ["Staff", "Leadership Team"]
}
```

`tags` is always an array (empty if the person has no tag/category), since a
person can carry both their role classification (e.g. `Staff`, `Board
Director`) and one or more section/committee categories (e.g. `Our Board`,
`Nominations`) resolved from `people-tags.json` — see "How it works" below.

Partner records look the same but `url` is an external link (e.g.
`https://pfa.org.au/`) and `tags` is always overwritten to
`["Industry Advisory Group"]`, regardless of what the source record had.

## How it works

1. **Loads** the `leadership` collection from the export, plus
   `directus-export/people-tags.json` (a separate export grouping members by
   page section — `Leadership Team`, `Management Team`, `Our Board`, `Past
   Board Members`, `Audit, Finance and Risk Committee (AFRC)`,
   `Nominations`).
2. **Resolves each record**: `image` (direct UUID) → full asset URL.
3. **Builds a category map** from `people-tags.json`: trimmed `fullName` →
   set of section titles that name appears under (a person can be listed in
   more than one section, e.g. a board member who also sits on the AFRC).
4. **Computes `tags`** per record by merging the record's own `tag` value
   (if any) with the categories found for that `fullName` in the map,
   deduplicated. Matching is by trimmed, case-insensitive `fullName` since
   the raw data has inconsistent leading/trailing whitespace on some names.
5. **Routes each record** into one of three buckets based on its `URL` field:
   - `fullName` is **Paul Wallworth** or **Gabby Ramsay** → `partners.json` (hardcoded
     exception, regardless of `URL`) — see `FORCE_PARTNER_NAMES` in the script
   - has a URL pointing at a Directus asset, or `title === 'Download'` → `resources.json`
   - has any other non-empty URL (external link) → `partners.json`
   - everything else → `people.json`
6. **Every record routed to `partners.json`** has its `tags` overwritten to
   `["Industry Advisory Group"]` (see `PARTNERS_TAG` in the script).
7. **Sorts** each output array by `sort` ascending, then `fullName` alphabetically for stable output.

## Source collections used

| File | Purpose |
|------|---------|
| `leadership.json` | leadership member records (source) |
| `people-tags.json` | resolves each member's page-section/committee categories, added to `tags` |

## Known limitations / notes

- `description` is **Markdown** (not HTML) — the CMS stores it as a markdown
  string. No cleaning is applied; consumers should render it with a Markdown parser.
- The external/asset split is based purely on whether `URL` contains the
  Directus asset host — a few records with **relative internal paths** (e.g.
  `/emergency-tree-operations`) also get routed to `partners.json` since they
  aren't asset URLs either. Review `partners.json` if this matters for your migration.
- `block_id` groups members into page sections — it references a page block UUID
  but the block's label/title is not resolved here directly; `people-tags.json`
  resolves the equivalent grouping by name instead (see `tags`).
- Category resolution is matched by `fullName` only, not `block_id`, so a
  person with duplicate rows across sections (same name, different
  `block_id`) gets the **same merged `tags` array on every row** — the union
  of every category they appear under anywhere, not just the one for that
  specific row.

## Extending

- **Filter by tag**: filter `members` before the loop
  (e.g. `members.filter(m => m.tag === 'Staff')`).
- **Filter by status**: add `members.filter(m => m.status === 'published')`.
- **Change the partner/resource split logic**: adjust the `isAssetUrl` /
  `isDownload` / `isExternalUrl` checks near the top of the loop.
- **Add/remove forced-partner names**: edit the `FORCE_PARTNER_NAMES` set near
  the top of the script.
- **Change the partners tag**: edit the `PARTNERS_TAG` constant near the top
  of the script.
