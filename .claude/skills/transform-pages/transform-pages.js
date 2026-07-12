#!/usr/bin/env node

/**
 * Transform Pages
 * Flattens the raw Directus export (directus-export/data/) into a single
 * pages.json — an array of pages, each with { title, slug, status, blocks }.
 *
 * Every block is fully resolved (child records inlined), all rich-text fields
 * are stripped of inline styling, and image UUIDs are turned into asset URLs.
 *
 * Usage:
 *   node .claude/skills/transform-pages/transform-pages.js
 *
 * Output:
 *   transformed/pages.json
 *
 * This is iteration 1 — designed to be extended. To support a new block type,
 * add an entry to the `resolvers` map. Unknown block types fall back to a raw
 * passthrough so the script never crashes on new data.
 */

const fs = require('fs');
const path = require('path');

// --- Config ---
const ROOT = path.resolve(__dirname, '..', '..', '..');
const DATA_DIR = path.join(ROOT, 'directus-export', 'data');
const OUT_FILE = path.join(ROOT, 'transformed', 'pages.json');
const ASSET_BASE = 'https://psa-directus-prod.azurewebsites.net/assets/';

// --- Helpers ---
function readData(name) {
	const file = path.join(DATA_DIR, `${name}.json`);
	if (!fs.existsSync(file)) {
		console.warn(`   ⚠ missing data file: ${name}.json`);
		return [];
	}
	const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
	return parsed.data || [];
}

function indexBy(arr, key) {
	const map = new Map();
	for (const row of arr) map.set(row[key], row);
	return map;
}

function groupBy(arr, key) {
	const map = new Map();
	for (const row of arr) {
		const k = row[key];
		if (!map.has(k)) map.set(k, []);
		map.get(k).push(row);
	}
	return map;
}

function assetUrl(uuid) {
	return uuid ? ASSET_BASE + uuid : null;
}

/**
 * Strip inline styling from rich-text HTML while keeping semantic structure.
 * Regex-based and zero-dependency — adequate for this controlled CMS output.
 * Markdown fields pass through unchanged (no style attributes to match).
 */
function cleanHtml(str) {
	if (str == null || typeof str !== 'string') return str;
	return str
		// drop style="..." / style='...' (covers font-size, mso-*, font-family, etc.)
		.replace(/\s*style\s*=\s*"[^"]*"/gi, '')
		.replace(/\s*style\s*=\s*'[^']*'/gi, '')
		// drop class="..." / class='...'
		.replace(/\s*class\s*=\s*"[^"]*"/gi, '')
		.replace(/\s*class\s*=\s*'[^']*'/gi, '')
		// tidy leftover spaces inside opening tags: "<span >" -> "<span>"
		.replace(/<([a-zA-Z][a-zA-Z0-9]*)\s+>/g, '<$1>')
		// remove now-empty wrapper spans
		.replace(/<span>\s*<\/span>/gi, '')
		.trim();
}

// --- Load + index everything once ---
console.log('\n📥 Loading export data...');

const pages = readData('page');
const pageBlocksById = indexBy(readData('page_blocks'), 'id');

// Block tables indexed by their primary key (id).
const blockTables = {
	block_hero: indexBy(readData('block_hero'), 'id'),
	block_hero_alt: indexBy(readData('block_hero_alt'), 'id'),
	block_content: indexBy(readData('block_content'), 'id'),
	block_content_columns: indexBy(readData('block_content_columns'), 'id'),
	block_feature_background: indexBy(readData('block_feature_background'), 'id'),
	block_features: indexBy(readData('block_features'), 'id'),
	block_cta: indexBy(readData('block_cta'), 'id'),
	block_faq: indexBy(readData('block_faq'), 'id'),
	block_logos: indexBy(readData('block_logos'), 'id'),
	block_team: indexBy(readData('block_team'), 'id'),
	block_form: indexBy(readData('block_form'), 'id'),
	block_projects: indexBy(readData('block_projects'), 'id'),
	block_video: indexBy(readData('block_video'), 'id'),
	block_announcements: indexBy(readData('block_announcements'), 'id'),
};

