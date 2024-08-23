import { SUPPORTED_MARKDOWN_FILE_EXTENSIONS } from "@external/astro/dist/core/constants";
import type { APIRoute } from "astro";
import { getEntry } from "astro:content";
import fg from "fast-glob";
const { globSync } = fg;

export const GET: APIRoute = async ({ params }) => {
	const { collection, slug } = params;
	const entry = await getEntry({
		slug,
		collection,
	});
	const headers = new Headers();
	headers.append("content-type", "application/json");
	return new Response(JSON.stringify(entry), { headers });
};

export function getStaticPaths() {
	const paths: { params: { slug: string; collection: string } }[] = [];
	const collections = globSync("*", {
		cwd: "src/content",
		onlyDirectories: true,
		caseSensitiveMatch: false,
	});

	for (let c of collections) {
		const files = globSync(
			[
				`**/*.{${SUPPORTED_MARKDOWN_FILE_EXTENSIONS.map((a) =>
					a.substring(1)
				).join(",")},mdx}`,
				"!**/templates/**/*.*",
				"!**/_templates/**/*.*",
			],
			{
				cwd: `src/content/${c}`,
				globstar: true,
				onlyFiles: true,
				extglob: true,
				followSymbolicLinks: true,
				caseSensitiveMatch: false,
			}
		);
		for (let f of files) {
			paths.push({
				params: {
					collection: c,
					slug: f.substring(0, f.lastIndexOf(".")),
				},
			});
		}
	}
	return paths;
}
