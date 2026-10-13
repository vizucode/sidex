/*---------------------------------------------------------------------------------------------
 *  Unit tests for sidexModelCatalog.ts.
 *
 *  Run with:
 *    node --experimental-strip-types --test src/vs/workbench/contrib/sidexChat/browser/test/sidexModelCatalog.test.ts
 *--------------------------------------------------------------------------------------------*/

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shapeSidexModelCatalog } from '../sidexModelCatalog.ts';

const contextWindowForModel = () => 0;

test('enabled models filter stale upstream IDs from picker', () => {
	const shaped = shapeSidexModelCatalog(
		[
			{ id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', provider: 'anthropic' },
			{ id: 'openai-compatible/anthropic/claude-opus-5', name: 'Claude Opus 5 via xclaw', provider: 'openai-compatible' },
		],
		['openai-compatible/anthropic/claude-opus-5'],
		[{ id: 'openai-compatible/anthropic/claude-opus-5', name: 'Claude Opus 5 via xclaw' }],
		'anthropic/claude-opus-5',
		'anthropic/claude-sonnet-4.6',
		contextWindowForModel,
	);

	assert.deepEqual(shaped.models.map(m => m.id), ['openai-compatible/anthropic/claude-opus-5']);
	assert.equal(shaped.selectedModel, 'openai-compatible/anthropic/claude-opus-5');
	assert.equal(shaped.persistSelected, true);
});

test('saved model migrates only when unambiguous custom twin is enabled', () => {
	const shaped = shapeSidexModelCatalog(
		[
			{ id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', provider: 'anthropic' },
			{ id: 'openai-compatible/anthropic/claude-opus-5', name: 'Claude Opus 5 via xclaw', provider: 'openai-compatible' },
		],
		['anthropic/claude-opus-5', 'openai-compatible/anthropic/claude-opus-5'],
		[],
		'anthropic/claude-opus-5',
		'anthropic/claude-sonnet-4.6',
		contextWindowForModel,
	);

	assert.equal(shaped.selectedModel, 'anthropic/claude-opus-5');
	assert.equal(shaped.persistSelected, false);
});
