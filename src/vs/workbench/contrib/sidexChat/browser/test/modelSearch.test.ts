import assert from 'node:assert/strict';
import test from 'node:test';

import { filterModelsForQuery } from '../components/input/modelSearch.ts';

const models = [
	{ id: 'openai-compatible/anthropic/claude-opus-5', name: 'Claude Opus 5' },
	{ id: 'gemini/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
	{ id: 'local/llama', name: 'Llama Local' },
];

test('model search matches name id and provider case-insensitively', () => {
	assert.deepEqual(filterModelsForQuery(models, 'OPUS').map(m => m.id), ['openai-compatible/anthropic/claude-opus-5']);
	assert.deepEqual(filterModelsForQuery(models, '2.5').map(m => m.id), ['gemini/gemini-2.5-pro']);
	assert.deepEqual(filterModelsForQuery(models, 'LOCAL').map(m => m.id), ['local/llama']);
});

test('model search keeps all models for blank query', () => {
	assert.deepEqual(filterModelsForQuery(models, '  ').map(m => m.id), models.map(m => m.id));
});
