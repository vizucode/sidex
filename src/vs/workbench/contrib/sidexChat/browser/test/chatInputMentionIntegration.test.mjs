import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { transformSync } from 'esbuild';

const source = readFileSync('src/vs/workbench/contrib/sidexChat/browser/components/input/chatInput.ts', 'utf8');
const transformed = transformSync(source, { loader: 'ts', format: 'esm' }).code;
const match = transformed.match(/_getTauriInvoke\(\) \{[\s\S]*?\n  \}/);
assert.ok(match, 'ChatInput._getTauriInvoke exists');
const methodSource = `function ${match[0].trim()}`;
const getTauriInvoke = new Function(`${methodSource}; return _getTauriInvoke.call(globalThis);`);

test('ChatInput mention wiring uses __TAURI_INTERNALS__.invoke when __TAURI__ is absent', async () => {
	delete globalThis.__TAURI__;
	delete globalThis.__TAURI_INVOKE__;
	const calls = [];
	globalThis.__TAURI_INTERNALS__ = {
		invoke: async (cmd, args) => {
			calls.push({ cmd, args });
			if (cmd === 'read_dir') {
				return [{ name: 'AGENTS.md', path: '/work/AGENTS.md', is_dir: false, is_file: true }];
			}
			if (cmd === 'read_file') { return 'agents'; }
			throw new Error(`unexpected command: ${cmd}`);
		},
	};

	try {
		const invoke = getTauriInvoke();
		assert.equal(invoke, globalThis.__TAURI_INTERNALS__.invoke);

		const { MentionFileSystemProvider } = await import('../context/mentionFileSystemProvider.ts');
		const { MentionResolver } = await import('../context/mentionResolver.ts');
		const resolver = new MentionResolver(new MentionFileSystemProvider({
			invoke: (command, args) => {
				const tauriInvoke = getTauriInvoke();
				if (!tauriInvoke) { return Promise.reject(new Error('Workspace file access is unavailable')); }
				return tauriInvoke(command, args);
			},
			getWorkspacePath: () => '/work',
		}));

		const [suggestion] = await resolver.getSuggestions('AG');
		assert.equal(suggestion.label, 'AGENTS.md');
		assert.equal(await resolver.resolve(suggestion), 'agents');
		assert.deepEqual(calls.map(call => call.cmd), ['read_dir', 'read_file']);
	} finally {
		delete globalThis.__TAURI_INTERNALS__;
	}
});
