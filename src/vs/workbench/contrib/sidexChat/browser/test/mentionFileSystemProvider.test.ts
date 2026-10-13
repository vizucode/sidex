import assert from 'node:assert/strict';
import test from 'node:test';

import { MentionFileSystemProvider } from '../context/mentionFileSystemProvider.ts';
import { MentionResolver } from '../context/mentionResolver.ts';

const workspace = {
	workspaceFolders: [{ uri: { fsPath: '/work' } }],
};

const tree: Record<string, unknown[]> = {
	'/work': [
		{ name: 'src', path: '/work/src', is_dir: true, is_file: false },
		{ name: 'README.md', path: '/work/README.md', is_dir: false, is_file: true },
		{ name: 'node_modules', path: '/work/node_modules', is_dir: true, is_file: false },
		null,
	],
	'/work/src': [
		{ name: 'chatInput.ts', path: '/work/src/chatInput.ts', is_dir: false, is_file: true },
	],
	'/work/node_modules': [
		{ name: 'ignored.md', path: '/work/node_modules/ignored.md', is_dir: false, is_file: true },
	],
};

const tauriFixtureTree: Record<string, unknown[]> = {
	'/work': [
		{ name: 'AGENTS.md', path: '/work/AGENTS.md', is_dir: false, is_file: true, is_symlink: false, size: 9, modified: 1 },
		{ name: 'src', path: '/work/src', is_dir: true, is_file: false, is_symlink: false, size: 0, modified: 1 },
	],
};

test('mention provider falls back to Tauri read_dir when vscode.workspace.findFiles is unavailable', async () => {
	const calls: Array<{ cmd: string; args?: Record<string, unknown> }> = [];
	const provider = new MentionFileSystemProvider({
		workspace: undefined,
		getWorkspacePath: () => workspace.workspaceFolders[0].uri.fsPath,
		invoke: async (cmd, args) => {
			calls.push({ cmd, args });
			if (cmd === 'read_dir') { return tree[String(args?.path)] ?? []; }
			if (cmd === 'read_file') { return `content:${String(args?.path)}`; }
			return null;
		},
	});

	const resolver = new MentionResolver(provider);
	const suggestions = await resolver.getSuggestions('README');

	assert.deepEqual(suggestions.map(item => item.label), ['README.md']);
	assert.equal(await resolver.resolve(suggestions[0]), 'content:/work/README.md');
	assert.ok(calls.some(call => call.cmd === 'read_dir' && call.args?.path === '/work'));
	assert.ok(!calls.some(call => call.args?.path === '/work/node_modules'));
});

test('mention provider accepts actual Tauri read_dir DirEntry shape', async () => {
	const provider = new MentionFileSystemProvider({
		workspace: undefined,
		getWorkspacePath: () => '/work',
		invoke: async (cmd, args) => {
			if (cmd === 'read_dir') { return tauriFixtureTree[String(args?.path)] ?? []; }
			if (cmd === 'read_file') { return `content:${String(args?.path)}`; }
			return null;
		},
	});

	const resolver = new MentionResolver(provider);
	const suggestions = await resolver.getSuggestions('AG');

	assert.deepEqual(suggestions.map(item => item.label), ['AGENTS.md']);
	assert.equal(await resolver.resolve(suggestions[0]), 'content:/work/AGENTS.md');
});

