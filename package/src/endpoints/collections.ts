import type { APIRoute } from "astro";
import { buildCollectionArray } from "utils";

export const GET: APIRoute = () => {
	const colls = buildCollectionArray();
	return new Response(JSON.stringify(colls), {headers: new Headers({"content-type": "application/json"})});
}