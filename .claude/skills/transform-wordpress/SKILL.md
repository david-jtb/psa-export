---
name: transform-wordpress
description: This skill should be used when the user asks to "map to WordPress", "build wordpress-pages.json", "transform pages.json into WordPress blocks", "map a block to the new page builder", or wants the cleaned pages restructured to match the new WordPress block-builder's format.
version: 1.0.0
---

# Transform WordPress

## Overview

Maps `transformed/pages.json` (the cleaned, fully-resolved page data) into
`transformed/wordpress-pages.json`, re-shaping each block to match the new
WordPress page-builder's block format. Pages keep `title`, `slug`, and `status`;
each block is re-mapped by its `type`.

This runs **after** the `transform-pages` skill — it consumes that skill's
output.

## When to use

- You're recreating the PSA site in WordPress and need the content in your page
  builder's block shape.
- You want to add or change how a specific block type (e.g. `block_faq`) maps to
  a WordPress block.

## How to run

From the project root:

```bash
node .claude/skills/transform-wordpress/transform-wordpress.js
```

No arguments, no dependencies. Reads `transformed/pages.json`, writes
`transformed/wordpress-pages.json`, then prints a summary of which block types
were mapped and which still pass through unchanged.

## Current mappings

### `block_faq` → `accordion`

| Source (pages.json)  | WordPress block                 |
| -------------------- | ------------------------------- |
| `block_faq`          | `accordion` (`type`)            |
| `title`              | `heading`                       |
| `description`        | `description`                   |
| `faqList`            | `accordionPanels`               |
| `faqList[].question` | `accordionPanels[].heading`     |
| `faqList[].answer`   | `accordionPanels[].contentHtml` |

> If your builder's block slug isn't `accordion`, change the `type` value in the
> `block_faq` mapper in `transform-wordpress.js`.

## CTAs

CTAs are emitted in the simplified `FieldVariables\cta()` shape that the
WordPress importers (`jtb-page-block-creator.php`, `jtb-projects-importer.php`)
consume. Always build them with the `buildCta(label, url)` helper rather than
hand-writing the object:

```js
buildCta(item.label, item.href);
// no url  -> { type: 'none' }
// has url -> { type: 'link', buttonLabel, url }
```

The importer reads the top-level `type`, `buttonLabel`, and `url`, then resolves
link-vs-document on its own (rewriting `type` to `document` and importing the
asset when the URL points to a file) and computes the link `target`. So the
mappers only emit those three fields — never `externalLink`, `target`, or a
nested `link` object.

## How it works

1. Loads `transformed/pages.json`.
2. For each block, looks up a mapper by `block.type` in the `mappers` registry.
3. Mapped → returns the new WordPress shape. **Unmapped → passes through
   unchanged** and is counted in the summary so you can see what's left to do.
4. Writes `transformed/wordpress-pages.json`.

## Extending

Add a function to the `mappers` object in `transform-wordpress.js`, keyed by the
source block `type`. Return the new WordPress block shape (set its `type` to your
builder's block slug). Example:

```js
const mappers = {
	block_faq(b) {
		/* ... */
	},

	block_cta(b) {
		return {
			acf_fc_layout: 'BlockLinkList',
			heading: b.title || null,
			description: b.description || null,
			linkItems: (b.buttons || []).map((item) => ({
				cta: buildCta(item.label, item.href),
			})),
		};
	},
};
```

Each run reports remaining unmapped types, so the "Not yet mapped" list is your
to-do list as you build out the new site.
