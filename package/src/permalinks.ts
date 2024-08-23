import {getPermalinks} from "@portaljs/remark-wiki-link"

export const permalinks = (root: string) => getPermalinks(`src/content${root.startsWith("/") ? root.substring(1) : `${root}`}`, [/.*[\\/]templates[\\/].*/i, /.*\.tsx?$/i], (
  filePath,
  markdownFolder
) => {
	// console.log(filePath, markdownFolder)
  let permalink = filePath.replace(/\\/g, "/")
	.replace(markdownFolder, "") // make the permalink relative to the markdown folder
	permalink = permalink.substring(0, permalink.lastIndexOf("."))
     // replace windows backslash with forward slash
		//  console.log("PERMA", permalink)
  return permalink.length > 0 ? permalink : "/"; // for home page
});