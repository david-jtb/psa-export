#!/usr/bin/env node

/**
 * Transform WordPress
 * Maps transformed/pages.json (the cleaned, resolved page data) into
 * transformed/wordpress-pages.json, re-shaping each block to match the new
 * WordPress page-builder's block format.
 *
 * Usage:
 *   node .claude/skills/transform-wordpress/transform-wordpress.js
 *
 * Input:
 *   transformed/pages.json   (produced by the transform-pages skill)
 * Output:
 *   transformed/wordpress-pages.json
 *
 * This is iteration 1 — add a mapper per block type as you build out the new
 * site. Block types without a mapper pass through unchanged and are reported in
 * the summary so you can see what's left to map.
 */

const fs = require('fs');
const path = require('path');

// --- Config ---
const ROOT = path.resolve(__dirname, '..', '..', '..');
const IN_FILE = path.join(ROOT, 'transformed', 'pages.json');
const OUT_FILE = path.join(ROOT, 'transformed', 'wordpress-pages.json');
const OUT_COMPONENTS_FILE = path.join(
	ROOT,
	'transformed',
	'wordpress-components.json',
);

// --- Helpers ---
function stripTags(html) {
	if (!html) return html;
	return html
		.replace(/<\/?span(\s[^>]*)?>/gi, '') // strip span tags
		.replace(/<p>\s*<\/p>/gi, '') // remove empty <p></p>
		.replace(/<p>\s*$/gi, '') // remove orphaned <p> at end
		.replace(/^\s*<\/p>/gi, '') // remove orphaned </p> at start
		.trim();
}

// Step all heading levels down by one (h1→h2, h2→h3, …, h5→h6).
// Prevents multiple h1 tags appearing down the page body.
function stepDownHeadings(html) {
	if (!html) return html;
	return html
		.replace(/<(\/?)h5(\b[^>]*)>/gi, '<$1h6$2>')
		.replace(/<(\/?)h4(\b[^>]*)>/gi, '<$1h5$2>')
		.replace(/<(\/?)h3(\b[^>]*)>/gi, '<$1h4$2>')
		.replace(/<(\/?)h2(\b[^>]*)>/gi, '<$1h3$2>')
		.replace(/<(\/?)h1(\b[^>]*)>/gi, '<$1h2$2>');
}

function markdownToHtml(md) {
	if (!md) return md;
	let html = md
		.replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
		.replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
		.replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
		.replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>')
		.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
		.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
	// Split on double newlines, then also split each chunk on newlines that
	// follow a closing heading tag so heading+paragraph in one block get separated.
	html = html
		.split(/\n\n+/)
		.flatMap((s) => s.split(/(?<=<\/h[1-6]>)\n/))
		.map((s) => s.trim())
		.filter(Boolean)
		.map((s) =>
			/^<h[1-6]>/.test(s) ? s : `<p>${s.replace(/\n/g, '<br>')}</p>`,
		)
		.join('\n');
	return stepDownHeadings(html.trim()) || null;
}

