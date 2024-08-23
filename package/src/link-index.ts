import type { AstroIntegration, AstroGlobalPartial, AstroConfig } from "astro";
import { createAstro } from "../node_modules/astro/dist/runtime/server/astro-global.js";
import react from "@astrojs/react";
import type { LinkIndexConfig } from "./types";
import mdx from "@astrojs/mdx";
import remarkWikiLink from "@portaljs/remark-wiki-link";
import { permalinks } from "./permalinks";
export class LinkIndex implements AstroIntegration {
	private static staticCfg: Partial<LinkIndexConfig> = {};
	public readonly name: string = "link-graph-thing";
	public constructor(public cfg: Partial<LinkIndexConfig> = {}) {
		LinkIndex.staticCfg = Object.assign(LinkIndex.staticCfg, cfg);
	}
	public get rootDir() {
		return LinkIndex.staticCfg.rootDir;
	}
	public get integrationConfig() {
		console.log("GETTING", LinkIndex.staticCfg);
		return LinkIndex.staticCfg as LinkIndexConfig;
	}
	public set integrationConfig(val: LinkIndexConfig) {
		console.trace();
		console.log("SETTING INTEGRATION CONFIG");
		LinkIndex.staticCfg = val;
	}
	public astro!: AstroGlobalPartial;
	public config?: AstroConfig;
	public get hooks(): AstroIntegration["hooks"] {
		return {
			"astro:config:setup": ({ updateConfig, injectRoute }) => {
				updateConfig({
					prefetch: true,
					integrations: [react(), mdx({ extendMarkdownConfig: true })],	
					markdown: {
						remarkPlugins: [
							[
								remarkWikiLink,
								{
									permalinks: permalinks(this.cfg.rootDir!),
									pathFormat: "obsidian-short",
								},
							],
						],
					},
				});	
				injectRoute({
					entrypoint: "astro-obsidian-graph/endpoints/links",
					pattern: "/api/links.json",
				});
				injectRoute({
					entrypoint: "astro-obsidian-graph/endpoints/collections",
					pattern: "/api/collections.json"
				});
				injectRoute({
					entrypoint: "astro-obsidian-graph/endpoints/entry",
					pattern: "/api/entries/[collection]/[...slug].json"
				});
			},
			"astro:config:done": async ({ config }) => {
				this.config = config;
				this.astro = createAstro(config.site);
			},
			// 	"astro:server:setup": async ({ server }) => {
			// 		server.watcher.on("change", (path) => {
			// 			if (!/.*?content[\\/]links[\\/].*/i.test(path)) {
			// 				console.log("CHANGE", path);
			// 				this.generateLinkIndex({ dir: this.config!.outDir.toString() });
			// 			}
			// 		});
			// 		await this.generateLinkIndex({ dir: this.config!.outDir.toString() });
			// 	},
			// };
		};
	}
}
