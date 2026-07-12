#!/usr/bin/env node

/**
 * Directus Full Export Script
 * Exports all collections + schema to JSON files in ./directus-export/
 *
 * Usage:
 *   node directus-export.js --url https://psa-directus-prod.azurewebsites.net --token N6Qtx9Sj0i1qKi9lxEZoWzED_WWKeY0W
 *
 * Output:
 *   directus-export/
 *     schema.json         ← full data model snapshot
 *     collections.json    ← list of all collections
 *     data/
 *       posts.json
 *       pages.json
 *       ... (one file per collection)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// --- Config from CLI args ---
const args = process.argv.slice(2);
const getArg = (flag) => {
	const i = args.indexOf(flag);
	return i !== -1 ? args[i + 1] : null;
};

const BASE_URL = (getArg('--url') || '').replace(/\/$/, '');
const TOKEN = getArg('--token');

if (!BASE_URL || !TOKEN) {
	console.error(
		'Usage: node directus-export.js --url <directus-url> --token <api-token>',
	);
	process.exit(1);
}

// --- Helpers ---
function fetch(url) {
	return new Promise((resolve, reject) => {
		const lib = url.startsWith('https') ? https : http;
		const req = lib.get(
			url,
			{ headers: { Authorization: `Bearer ${TOKEN}` } },
			(res) => {
				let data = '';
				res.on('data', (chunk) => (data += chunk));
				res.on('end', () => {
					if (res.statusCode >= 400) {
						reject(
							new Error(
								`HTTP ${res.statusCode} for ${url}\n${data}`,
							),
						);
					} else {
						try {
							resolve(JSON.parse(data));
						} catch (e) {
							reject(
								new Error(`Failed to parse JSON from ${url}`),
							);
						}
					}
				});
			},
		);
		req.on('error', reject);
	});
}

function writeJSON(filePath, data) {
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

// --- Main ---
async function run() {
	const outDir = path.join(process.cwd(), 'directus-export');
	const dataDir = path.join(outDir, 'data');
	fs.mkdirSync(dataDir, { recursive: true });

	console.log(`\n🔗 Connecting to: ${BASE_URL}\n`);

	// 1. Export schema snapshot
	console.log('📐 Exporting schema...');
	try {
		const schema = await fetch(`${BASE_URL}/schema/snapshot`);
		writeJSON(path.join(outDir, 'schema.json'), schema);
		console.log('   ✓ schema.json');
	} catch (e) {
		console.warn('   ⚠ Could not export schema:', e.message);
	}

	// 2. Get all collections
	console.log('\n📋 Fetching collections list...');
	const collectionsRes = await fetch(`${BASE_URL}/collections`);
	const allCollections = collectionsRes.data || [];
	writeJSON(path.join(outDir, 'collections.json'), collectionsRes);

	// Filter out system collections (prefixed with directus_)
	const userCollections = allCollections
		.map((c) => c.collection)
		.filter((name) => !name.startsWith('directus_'));

	console.log(
		`   Found ${userCollections.length} user collections (${allCollections.length - userCollections.length} system collections skipped)\n`,
	);

	if (userCollections.length === 0) {
		console.log(
			'⚠ No user collections found. Check your token has read permissions.',
		);
		return;
	}

	// 3. Export each collection
	console.log('📦 Exporting collection data...');
	const results = { success: [], failed: [] };

	for (const collection of userCollections) {
		try {
			process.stdout.write(`   ${collection}... `);
			const res = await fetch(`${BASE_URL}/items/${collection}?limit=-1`);
			const items = res.data || [];
			writeJSON(path.join(dataDir, `${collection}.json`), res);
			console.log(`✓ (${items.length} items)`);
			results.success.push({ collection, count: items.length });
		} catch (e) {
			console.log(`✗ ${e.message}`);
			results.failed.push({ collection, error: e.message });
		}
		await sleep(100); // be kind to the server
	}

	// 4. Summary
	console.log('\n--- Export Summary ---');
	console.log(`✓ ${results.success.length} collections exported`);
	const totalItems = results.success.reduce((sum, r) => sum + r.count, 0);
	console.log(`  ${totalItems} total items`);

	if (results.failed.length > 0) {
		console.log(`✗ ${results.failed.length} failed:`);
		results.failed.forEach((f) =>
			console.log(`  - ${f.collection}: ${f.error}`),
		);
	}

	console.log(`\n📁 Output: ${outDir}\n`);
}

run().catch((e) => {
	console.error('Fatal error:', e.message);
	process.exit(1);
});