// Child / mapping / referenced collections.
const heroFilesById = indexBy(readData('block_hero_files'), 'id');
const featureItemsById = indexBy(readData('block_features_item'), 'id');
const featureMappingByBlock = groupBy(readData('block_features_item_mapping'), 'block_id');
const logosListById = indexBy(readData('block_logos_list'), 'id');
const teamLeadershipById = indexBy(readData('block_team_leadership'), 'id');
const leadershipById = indexBy(readData('leadership'), 'id');
const projectsMappingById = indexBy(readData('block_projects_mapping'), 'id');
const projectById = indexBy(readData('project'), 'id');
const formById = indexBy(readData('form'), 'id');
const formFieldById = indexBy(readData('form_field'), 'id');
const newsById = indexBy(readData('news'), 'id');

// --- Block resolvers ---
// Each returns a clean, self-contained block object.
const resolvers = {
	block_hero(b) {
		return {
			type: 'block_hero',
			badge: b.badge,
			title: b.title,
			description: cleanHtml(b.description),
			buttonText: b.buttonText,
			buttonURL: b.buttonURL,
			images: (b.images || [])
				.map((id) => heroFilesById.get(id))
				.filter(Boolean)
				.map((f) => assetUrl(f.directus_files_id)),
		};
	},

	block_hero_alt(b) {
		return {
			type: 'block_hero_alt',
			title: b.title,
			description: cleanHtml(b.description),
			image: assetUrl(b.image),
		};
	},

	block_content(b) {
		return {
			type: 'block_content',
			content: cleanHtml(b.content),
			widthFull: b.widthFull,
		};
	},

	block_content_columns(b) {
		return {
			type: 'block_content_columns',
			title: b.title,
			description: cleanHtml(b.description),
			columns: (b.columnList || []).map((c) => cleanHtml(c.column)),
		};
	},

	block_feature_background(b) {
		return {
			type: 'block_feature_background',
			title: b.title,
			content: cleanHtml(b.content),
			background: assetUrl(b.background),
			alignment: b.alignment,
		};
	},

	block_features(b) {
		const mappings = (featureMappingByBlock.get(b.id) || [])
			.slice()
			.sort((a, c) => (a.sort || 0) - (c.sort || 0));
		return {
			type: 'block_features',
			subtitle: b.subtitle,
			title: b.title,
			description: cleanHtml(b.description),
			items: mappings
				.map((m) => featureItemsById.get(m.item_id))
				.filter(Boolean)
				.map((it) => ({
					title: it.title,
					description: cleanHtml(it.description),
					url: it.url,
					buttonText: it.buttonText,
					image: assetUrl(it.image),
				})),
		};
	},

	block_cta(b) {
		return {
			type: 'block_cta',
			title: b.title,
			description: cleanHtml(b.description),
			buttons: b.buttons || [],
		};
	},

	block_faq(b) {
		return {
			type: 'block_faq',
			title: b.title,
			description: cleanHtml(b.description),
			faqList: (b.faqList || []).map((f) => ({
				question: f.question,
				answer: cleanHtml(f.answer),
			})),
		};
	},

	block_logos(b) {
		const logos = (b.list || [])
			.map((id) => logosListById.get(id))
			.filter(Boolean)
			.slice()
			.sort((a, c) => (a.order || 0) - (c.order || 0));
		return {
			type: 'block_logos',
			title: b.title,
			logos: logos.map((l) => ({
				href: l.href,
				logo: assetUrl(l.logo),
			})),
		};
	},

	block_team(b) {
		const members = (b.team || [])
			.map((id) => teamLeadershipById.get(id))
			.filter(Boolean)
			.map((tl) => leadershipById.get(tl.leadership_id))
			.filter(Boolean);
		return {
			type: 'block_team',
			title: b.title,
			description: cleanHtml(b.description),
			members: members.map((m) => ({
				fullName: m.fullName,
				title: m.title,
				description: cleanHtml(m.description),
				image: assetUrl(m.image),
				url: m.URL,
				tag: m.tag,
			})),
		};
	},

	block_form(b) {
		const form = formById.get(b.form);
		let resolvedForm = null;
		if (form) {
			resolvedForm = {
				title: form.title,
				submitLabel: form.submit_label,
				successMessage: cleanHtml(form.success_message),
				fields: (form.fields || [])
					.map((id) => formFieldById.get(id))
					.filter(Boolean)
					.slice()
					.sort((a, c) => (a.sort || 0) - (c.sort || 0))
					.map((f) => ({
						label: f.label,
						name: f.name,
						type: f.type,
						placeholder: f.placeholder,
						required: f.required,
						helperText: f.helperText,
						choices: f.choices,
					})),
			};
		}
		return {
			type: 'block_form',
			subtitle: b.subtitle,
			title: b.title,
			description: cleanHtml(b.description),
			image: assetUrl(b.image),
			form: resolvedForm,
		};
	},

	block_projects(b) {
		const projects = (b.list || [])
			.map((id) => projectsMappingById.get(id))
			.filter(Boolean)
			.map((m) => projectById.get(m.project_id))
			.filter(Boolean);
		return {
			type: 'block_projects',
			subtitle: b.subtitle,
			title: b.title,
			description: cleanHtml(b.description),
			buttonText: b.buttonText,
			buttonUrl: b.buttonUrl,
			showButton: b.showButton,
			projects: projects.map((p) => ({
				title: p.title,
				slug: p.slug,
				shortDescription: cleanHtml(p.shortDescription),
				ctaTitle: p.ctaTitle,
				ctaUrl: p.ctaUrl,
				stages: p.stages || [],
				images: (p.images || []).map((img) =>
					assetUrl(typeof img === 'string' ? img : img && img.directus_files_id),
				),
			})),
		};
	},

	block_video(b) {
		return {
			type: 'block_video',
			maxColumns: b.maxColumns,
			// videoEmbed is functional iframe HTML — preserve untouched.
			videos: (b.videos || []).map((v) => ({ videoEmbed: v.videoEmbed })),
		};
	},

	block_announcements(b) {
		const items = (b.list || [])
			.map((id) => newsById.get(id))
			.filter(Boolean);
		return {
			type: 'block_announcements',
			subtitle: b.subtitle,
			title: b.title,
			description: cleanHtml(b.description),
			buttonText: b.buttonText,
			buttonUrl: b.buttonUrl,
			showButton: b.showButton,
			items: items.map((n) => ({
				name: n.name,
				url: n.url,
				shortDescription: cleanHtml(n.shortDescription),
				image: assetUrl(n.image),
			})),
		};
	},
};