function fixMarkdownLinks(html) {
	if (!html) return html;
	// [<a href="...">text</a>](url) — Directus already made the anchor, drop the outer markdown wrapper
	html = html.replace(/\[(<a\s[^>]*>.*?<\/a>)\]\([^)]+\)/gis, '$1');
	// [<a href="...">text</a>] — bare bracketed anchor with no trailing url
	html = html.replace(/\[(<a\s[^>]*>.*?<\/a>)\]/gis, '$1');
	// [text](url) — pure markdown link, convert to anchor
	html = html.replace(
		/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi,
		(_, text, url) => `<a href="${normalizeUrl(url)}">${text}</a>`,
	);
	// href="https://psa-website-beta.azurewebsites.net/..." → href="/..." for internal anchors
	html = html.replace(
		/href=(["'])([^"']+)\1/gi,
		(_, q, url) => `href=${q}${normalizeUrl(url)}${q}`,
	);
	return html;
}

// Void elements that never have a closing tag.
const VOID_TAGS = new Set([
	'img',
	'br',
	'hr',
	'input',
	'meta',
	'link',
	'source',
	'area',
	'base',
	'col',
	'embed',
	'param',
	'track',
	'wbr',
]);

// Remove orphaned/unbalanced tags (e.g. a lone `</h2>` or a trailing `<h2>`
// left behind when content was split mid-element) and any empty tag pairs.
function removeOrphanTags(html) {
	if (!html) return html;

	const dropEmptyPairs = (s) => {
		let prev;
		do {
			prev = s;
			s = s.replace(/<([a-z][a-z0-9]*)\b[^>]*>\s*<\/\1>/gi, '');
		} while (s !== prev);
		return s;
	};

	html = dropEmptyPairs(html);

	// Tokenize into tags + text, then match opens to closes with a stack.
	const tokens = [];
	const tagRe = /<\/?([a-z][a-z0-9]*)\b[^>]*?>/gi;
	let lastIndex = 0;
	let m;
	while ((m = tagRe.exec(html)) !== null) {
		if (m.index > lastIndex)
			tokens.push({
				type: 'text',
				value: html.slice(lastIndex, m.index),
			});
		const full = m[0];
		const name = m[1].toLowerCase();
		tokens.push({
			type: 'tag',
			value: full,
			name,
			isClose: full.startsWith('</'),
			isSelf: full.endsWith('/>') || VOID_TAGS.has(name),
			keep: true,
		});
		lastIndex = tagRe.lastIndex;
	}
	if (lastIndex < html.length)
		tokens.push({ type: 'text', value: html.slice(lastIndex) });

	const stack = [];
	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		if (t.type !== 'tag' || t.isSelf) continue;
		if (!t.isClose) {
			stack.push(i);
			continue;
		}
		let found = -1;
		for (let j = stack.length - 1; j >= 0; j--) {
			if (tokens[stack[j]].name === t.name) {
				found = j;
				break;
			}
		}
		if (found === -1) {
			t.keep = false; // orphan close tag
		} else {
			// Anything opened after the matched tag is improperly nested — drop it.
			for (let j = stack.length - 1; j > found; j--) {
				tokens[stack[j]].keep = false;
			}
			stack.length = found;
		}
	}
	// Opens still on the stack were never closed.
	for (const idx of stack) tokens[idx].keep = false;

	const out = tokens
		.map((t) => (t.type === 'text' || t.keep ? t.value : ''))
		.join('');
	return stepDownHeadings(dropEmptyPairs(out).trim());
}

const INTERNAL_ORIGIN = 'https://psa-website-beta.azurewebsites.net';

function normalizeUrl(url) {
	if (!url) return url;
	if (url.startsWith(INTERNAL_ORIGIN)) {
		return url.slice(INTERNAL_ORIGIN.length) || '/';
	}
	// Bare relative URLs (e.g. "members") should be rooted with a leading
	// slash. Leave absolute URLs, protocol-relative URLs, anchors, query
	// strings, and scheme links (mailto:, tel:, etc.) untouched.
	if (
		!/^[a-z][a-z0-9+.-]*:/i.test(url) && // scheme, e.g. https:, mailto:
		!url.startsWith('//') &&
		!url.startsWith('/') &&
		!url.startsWith('#') &&
		!url.startsWith('?')
	) {
		return '/' + url;
	}
	return url;
}

// Build a CTA in the new simplified `FieldVariables\cta()` shape that the
// WordPress importers consume. The importer reads top-level `type`,
// `buttonLabel` and `url`, then resolves link-vs-document and computes the
// link target itself — so we only emit those three fields.
//   - no URL        -> { type: 'none' }
//   - otherwise     -> { type: 'link', buttonLabel, url }
// (The importer rewrites `type` to 'document' if the URL points to a file.)
function buildCta(label, url) {
	const resolved = normalizeUrl(url);
	if (!resolved) {
		return { type: 'none' };
	}
	return {
		type: 'link',
		buttonLabel: label || null,
		url: resolved,
	};
}

