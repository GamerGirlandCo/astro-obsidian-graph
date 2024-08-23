import type { APIRoute } from "astro";
import { buildIndex } from "../utils";

export const GET: APIRoute =
	async () => {
    // console.trace()
    // console.log("MID", params, request,globalThis["linkIndex$config"])
    globalThis["foo"]
    let ind = buildIndex(globalThis["linkIndex$config"].rootDir!);
		return new Response(JSON.stringify({
      index: ind,
      links: Array.from(new Set([...Object.values(ind.backlinks), ...Object.values(ind.links)].flat(3))).filter((v, i, a) => a.findIndex(b => b.source == v.source && b.target == v.target) === i)
    }), {headers: new Headers({"content-type": "application/json"})});
	};

  export function getStaticPaths() {
    return []
  }