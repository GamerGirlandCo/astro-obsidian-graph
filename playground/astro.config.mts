import tailwind from "@astrojs/tailwind";
import { createResolver } from "astro-integration-kit";
import { hmrIntegration } from "astro-integration-kit/dev";
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
const {
  default: obsidianGraph
} = await import("astro-obsidian-graph/integration");
console.log(obsidianGraph);

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), obsidianGraph({rootDir: "/"}), hmrIntegration({
    directory: createResolver(import.meta.url).resolve("../package/dist")
  })],
  output: "static",
  server: {
		host: true,
  }
});