// --- Block mappers ---
// Keyed by the source block `type`. Each returns the new WordPress block shape.
// To map a new block type, add an entry here.
const mappers = {
	block_faq(b) {
		return {
			acf_fc_layout: 'BlockAccordion',
			heading: b.title || null,
			description: b.description || null,
			accordionPanels: (b.faqList || []).map((item) => ({
				heading: item.question || null,
				contentHtml: item.answer || null,
			})),
		};
	},
	block_content(b) {
		const content = b.content || '';
		const splitRegex =
			/(<img[^>]+>|<iframe[^>]+player\.vimeo\.com[^>]*>(?:.*?<\/iframe>)?|<p[^>]*>\s*\(?\s*<a\s[^>]*href="[^"]*\/assets\/[^"]*"[^>]*>[^<]*<\/a>\s*\)?\s*<\/p>|<p>[\s\S]*?\[[\s\S]*?\]\(<a\s[^>]*href="[^"]*\/assets\/[^"]*"[^>]*>[^<]*<\/a>\)[\s\S]*?<\/p>)/gis;

		const cleanHtml = (s) => removeOrphanTags(fixMarkdownLinks(stripTags(s)));
		const cleanMd = (s) =>
			removeOrphanTags(fixMarkdownLinks(stripTags(markdownToHtml(s))));
		const clean = (s) => (/<[a-z]/i.test(s) ? cleanHtml(s) : cleanMd(s));

		if (!splitRegex.test(content)) {
			return [
				{
					acf_fc_layout: 'BlockWysiwyg',
					contentHtml: clean(content) || null,
				},
			];
		}

		splitRegex.lastIndex = 0;
		const blocks = [];
		let lastIndex = 0;
		let match;

		while ((match = splitRegex.exec(content)) !== null) {
			const before = clean(content.slice(lastIndex, match.index));
			if (before) {
				blocks.push({
					acf_fc_layout: 'BlockWysiwyg',
					contentHtml: before,
				});
			}

			const tag = match[0];
			if (/^<img/i.test(tag)) {
				const srcMatch = tag.match(/src=["']([^"']+)["']/i);
				blocks.push({
					acf_fc_layout: 'BlockImage',
					image: srcMatch ? srcMatch[1] : null,
				});
			} else if (/^<iframe/i.test(tag)) {
				const vimeoMatch = tag.match(
					/player\.vimeo\.com\/video\/(\d+)/i,
				);
				const videoId = vimeoMatch ? vimeoMatch[1] : null;
				blocks.push({
					acf_fc_layout: 'BlockVideo',
					vimeoId: videoId || null,
				});
			} else {
				// Download link paragraph: [label](<a href="...assets/...">anchor text</a>)
				const hrefMatch = tag.match(/href="([^"]*)"/i);
				const anchorTextMatch = tag.match(/<a[^>]*>([^<]*)<\/a>/i);
				blocks.push({
					acf_fc_layout: 'BlockLinkList',
					heading: null,
					description: null,
					linkItems: [
						{
							cta: buildCta(
								anchorTextMatch
									? anchorTextMatch[1].trim()
									: null,
								hrefMatch ? hrefMatch[1] : null,
							),
						},
					],
				});
			}

			lastIndex = match.index + match[0].length;
		}

		const after = clean(content.slice(lastIndex));
		if (after) {
			blocks.push({ acf_fc_layout: 'BlockWysiwyg', contentHtml: after });
		}

		return blocks;
	},
	block_content_columns(b) {
		// Split regex handles both HTML <img> and markdown ![](url) images, plus Vimeo iframes
		const splitRegex =
			/(<img[^>]+\/?>|!\[[^\]]*\]\(https?:\/\/[^)]+\)|<iframe[^>]+player\.vimeo\.com[^>]*>(?:.*?<\/iframe>)?)/gis;

		const cleanHtml = (s) =>
			removeOrphanTags(fixMarkdownLinks(stripTags(s)));
		const cleanMd = (s) =>
			removeOrphanTags(fixMarkdownLinks(stripTags(markdownToHtml(s))));

		const cleanChunk = (s) =>
			/<[a-z]/i.test(s) ? cleanHtml(s) : cleanMd(s);

		const processColumn = (content) => {
			const blocks = [];

			if (!splitRegex.test(content)) {
				splitRegex.lastIndex = 0;
				const html = cleanChunk(content);
				if (html)
					blocks.push({
						acf_fc_layout: 'BlockWysiwyg',
						contentHtml: html,
					});
				return blocks;
			}

			splitRegex.lastIndex = 0;
			let lastIndex = 0;
			let match;

			while ((match = splitRegex.exec(content)) !== null) {
				const before = cleanChunk(content.slice(lastIndex, match.index));
				if (before)
					blocks.push({
						acf_fc_layout: 'BlockWysiwyg',
						contentHtml: before,
					});

				const tag = match[0];
				if (/^<iframe/i.test(tag)) {
					const vimeoMatch = tag.match(
						/player\.vimeo\.com\/video\/(\d+)/i,
					);
					const videoId = vimeoMatch ? vimeoMatch[1] : null;
					blocks.push({
						acf_fc_layout: 'BlockVideo',
						vimeoId: videoId || null,
					});
				} else {
					// HTML <img src="..."> or markdown ![alt](url)
					const src = /^<img/i.test(tag)
						? (tag.match(/src=["']([^"']+)["']/i) || [])[1]
						: (tag.match(/!\[[^\]]*\]\((https?:\/\/[^)]+)\)/i) ||
								[])[1];
					blocks.push({
						acf_fc_layout: 'BlockImage',
						image: src || null,
					});
				}

				lastIndex = match.index + match[0].length;
			}

			const after = cleanChunk(content.slice(lastIndex));
			if (after)
				blocks.push({
					acf_fc_layout: 'BlockWysiwyg',
					contentHtml: after,
				});

			return blocks;
		};

		return (b.columns || []).flatMap((col) => processColumn(col || ''));
	},
	block_hero_alt(b) {
		return {
			acf_fc_layout: 'BlockHero',
			heading: b.title || null,
			description: b.description || null,
			image: b.image || null,
		};
	},
	block_hero(b) {
		const images = b.images || [];
		return {
			acf_fc_layout: 'BlockHero',
			heading: b.title || null,
			description: b.description || null,
			image: images[0] || null,
			cta: b.buttonText ? buildCta(b.buttonText, b.buttonURL) : null,
		};
	},
	block_logos(b) {
		return {
			acf_fc_layout: 'BlockLogos',
			heading: b.title || null,
			logoItems: (b.logos || []).map((item) => ({
				image: item.logo || null,
				url: normalizeUrl(item.href) || null,
			})),
		};
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
	block_feature_background(b) {
		const itemHeading = b.title || null;
		const itemContent = markdownToHtml(b.content) || null;
		return {
			acf_fc_layout: 'BlockContentMedia',
			image: b.background || null,
			textAlign: b.alignment || null,
			contentMediaItems: (itemHeading || itemContent)
				? [{ itemHeading, itemContent }]
				: [],
		};
	},
	block_features(b) {
		return {
			acf_fc_layout: 'BlockFeatures',
			heading: b.title || null,
			subheading: b.subtitle || null,
			description: b.description || null,
			featureItems: (b.items || []).map((item) => ({
				cta: buildCta(item.buttonText, item.url),
				heading: item.title || null,
				description: item.description || null,
			})),
		};
	},
	block_team: () => [],
	block_form: () => [],
	block_projects: () => [],
	block_video: () => [],
};

