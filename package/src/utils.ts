import {readFileSync} from "fs";
import fg from "fast-glob";
import { SUPPORTED_MARKDOWN_FILE_EXTENSIONS } from "@external/astro/dist/core/constants";
import type { LinkIndex } from "./types";
import { unified } from "unified";
import remarkWikiLink from "@flowershow/remark-wiki-link";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { visitParents } from "unist-util-visit-parents";
import { collapseTextChangeRangesAcrossMultipleVersions } from "typescript";
const {globSync} = fg;

export const getAllFiles = (root: string): string[] => {
	return globSync(
		[
			`**/*.{${SUPPORTED_MARKDOWN_FILE_EXTENSIONS.map((a) =>
				a.substring(1)
			).join(",")},mdx}`,
			"!**/templates/**/*.*",
			"!**/_templates/**/*.*",
		],
		{
			cwd: "src/content" + root,
			globstar: true,
			onlyFiles: true,
			extglob: true,
			followSymbolicLinks: true,
			caseSensitiveMatch: false,
		}
	)
}
export const buildIndex = (root: string): LinkIndex => {
	const finalIndex: LinkIndex = {
		backlinks: {},
		links: {},
	};
	// console.log("BUILD INDEX ROOT", root)
	const files = getAllFiles(root).map((a) => `/${a}`);
	console.log(files.filter(a => a.includes("random")).slice(0, 10))
	for (let f of files) {
		const rf = f.substring(0, f.lastIndexOf("."));
		const content = readFileSync("src/content" + root + f).toString();
		// console.log("RF", rf, "F", f);
		const tree = unified()
			.use(remarkParse)
			.use(remarkFrontmatter)
			.use(remarkMdx)
			.use(remarkWikiLink, { files: getAllFiles(root), format: "shortestPossible" })
			.parse(content);

		visitParents(tree, "wikiLink", (node: any) => {
			if (node.data.exists) {
				let realPermalink = `${node.data.permalink}`
				if (!(rf in finalIndex.backlinks)) {
					finalIndex.backlinks[rf] = [];
				}
				if (!(realPermalink in finalIndex.backlinks)) {
					finalIndex.backlinks[realPermalink] = [];
				}
				if (!(rf in finalIndex.links)) {
					finalIndex.links[rf] = [];
				}
				if (!(realPermalink in finalIndex.links)) {
					finalIndex.links[realPermalink] = [];
				}
				finalIndex.links[rf]!.push({
					source: rf,
					target: realPermalink,
				});
				finalIndex.backlinks[rf]!.push({
					source: realPermalink,
					target: rf,
				});
				finalIndex.links[realPermalink]!.push({
					source: realPermalink,
					target: rf,
				});
				finalIndex.backlinks[realPermalink]!.push({
					source: rf,
					target: realPermalink,
				});
				// console.log(rf);
				// console.log(node);
			}
		});
	}
	return finalIndex;
}

export const buildCollectionArray = (): string[] => {
	const collections = globSync("*", {
		onlyDirectories: true,
		cwd: "src/content",
		dot: true
	})
	return collections;
}

