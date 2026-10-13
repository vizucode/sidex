/*---------------------------------------------------------------------------------------------
 *  Model catalog shaping for SideX chat.
 *--------------------------------------------------------------------------------------------*/

export interface SidexRawModel {
	id: string;
	name: string;
	provider: string;
	context_window?: number;
	contextWindow?: number;
}

export interface SidexModel {
	id: string;
	name: string;
	provider: string;
	contextWindow?: number;
}

export interface SidexCustomModel {
	id?: string;
	name?: string;
}

export interface SidexCatalogResult {
	models: SidexModel[];
	selectedModel: string;
	persistSelected: boolean;
}

function customModelId(entry: string | SidexCustomModel): string | undefined {
	return typeof entry === 'string' ? entry : entry?.id;
}

function customModelName(entry: string | SidexCustomModel, id: string): string {
	return typeof entry === 'object' && entry?.name ? entry.name : id;
}

export function shapeSidexModelCatalog(
	allModels: SidexRawModel[],
	enabledRaw: unknown,
	customRaw: unknown,
	selectedModel: string,
	defaultModelId: string,
	contextWindowForModel: (id: string) => number,
): SidexCatalogResult {
	let models = allModels.map(m => ({
		id: m.id,
		name: m.name,
		provider: m.provider,
		contextWindow: m.contextWindow || m.context_window || contextWindowForModel(m.id),
	}));

	if (Array.isArray(customRaw)) {
		for (const entry of customRaw as Array<string | SidexCustomModel>) {
			const id = customModelId(entry);
			if (id && !models.find(m => m.id === id)) {
				models = [...models, { id, name: customModelName(entry, id), provider: 'custom' }];
			}
		}
	}

	const enabledIds = Array.isArray(enabledRaw)
		? new Set((enabledRaw as unknown[]).filter((id): id is string => typeof id === 'string'))
		: undefined;
	if (enabledIds) {
		models = models.filter(m => enabledIds.has(m.id));
	}

	let persistSelected = false;
	const customRoutedModel = `openai-compatible/${selectedModel}`;
	if (enabledIds?.has(customRoutedModel) && models.some(m => m.id === customRoutedModel) && !models.some(m => m.id === selectedModel)) {
		selectedModel = customRoutedModel;
		persistSelected = true;
	}

	const stillOffered = models.some(m => m.id === selectedModel);
	if (!stillOffered && models.length > 0) {
		const preferred = models.find(m => /sonnet/i.test(m.id))
			|| models.find(m => /haiku/i.test(m.id))
			|| models[0];
		selectedModel = preferred.id;
		persistSelected = true;
	}
	if (!selectedModel) {
		selectedModel = defaultModelId;
		persistSelected = true;
	}

	return { models, selectedModel, persistSelected };
}