// Block types with no mapper yet pass through unchanged.
function passthrough(block) {
	return block;
}

// --- Load input ---
if (!fs.existsSync(IN_FILE)) {
	console.error(
		`\n✗ Input not found: ${IN_FILE}\n  Run the transform-pages skill first.\n`,
	);
	process.exit(1);
}

console.log('\n📥 Loading pages.json...');
const pages = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'));

// --- Map ---
console.log('\n🔧 Mapping blocks to WordPress format...');

const mappedCounts = {};
const unmappedCounts = {};
const componentGroups = {};

const result = pages.map((page) => ({
	title: page.title,
	slug: page.slug,
	status: page.status,
	blocks: (page.blocks || []).flatMap((block) => {
		const mapper = mappers[block.type];
		if (mapper) {
			mappedCounts[block.type] = (mappedCounts[block.type] || 0) + 1;
			const mapped = mapper(block);
			const mappedArray = Array.isArray(mapped) ? mapped : [mapped];
			mappedArray.forEach((m) => {
				const componentKey = m.acf_fc_layout || block.type;
				if (!componentGroups[componentKey])
					componentGroups[componentKey] = [];
				componentGroups[componentKey].push(m);
			});
			return mappedArray;
		}
		unmappedCounts[block.type] = (unmappedCounts[block.type] || 0) + 1;
		return [passthrough(block)];
	}),
}));

// --- Write outputs ---
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));

const components = Object.entries(componentGroups).map(
	([component, blocks]) => {
		// BlockAccordion → "Accordion" / "/accordion"
		const label = component
			.replace(/^Block/, '')
			.replace(/([A-Z])/g, ' $1')
			.trim();
		const slug = '/' + label.toLowerCase().replace(/\s+/g, '-');
		return { title: label, slug: slug, blocks };
	},
);
fs.writeFileSync(OUT_COMPONENTS_FILE, JSON.stringify(components, null, 2));

// --- Summary ---
console.log('\n--- WordPress Mapping Summary ---');
console.log(`✓ ${result.length} pages written`);

const mappedTotal = Object.values(mappedCounts).reduce((s, n) => s + n, 0);
console.log(`\n✓ Mapped (${mappedTotal}):`);
Object.keys(mappedCounts)
	.sort((a, b) => mappedCounts[b] - mappedCounts[a])
	.forEach((t) => console.log(`   ${t}: ${mappedCounts[t]}`));

const unmappedTypes = Object.keys(unmappedCounts);
if (unmappedTypes.length > 0) {
	const unmappedTotal = Object.values(unmappedCounts).reduce(
		(s, n) => s + n,
		0,
	);
	console.log(
		`\n⏳ Not yet mapped — passed through unchanged (${unmappedTotal}):`,
	);
	unmappedTypes
		.sort((a, b) => unmappedCounts[b] - unmappedCounts[a])
		.forEach((t) => console.log(`   ${t}: ${unmappedCounts[t]}`));
}

console.log(`\n📁 Output: ${OUT_FILE}`);
console.log(`📁 Components: ${OUT_COMPONENTS_FILE}\n`);
