import assert from 'node:assert/strict';
import test from 'node:test';

import { MentionResolver } from '../context/mentionResolver.ts';

const files = [
	{ fsPath: '/work/src/chatInput.ts' },
	{ fsPath: '/work/docs/README.md' },
	{ fsPath: '/work/README.old.md' },
	{ fsPath: '/work/package.json' },
];

const resolver = new MentionResolver({
	async findFiles() { return files; },
	async readFile(uri) { return `content:${uri.fsPath}`; },
	async readDirectory() { return []; },
	getWorkspaceFolderPath() { return '/work'; },
});

test('mention suggestions match filename and path while typing', async () => {
	assert.deepEqual((await resolver.getSuggestions('README')).map(item => item.label), ['docs/README.md', 'README.old.md']);
	assert.deepEqual((await resolver.getSuggestions('docs/REA')).map(item => item.label), ['docs/README.md']);
});

test('mention resolution keeps paths with spaces intact', async () => {
	const spaced = new MentionResolver({
		async findFiles() { return [{ fsPath: '/work/My File.md' }]; },
		async readFile(uri) { return uri.fsPath; },
		async readDirectory() { return []; },
		getWorkspaceFolderPath() { return '/work'; },
	});
	const [item] = await spaced.getSuggestions('My File');
	assert.equal(item.label, 'My File.md');
	assert.equal(await spaced.resolve(item), '/work/My File.md');
});
