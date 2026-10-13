export interface SearchableModel {
	id: string;
	name: string;
}

export function filterModelsForQuery<T extends SearchableModel>(models: readonly T[], query: string): T[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return [...models];
	}
	return models.filter(model => {
		const provider = model.id.split('/')[0] ?? '';
		return model.name.toLowerCase().includes(normalizedQuery)
			|| model.id.toLowerCase().includes(normalizedQuery)
			|| provider.toLowerCase().includes(normalizedQuery);
	});
}
