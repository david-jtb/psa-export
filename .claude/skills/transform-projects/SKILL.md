---
name: transform-projects
description: This skill should be used when the user asks to "transform the projects", "build projects.json", "flatten the project data", "resolve the projects", or wants the exported PSA project records restructured into a flat, fully-resolved JSON for migrating to WordPress / a page builder.
version: 1.0.0
---

# Transform Projects

## Overview

Flattens the raw Directus export in `directus-export/data/` into a single
`transformed/projects.json` — an array of fully-resolved project records, each
with all junction-table IDs replaced by their actual data and every image UUID
turned into a full **asset URL**.

## When to use

- Recreating / migrating the PSA site and you need project data in a usable shape.
- The raw export is normalised (categories, tags, and images are stored as
  junction-table IDs rather than inline records).
- You want a flat, self-contained list of projects to feed into a WordPress
  migration, a page builder, or a data review.

## How to run

From the project root:

```bash
node .claude/skills/transform-projects/transform-projects.js
```

No arguments, no dependencies (Node built-ins only). Reads from
`directus-export/data/` and writes `transformed/projects.json`, then prints a
summary (project count by status, resolution counts per field).

## Output shape

```json
[
  {
    "id": "147ef326-0361-4602-88bf-537e406d1007",
    "status": "published",
    "slug": "defence-capability-vet-systems-pathways-framework",
    "title": "Defence Capability – VET Systems Pathways Framework",
    "shortDescription": "...",
    "ctaTitle": null,
    "ctaUrl": null,
    "images": ["https://psa-directus-prod.azurewebsites.net/assets/<uuid>"],
    "categories": [{ "id": 6, "name": "Defence", "slug": "defence" }],
    "tags": [{ "id": 45, "name": "Research" }],
    "hyperlinks": [{ "title": "Terms of Reference", "url": "https://..." }],
    "projectOverview": {
      "stageTitle": "Project Overview",
      "startDate": "2025-08-01",
      "endDate": "2026-12-31",
      "isDone": true,
      "stageDescription": "Markdown content..."
    },
    "stages": [
      {
        "stageTitle": "Engagement",
        "startDate": "2025-09-01",
        "endDate": "2026-06-30",
        "isDone": false,
        "stageDescription": "Markdown content..."
      }
    ]
  }
]
```

## How it works

1. **Loads + indexes** all project-related collections once.
2. **Resolves each project**:
   - `categories` (junction IDs) → `project_category_mapping` → `project_category` → `{ id, name, slug }`
   - `tags` (junction IDs) → `project_project_tag` → `project_tag` → `{ id, name }`
   - `images` (junction IDs) → `project_files` → file UUID → full asset URL
   - `stages` — inline records with the "Project Overview" stage extracted into `projectOverview`; if a stage with `stageTitle === "Project Overview"` exists it is lifted to a top-level `projectOverview` field and removed from `stages` (`null` when absent)
   - `hyperlinks` — already inline, passed through as-is

## Source collections used

| File | Purpose |
|------|---------|
| `project.json` | 25 project records (source) |
| `project_category.json` | 7 categories (lookup) |
| `project_category_mapping.json` | project → category junction |
| `project_tag.json` | 5 tags (lookup) |
| `project_project_tag.json` | project → tag junction |
| `project_files.json` | project → image file junction |

## Known limitations / notes

- `stageDescription` is **Markdown** (not HTML) — the CMS stores it as a
  markdown string. No cleaning is applied; consumers should render it with a
  Markdown parser.
- `hyperlinks` URLs may point directly to Directus asset URLs (PDFs, ZIPs) or to
  external sites — no transformation is applied.
- Tags with a `null` `project_tag_id` in the junction table are silently
  skipped (these are orphaned junction rows in the export).

## Extending

- **Add project fields**: extend the `result.push({...})` object in the script.
- **Filter by status**: filter `projects` before the loop
  (e.g. `projects.filter(p => p.status === 'published')`).
- **Resolve category detail**: the full `project_category` record has
  `description`, `image`, `content`, and `buttonUrl` — add them to the category
  mapper if needed.
