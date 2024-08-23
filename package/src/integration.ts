import { defineIntegration } from "astro-integration-kit";
import type { LinkIndexConfig } from "./types";
import {z} from "astro/zod"
import { LinkIndex } from "./link-index";

export const obsidianGraph = defineIntegration({
	name: "astro-obsidian-graph",
  optionsSchema: z.object({
    rootDir: z.string().optional()
  }),
	setup({options}) {
    let {hooks} = new LinkIndex(options as LinkIndexConfig)
		globalThis["linkIndex$config"] = options as LinkIndexConfig;
		return {hooks}; 
	},
});
