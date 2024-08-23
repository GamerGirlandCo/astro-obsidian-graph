export type LinkIndexConfig = {
	rootDir: string;
	excludes: RegExp[];
}
export interface IndexLink {
	source: string;
	target: string;
}
export interface LinkIndex {
	backlinks: Record<string, IndexLink[]>;
	links: Record<string, IndexLink[]>;
}

export interface FullLinkIndex {
	index: LinkIndex;
	links: IndexLink[];
}