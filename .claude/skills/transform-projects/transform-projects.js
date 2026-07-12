#!/usr/bin/env node

/**
 * Transform Projects
 * Flattens the raw Directus export (directus-export/data/) into a single
 * projects.json — an array of fully-resolved project records.
 *
 * Every junction-table ID is resolved to its actual record, and image UUIDs
 * are turned into full asset URLs.
 *
 * Usage:
 *   node .claude/skills/transform-projects/transform-projects.js
 *
 * Output:
 *   transformed/projects.json
 */

const fs = require('fs');
const path = require('path');

// --- Config ---
const ROOT = path.resolve(__dirname, '..', '..', '..');
const DATA_DIR = path.join(ROOT, 'directus-export', 'data');
const OUT_FILE = path.join(ROOT, 'transformed', 'projects.json');
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

function assetUrl(uuid) {
	return uuid ? ASSET_BASE + uuid : null;
}

// --- Load + index everything once ---
console.log('\n📥 Loading export data...');

const projects = readData('project');
const categoryById = indexBy(readData('project_category'), 'id');
const categoryMappingById = indexBy(readData('project_category_mapping'), 'id');
const tagById = indexBy(readData('project_tag'), 'id');
const tagMappingById = indexBy(readData('project_project_tag'), 'id');
const filesMappingById = indexBy(readData('project_files'), 'id');

// --- Transform ---
console.log('\n🔧 Transforming projects...');

const skipped = [];
const statusCounts = {};
const result = [];

for (const project of projects) {
	statusCounts[project.status] = (statusCounts[project.status] || 0) + 1;

	// Resolve categories: junction IDs → category records
	const categories = (project.categories || [])
		.map((junctionId) => categoryMappingById.get(junctionId))
		.filter((m) => m && m.project_category_id != null)
		.map((m) => categoryById.get(m.project_category_id))
		.filter(Boolean)
		.map((c) => ({ id: c.id, name: c.name, slug: c.slug }));

	// Resolve tags: junction IDs → tag records
	const tags = (project.tags || [])
		.map((junctionId) => tagMappingById.get(junctionId))
		.filter((m) => m && m.project_tag_id != null)
		.map((m) => tagById.get(m.project_tag_id))
		.filter(Boolean)
		.map((t) => ({ id: t.id, name: t.name }));

	// Resolve images: junction IDs → file UUIDs → asset URLs
	const images = (project.images || [])
		.map((junctionId) => filesMappingById.get(junctionId))
		.filter((f) => f && f.directus_files_id)
		.map((f) => assetUrl(f.directus_files_id));

	const resolvedStages = (project.stages || []).map((s) => {
		let desc = s.stageDescription || '';
		if (s.accordion && s.accordion.length > 0) {
			const extra = s.accordion
				.map((a) => `### ${a.title}\n\n${a.description}`)
				.join('\n\n');
			desc = desc ? `${desc}\n\n${extra}` : extra;
		}
		return {
			stageTitle: s.stageTitle,
			startDate: s.startDate,
			endDate: s.endDate,
			isDone: s.isDone,
			stageDescription: desc,
		};
	});

	const overviewIndex = resolvedStages.findIndex((s) => s.stageTitle === 'Project Overview');
	const projectOverview = overviewIndex !== -1 ? resolvedStages[overviewIndex] : null;
	const stages = overviewIndex !== -1
		? resolvedStages.filter((_, i) => i !== overviewIndex)
		: resolvedStages;

	result.push({
		id: project.id,
		status: project.status,
		dateCreated: project.date_created || null,
		slug: project.slug,
		title: project.title,
		shortDescription: project.shortDescription,
		ctaTitle: project.ctaTitle,
		ctaUrl: project.ctaUrl,
		images,
		categories,
		tags,
		hyperlinks: [
			...(project.ctaTitle && project.ctaUrl ? [{ title: project.ctaTitle, url: project.ctaUrl }] : []),
			...(project.hyperlinks || []),
		],
		projectOverview,
		stages,
	});
}

// --- Write output ---
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));

// --- Summary ---
console.log('\n--- Transform Summary ---');
console.log(`✓ ${result.length} projects written`);

console.log('\nProjects by status:');
Object.keys(statusCounts)
	.sort((a, b) => statusCounts[b] - statusCounts[a])
	.forEach((s) => console.log(`   ${s}: ${statusCounts[s]}`));

const withCategories = result.filter((p) => p.categories.length > 0).length;
const withTags = result.filter((p) => p.tags.length > 0).length;
const withImages = result.filter((p) => p.images.length > 0).length;
const withStages = result.filter((p) => p.stages.length > 0).length;
const withHyperlinks = result.filter((p) => p.hyperlinks.length > 0).length;

console.log('\nResolution counts:');
console.log(`   with categories:  ${withCategories}`);
console.log(`   with tags:        ${withTags}`);
console.log(`   with images:      ${withImages}`);
console.log(`   with stages:      ${withStages}`);
console.log(`   with hyperlinks:  ${withHyperlinks}`);

if (skipped.length > 0) {
	console.log(`\n⚠ ${skipped.length} skipped:`);
	skipped.forEach((s) => console.log(`   - ${s}`));
}

console.log(`\n📁 Output: ${OUT_FILE}\n`);