// Fallback for unknown / empty collections — raw passthrough, never crash.
function fallbackResolver(collection, record) {
	return Object.assign({ type: collection }, record);
}

// --- Build pages ---
console.log('\n🔧 Transforming pages...');

const skipped = [];
const typeCounts = {};
const result = [];

for (const page of pages) {
	const blocks = [];

	for (const blockRowId of page.blocks || []) {
		const junction = pageBlocksById.get(blockRowId);
		if (!junction) {
			skipped.push(`page "${page.slug}": no page_blocks row #${blockRowId}`);
			continue;
		}

		const { collection, item, order } = junction;
		const table = blockTables[collection];
		const record = table ? table.get(item) : undefined;

		if (!record) {
			skipped.push(
				`page "${page.slug}": missing ${collection} record ${item}`,
			);
			continue;
		}

		const resolver = resolvers[collection];
		const resolved = resolver
			? resolver(record)
			: fallbackResolver(collection, record);

		// keep order so we can sort, then drop it from output
		blocks.push({ _order: order == null ? 0 : order, block: resolved });
		typeCounts[collection] = (typeCounts[collection] || 0) + 1;
	}

	blocks.sort((a, b) => a._order - b._order);

	result.push({
		title: page.title,
		slug: page.slug,
		status: page.status === 'published' ? 'published' : 'draft',
		blocks: blocks.map((b) => b.block),
	});
}

// --- Write output ---
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));

// --- Summary ---
const totalBlocks = Object.values(typeCounts).reduce((s, n) => s + n, 0);
console.log('\n--- Transform Summary ---');
console.log(`✓ ${result.length} pages written`);
console.log(`✓ ${totalBlocks} blocks resolved`);
console.log('\nBlocks by type:');
Object.keys(typeCounts)
	.sort((a, b) => typeCounts[b] - typeCounts[a])
	.forEach((t) => console.log(`   ${t}: ${typeCounts[t]}`));

if (skipped.length > 0) {
	console.log(`\n⚠ ${skipped.length} skipped:`);
	skipped.forEach((s) => console.log(`   - ${s}`));
}

console.log(`\n📁 Output: ${OUT_FILE}\n`);
