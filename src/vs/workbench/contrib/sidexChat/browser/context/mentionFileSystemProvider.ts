/*---------------------------------------------------------------------------------------------
 *  MentionFileSystemProvider — workspace file access for @ mention suggestions
 *--------------------------------------------------------------------------------------------*/

import type { FileUri } from './mentionResolver.js';

interface WorkspaceLike {
	workspaceFolders?: Array<{ uri?: { fsPath?: string } }>;
	findFiles?: (pattern: string, exclude?: string, maxResults?: number) => Promise<FileUri[]>;
	fs?: {
		readFile?: (uri: FileUri) => Promise<Uint8Array>;
		readDirectory?: (uri: FileUri) => Promise<Array<[string, number]>>;
	};
}

interface DirEntry {
	name: string;
	path: string;
	is_dir: boolean;
	is_file: boolean;
}

interface MentionFileSystemProviderOptions {
	workspace?: WorkspaceLike;
	invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
	getWorkspacePath?: () => string | null | undefined;
}

const FILE_TYPE_DIRECTORY = 2;
const SKIP_DIRS = new Set(['.git', 'node_modules']);

export class MentionFileSystemProvider {
	private readonly _workspace: WorkspaceLike | undefined;
	private readonly _invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
	private readonly _getWorkspacePath?: () => string | null | undefined;

	constructor(options: MentionFileSystemProviderOptions) {
		this._workspace = options.workspace ?? (globalThis as { vscode?: { workspace?: WorkspaceLike } }).vscode?.workspace;
		this._invoke = options.invoke;
		this._getWorkspacePath = options.getWorkspacePath;
	}

	async findFiles(pattern: string, maxResults: number): Promise<FileUri[]> {
		try {
			if (this._workspace?.findFiles) {
				return await this._workspace.findFiles(pattern, '**/node_modules/**', maxResults);
			}
		} catch { /* fallback */ }

		const root = this.getWorkspaceFolderPath();
		if (!root) { return []; }

		const found: FileUri[] = [];
		await this._walk(root, found, maxResults);
		return found;
	}

	async readFile(uri: FileUri): Promise<string> {
		try {
			if (this._workspace?.fs?.readFile) {
				const bytes = await this._workspace.fs.readFile(uri);
				return new TextDecoder().decode(bytes);
			}
		} catch { /* fallback */ }

		try {
			const content = await this._invoke('read_file', { path: uri.fsPath });
			return typeof content === 'string' ? content : '';
		} catch {
			return '';
		}
	}

	async readDirectory(uri: FileUri): Promise<Array<[string, 'file' | 'directory']>> {
		try {
			if (this._workspace?.fs?.readDirectory) {
				const entries = await this._workspace.fs.readDirectory(uri);
				return entries.map(([name, type]) => [name, type === FILE_TYPE_DIRECTORY ? 'directory' : 'file']);
			}
		} catch { /* fallback */ }

		const entries = await this._readDir(uri.fsPath);
		return entries.map(entry => [entry.name, entry.is_dir ? 'directory' : 'file']);
	}

	getWorkspaceFolderPath(): string | undefined {
		try {
			return this._workspace?.workspaceFolders?.[0]?.uri?.fsPath ?? this._getWorkspacePath?.() ?? undefined;
		} catch {
			return undefined;
		}
	}

	private async _walk(dir: string, found: FileUri[], maxResults: number): Promise<void> {
		const queue = [dir];

		while (queue.length > 0 && found.length < maxResults) {
			const current = queue.shift()!;
			let entries: DirEntry[];
			try {
				entries = await this._readDir(current);
			} catch {
				continue;
			}

			entries.sort((a, b) => Number(a.is_dir) - Number(b.is_dir) || a.name.localeCompare(b.name));
			for (const entry of entries) {
				if (found.length >= maxResults) { return; }
				if (entry.is_dir && SKIP_DIRS.has(entry.name)) { continue; }
				if (entry.is_file) { found.push({ fsPath: entry.path }); }
				if (entry.is_dir) { queue.push(entry.path); }
			}
		}
	}

	private async _readDir(path: string): Promise<DirEntry[]> {
		const result = await this._invoke('read_dir', { path });
		const entries = Array.isArray(result) ? result : [];
		return entries.map(this._normalizeDirEntry).filter(entry => entry !== null);
	}

	private _normalizeDirEntry(value: unknown): DirEntry | null {
		if (!value || typeof value !== 'object') { return null; }
		const entry = value as Partial<DirEntry>;
		if (typeof entry.name !== 'string' || typeof entry.path !== 'string') { return null; }
		if (typeof entry.is_dir !== 'boolean' || typeof entry.is_file !== 'boolean') { return null; }

		return { name: entry.name, path: entry.path, is_dir: entry.is_dir, is_file: entry.is_file };
	}
}
