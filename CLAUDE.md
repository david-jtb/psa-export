# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-file Node.js CLI script (`directus-export.js`) that exports all user collections, schema, and data from a Directus CMS instance to local JSON files. No dependencies — uses only Node.js built-ins (`https`, `http`, `fs`, `path`).

## Running the script

```bash
node directus-export.js --url <directus-url> --token <api-token>
```

Example:

```bash
node directus-export.js --url https://psa-directus-prod.azurewebsites.net --token <your-token>
```

```bash
node directus-export.js --url https://psa-directus-prod.azurewebsites.net --token N6Qtx9Sj0i1qKi9lxEZoWzED_WWKeY0W
```

## Output structure

```
directus-export/
  schema.json         ← full Directus schema snapshot (/schema/snapshot)
  collections.json    ← list of all collections (/collections)
  data/
    <collection>.json ← one file per user collection (/items/<collection>?limit=-1)
```

System collections (prefixed with `directus_`) are skipped automatically.

## Script behaviour

- Fetches schema first, then collections list, then iterates each user collection
- 100ms delay between collection fetches to avoid overloading the server
- Failed collections are reported in the summary but don't abort the run
- The `directus-export/` directory in this repo contains an existing export from the PSA Directus production instance (Directus 11.17.4, PostgreSQL)
