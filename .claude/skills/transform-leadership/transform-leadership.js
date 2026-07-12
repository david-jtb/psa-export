#!/usr/bin/env node

/**
 * Transform Leadership
 * Flattens the raw Directus export (directus-export/data/) into
 * people.json, partners.json, and resources.json.
 *
 * Image UUIDs are turned into full asset URLs. Records whose URL points to
 * an external (non-Directus-asset) link are split out into partners.json
 * rather than kept in people.json.
 *
 * Usage:
 *   node .claude/skills/transform-leadership/transform-leadership.js
 *
 * Output:
 *   transformed/people.json
 *   transformed/partners.json
 *   transformed/resources.json
 */

const fs = require('fs');
const path = require('path');

// --- Config ---
const ROOT = path.resolve(__dirname, '..', '..', '..');
const DATA_DIR = path.join(ROOT, 'directus-export', 'data');
const PEOPLE_TAGS_FILE = path.join(ROOT, 'directus-export', 'people-tags.json');
const OUT_FILE = path.join(ROOT, 'transformed', 'people.json');
const RESOURCES_FILE = path.join(ROOT, 'transformed', 'resources.json');
const PARTNERS_FILE = path.join(ROOT, 'transformed', 'partners.json');
const ASSET_BASE = 'https://psa-directus-prod.azurewebsites.net/assets/';
const ASSET_URL_PATTERN = 'psa-directus-prod.azurewebsites.net/assets';
const PARTNERS_TAG = 'Industry Advisory Group';
// Named individuals routed to partners.json regardless of their URL field.
const FORCE_PARTNER_NAMES = new Set(['Paul Wallworth', 'Gabby Ramsay']);

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

function assetUrl(uuid) {
	return uuid ? ASSET_BASE + uuid : null;
}

// Builds a map of trimmed fullName -> Set of category titles (e.g. "Our
// Board", "Nominations") a person is grouped under, resolved from
// people-tags.json since raw leadership records only carry an opaque,
// unresolved block_id for this grouping.
function loadCategoryMap(file) {
	const map = new Map();
	if (!fs.existsSync(file)) {
		console.warn(`   ⚠ missing people tags file: ${path.basename(file)}`);
		return map;
	}
	const groups = JSON.parse(fs.readFileSync(file, 'utf8'));
	for (const group of groups) {
		for (const member of group.members || []) {
			const key = (member.fullName || '').trim().toLowerCase();
			if (!key) continue;
			if (!map.has(key)) map.set(key, new Set());
			map.get(key).add(group.title);
		}
	}
	return map;
}

function computeTags(fullName, originalTag, categoryMap) {
	const tags = new Set();
	if (originalTag) tags.add(originalTag);
	const categories = categoryMap.get((fullName || '').trim().toLowerCase());
	if (categories) for (const c of categories) tags.add(c);
	return [...tags];
}

// --- Load + index everything once ---
console.log('\n📥 Loading export data...');

const members = readData('leadership');
const categoryMap = loadCategoryMap(PEOPLE_TAGS_FILE);

// --- Transform ---
console.log('\n🔧 Transforming leadership records...');

const statusCounts = {};
const result = [];
const resources = [];
const partners = [];

for (const member of members) {
	statusCounts[member.status] = (statusCounts[member.status] || 0) + 1;

	const url = member.URL || null;
	const isAssetUrl = url && url.includes(ASSET_URL_PATTERN);
	const isDownload = member.title === 'Download';
	const isExternalUrl = url && !isAssetUrl;
	const isForcedPartner = FORCE_PARTNER_NAMES.has(member.fullName);

	const record = {
		id: member.id,
		status: member.status,
		sort: member.sort,
		fullName: member.fullName,
		title: member.title,
		description: member.description || null,
		imageUrl: assetUrl(member.image),
		block_id: member.block_id || null,
		url,
		tags: computeTags(member.fullName, member.tag, categoryMap),
	};

	if (isForcedPartner) {
		record.tags = [PARTNERS_TAG];
		partners.push(record);
	} else if (isAssetUrl || isDownload) {
		resources.push(record);
	} else if (isExternalUrl) {
		record.tags = [PARTNERS_TAG];
		partners.push(record);
	} else {
		result.push(record);
	}
}

// Sort by sort field, then fullName for stable output
result.sort((a, b) => {
	if (a.sort !== b.sort) return (a.sort || 0) - (b.sort || 0);
	return (a.fullName || '').localeCompare(b.fullName || '');
});

// Sort partners the same way for stable output
partners.sort((a, b) => {
	if (a.sort !== b.sort) return (a.sort || 0) - (b.sort || 0);
	return (a.fullName || '').localeCompare(b.fullName || '');
});

// --- Write output ---
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
fs.writeFileSync(RESOURCES_FILE, JSON.stringify(resources, null, 2));
fs.writeFileSync(PARTNERS_FILE, JSON.stringify(partners, null, 2));

// --- Summary ---
console.log('\n--- Transform Summary ---');
console.log(`✓ ${result.length} leadership records written`);
console.log(`✓ ${partners.length} partner records written to partners.json`);
console.log(`✓ ${resources.length} resource records written to resources.json`);

console.log('\nRecords by status:');
Object.keys(statusCounts)
	.sort((a, b) => statusCounts[b] - statusCounts[a])
	.forEach((s) => console.log(`   ${s}: ${statusCounts[s]}`));

const tagCounts = {};
result.forEach((r) => {
	const list = r.tags.length ? r.tags : ['(none)'];
	list.forEach((t) => {
		tagCounts[t] = (tagCounts[t] || 0) + 1;
	});
});
console.log('\nLeadership records by tag:');
Object.keys(tagCounts)
	.sort((a, b) => tagCounts[b] - tagCounts[a])
	.forEach((t) => console.log(`   ${t}: ${tagCounts[t]}`));

const withImage = result.filter((r) => r.imageUrl).length;
const withDescription = result.filter((r) => r.description).length;
const withUrl = result.filter((r) => r.url).length;

console.log('\nResolution counts (leadership):');
console.log(`   with imageUrl:    ${withImage}`);
console.log(`   with description: ${withDescription}`);
console.log(`   with url:         ${withUrl}`);

const partnersWithImage = partners.filter((r) => r.imageUrl).length;
console.log('\nResolution counts (partners):');
console.log(`   with imageUrl:    ${partnersWithImage}`);
console.log(`   with url:         ${partners.filter((r) => r.url).length}`);

console.log(`\n📁 Output: ${OUT_FILE}`);
console.log(`📁 Output: ${PARTNERS_FILE}`);
console.log(`📁 Output: ${RESOURCES_FILE}\n`);
