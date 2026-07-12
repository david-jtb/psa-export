# Block Inventory — PSA Directus Site

Analysed from the Directus export. Each section describes what the block does,
what fields it stores, how often it is used across pages, and a suggested
WordPress/page-builder equivalent.

---

## 1. block_hero
**Uses:** 33 instances across pages | **Example:** [Home](https://publicskillsaustralia.org.au), [Correctional services](https://publicskillsaustralia.org.au/correctional-services), [Police](https://publicskillsaustralia.org.au/police)

Full-width hero banner — the primary "above the fold" block used on most pages.

| Field | Type | Notes |
|---|---|---|
| `badge` | text | Small label/tag above the title (optional) |
| `title` | text | Main heading |
| `description` | text | Body copy / subheading |
| `buttonText` | text | CTA button label |
| `buttonURL` | url | CTA button destination |
| `images` | file IDs | One or more background/foreground images |

**WordPress mapping:** Hero / Banner block (Elementor Pro, Kadence, GenerateBlocks). Needs: badge label, heading, description, CTA button, image(s).

---

## 2. block_hero_alt
**Uses:** 11 instances | **Example:** [Our purpose](https://publicskillsaustralia.org.au/our-purpose), [Committees](https://publicskillsaustralia.org.au/committees), [Annual Project Plans](https://publicskillsaustralia.org.au/annual-project-plans)

Simpler hero — title + description + a single image. No button or badge.

| Field | Type | Notes |
|---|---|---|
| `title` | text | Page/section heading |
| `description` | text | Introductory body copy |
| `image` | file ID | Single feature image |

**WordPress mapping:** Inner banner / page header block. A stripped-down hero widget with just image + heading + text.

---

## 3. block_content
**Uses:** 60 instances — the most-used block in the site | **Example:** [Our purpose](https://publicskillsaustralia.org.au/our-purpose), [Privacy Policy](https://publicskillsaustralia.org.au/privacy-policy), [Defence](https://publicskillsaustralia.org.au/defence)

Plain rich-text / WYSIWYG content area.

| Field | Type | Notes |
|---|---|---|
| `content` | markdown/HTML | Full rich text body |
| `widthFull` | boolean | Whether content spans full container width |

**WordPress mapping:** Standard WordPress block editor paragraph/text block, or a Text Editor widget. The `widthFull` toggle maps to a "full width" section setting.

---

## 4. block_content_columns
**Uses:** 30 instances | **Example:** [Our purpose](https://publicskillsaustralia.org.au/our-purpose), [Correctional services](https://publicskillsaustralia.org.au/correctional-services), [Become a Member](https://publicskillsaustralia.org.au/become-a-member)

Two-column layout. Each column can contain rich text and/or images (markdown with embedded images).

| Field | Type | Notes |
|---|---|---|
| `title` | text | Optional section heading above the columns |
| `description` | text | Optional section subtext |
| `columnList` | array | Each item has a `column` field (markdown) |

**WordPress mapping:** Two-column row/section with a Text/Image widget per column. Elementor's Column widget, Kadence's Row Layout, or a native Columns block.

---

## 5. block_feature_background
**Uses:** 19 instances | **Example:** [Our purpose](https://publicskillsaustralia.org.au/our-purpose), [Correctional services](https://publicskillsaustralia.org.au/correctional-services), [Local Government](https://publicskillsaustralia.org.au/local-government)

A large feature section with a background image, rich text content, and left/right alignment control.

| Field | Type | Notes |
|---|---|---|
| `title` | text | Section heading |
| `content` | markdown | Body text (supports headings, paragraphs) |
| `background` | file ID | Background image |
| `alignment` | `left` / `right` | Which side the text sits on |

**WordPress mapping:** "Image + Text" or "Media & Text" block with a background image option, or a custom section with background image and text overlay. Needs an alignment/layout toggle.

---

## 6. block_features
**Uses:** 15 instances | **Example:** [Home](https://publicskillsaustralia.org.au), [Workforce Insights Reports](https://publicskillsaustralia.org.au/workforce-plans), [Annual Project Plans](https://publicskillsaustralia.org.au/annual-project-plans)

A cards/features grid section. Acts as a container with header text and a list of feature cards (see `block_features_item` below).

| Field | Type | Notes |
|---|---|---|
| `subtitle` | text | Small label above the title |
| `title` | text | Section heading |
| `description` | text | Section subtext |
| `items` | item IDs | References to `block_features_item` records |

**WordPress mapping:** Feature grid / card grid section. Needs a section header (subtitle + title + description) and a repeating card layout.

---

## 7. block_features_item
**Uses:** 24 items (referenced by `block_features`) | **Example:** See any page listed under block_features above

Individual feature card within a features grid.

| Field | Type | Notes |
|---|---|---|
| `title` | text | Card heading |
| `description` | text | Card body copy |
| `url` | url | Card link destination |
| `buttonText` | text | Button/link label |
| `image` | file ID | Card icon or image |

**WordPress mapping:** A repeater card widget. In Elementor: an Icon Box or Image Box widget repeated in a grid.

---

## 8. block_cta
**Uses:** 19 instances | **Example:** [Our governance](https://publicskillsaustralia.org.au/our-governance), [Our Projects](https://publicskillsaustralia.org.au/our-projects), [Join Our Strategic Networks](https://publicskillsaustralia.org.au/strategic-networks)

Call-to-action section with one or more buttons.

| Field | Type | Notes |
|---|---|---|
| `title` | text | CTA heading |
| `description` | text | Supporting copy |
| `type` | `buttons` | Layout variant (only "buttons" seen in data) |
| `buttons` | array | Each has `label`, `href`, `primary` (boolean) |

**WordPress mapping:** CTA / Button Group block. Supports multiple buttons with primary/secondary styling distinction.

---

## 9. block_faq
**Uses:** 20 instances | **Example:** [Our purpose](https://publicskillsaustralia.org.au/our-purpose), [Defence](https://publicskillsaustralia.org.au/defence), [Subcommittees and networks](https://publicskillsaustralia.org.au/subcommittees-and-networks)

FAQ accordion section.

| Field | Type | Notes |
|---|---|---|
| `title` | text | Section heading |
| `description` | text | Section intro text |
| `faqList` | array | The FAQ items (question + answer) |
| `sort` | number | Display order |

**WordPress mapping:** Accordion / FAQ block. Available natively in most page builders (Elementor FAQ widget, Kadence Accordion).

---

## 10. block_logos
**Uses:** 13 instances | **Example:** [Home](https://publicskillsaustralia.org.au), [Members](https://publicskillsaustralia.org.au/members), [Defence](https://publicskillsaustralia.org.au/defence)

A logo strip / partner logos section.

| Field | Type | Notes |
|---|---|---|
| `title` | text | Section heading |
| `list` | item IDs | References to `block_logos_list` records |

Each `block_logos_list` item has: `href` (link), `logo` (file ID), `order`.

**WordPress mapping:** Logo carousel or logo grid block. Most page builders have a Logo Carousel / Brand Grid widget.

---

## 11. block_team
**Uses:** 35 instances — heavily used, especially on staff/team pages | **Example:** [Our team](https://publicskillsaustralia.org.au/our-team), [Board](https://publicskillsaustralia.org.au/board), [Committees](https://publicskillsaustralia.org.au/committees)

Team members grid. One page can have multiple `block_team` blocks (e.g. grouped by department/sector).

| Field | Type | Notes |
|---|---|---|
| `title` | text | Group/section heading |
| `description` | text | Group intro copy |
| `team` | item IDs | References to `block_team_leadership` → `leadership` records |

**WordPress mapping:** Team Members / Staff Grid block. Needs repeater with photo, name, role fields. Multiple team blocks per page = multiple sections, each with their own heading.

---

## 12. block_form
**Uses:** 7 instances | **Example:** [Contact](https://publicskillsaustralia.org.au/contact), [Training Product Feedback Form](https://publicskillsaustralia.org.au/training-product-feedback-form), [Home](https://publicskillsaustralia.org.au)

A full-page-width contact/enquiry form section.

| Field | Type | Notes |
|---|---|---|
| `subtitle` | text | Small label above title |
| `title` | text | Form section heading |
| `description` | text | Intro text above the form |
| `image` | file ID | Decorative image alongside the form |
| `form` | form ID | Reference to a `form` record (field definitions) |

**WordPress mapping:** A section containing a Contact Form (WPForms, Gravity Forms, CF7) with a supporting image and header text.

---

## 13. block_video
**Uses:** 1 instance | **Example:** [Test video](https://publicskillsaustralia.org.au/test-video)

Embeds one or more YouTube/video iframes in a grid layout.

| Field | Type | Notes |
|---|---|---|
| `maxColumns` | number | Grid column count |
| `videos` | array | Each has `videoEmbed` (raw iframe HTML) |

**WordPress mapping:** Video gallery / embed grid block. Can use native WordPress Video block or an Elementor Video widget repeated in a column layout.

---

## 14. block_projects
**Uses:** 5 instances | **Example:** [Annual Project Plans](https://publicskillsaustralia.org.au/annual-project-plans), [Home](https://publicskillsaustralia.org.au)

Project showcase section with header and a list of linked projects.

| Field | Type | Notes |
|---|---|---|
| `title` | text | Section heading |
| `subtitle` | text | Small label |
| `description` | text | Section intro |
| `buttonText` | text | Optional "view all" button label |
| `buttonUrl` | url | Optional "view all" button link |
| `showButton` | boolean | Whether to show the button |
| `list` | project IDs | References to `project` records |

**WordPress mapping:** A post grid / custom post type grid filtered by project. Works well with a Posts Grid widget or a Query Loop block.

---

## 15. block_announcements
**Uses:** 9 instances | **Example:** [Home](https://publicskillsaustralia.org.au) *(not mapped to a page in page_blocks — likely embedded in the home template directly)*

Latest news/announcements listing section.

| Field | Type | Notes |
|---|---|---|
| `subtitle` | text | Small label |
| `title` | text | Section heading |
| `description` | text | Intro copy |
| `buttonText` | text | "View all" button label |
| `buttonUrl` | url | "View all" link |
| `showButton` | boolean | Whether to show the button |
| `list` | item IDs | Pinned/featured announcement items |

**WordPress mapping:** Latest Posts / News Feed block, or a Query Loop block pointing at a "News" post type. "View all" maps to a button below the grid.

---

## 16. block_communities / block_communities_community
**Uses:** 0 items in both (empty in this export)

Planned community listing block. Not currently used.

**WordPress mapping:** Not needed now — can be deferred.

---

## Summary Table

| Block | Count | WordPress Equivalent |
|---|---|---|
| block_content | 60 | Rich Text / WYSIWYG |
| block_team | 35 | Team Members Grid |
| block_hero | 33 | Hero / Banner |
| block_content_columns | 30 | Two-Column Row |
| block_faq | 20 | Accordion / FAQ |
| block_cta | 19 | CTA / Button Group |
| block_feature_background | 19 | Media & Text (with BG image) |
| block_features | 15 | Feature Cards Grid |
| block_logos | 13 | Logo Strip / Carousel |
| block_hero_alt | 11 | Inner Banner / Page Header |
| block_form | 7 | Form Section |
| block_projects | 5 | Post Grid (Projects CPT) |
| block_features_item | 24* | (child of block_features) |
| block_video | 1 | Video Embed Grid |
| block_announcements | 9 | Latest Posts / News Feed |
| block_communities | 0 | (not needed) |

*`block_features_item` and `block_logos_list` / `block_team_leadership` are junction/child tables, not standalone page blocks.

---

## Priority order for WordPress build

1. **block_content** — used on every page; build first
2. **block_hero** — every page has one
3. **block_hero_alt** — inner pages
4. **block_feature_background** — heavily used on sector pages
5. **block_content_columns** — heavily used on sector pages
6. **block_faq** — appears on most sector pages
7. **block_team** — core to team pages
8. **block_cta** — used as linking sections between content
9. **block_logos** — used on sector and home pages
10. **block_features** — feature showcase sections
11. **block_form** — contact/enquiry pages
12. **block_projects** — project listing pages
13. **block_announcements** — news listing sections
14. **block_video** — single use, low priority
