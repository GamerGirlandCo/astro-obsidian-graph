import { getEntry } from "astro:content";
import { suburl } from "client-utils";
import { useState, useEffect } from "react";
import type { FullLinkIndex } from "types";
import type { GraphLink, GraphNode, Props } from "./types";

export function useParsedLinks(props: Props): [GraphLink[], GraphNode[]] {
	const [links, setLinks] = useState<GraphLink[]>([]);
	const [nodes, setNodes] = useState<GraphNode[]>([]);
	useEffect(() => {
		console.log("EFFECT");
		(async () => {
			const { links: indexLinks, index } = (await (
				await fetch("/links")
			).json()) as FullLinkIndex;
			console.log(suburl(props.currentUrl), indexLinks, index);

			const node = suburl(props.currentUrl);
			let workingSet: GraphNode[] = [];
			if (node) {
				const incoming = index.backlinks[node] || [];
				const outgoing = index.links[node] || [];
				const inter = [
					...new Set([
						...outgoing.map((l) => l.target),
						...incoming.map((l) => l.source),
					]),
					node,
				];
				const mapper = async (a) => {
					const b = a;
					let id = b.id.startsWith("/") ? b.id : `/${b.id}`;
					id = id.substring(0, id.lastIndexOf("."));
					if (id.endsWith("/")) id = id.substring(0, id.lastIndexOf("/"));
					id = `/${b.collection}${id}`;
					return {
						id,
						title: b.data.title,
						isCurrent:
							`/${b.collection}${id}` ===
							(props.currentUrl.endsWith("/")
								? props.currentUrl.substring(
										0,
										props.currentUrl.lastIndexOf("/")
								  )
								: props.currentUrl),
						color: useGraphColor(b.id, props),
						collection: b.collection,
						hover: false,
					} as GraphNode;
				};
				const kop = (await (await fetch("/collections")).json()) as string[];
				let wtf = (
					await Promise.all(
						inter.flatMap(async (a) => {
							let interArr = (
								await Promise.all(
									kop.flatMap(async (c) => {
										const fin = await getEntry({
											collection: c,
											slug: a.substring(1).substring(c.length).substring(1),
										});
										return fin;
									})
								)
							).filter((b) => !!b);
							return await Promise.all(interArr.flatMap(mapper));
						})
					)
				).flat(4);
				console.log("wtf", wtf);
				workingSet.push(...wtf);
				console.log("nodes", workingSet);
				/* workingSet = workingSet.filter((v, _, a) => {
					console.log("fil", v);
					return a.findIndex((b) => b.id === v.id) != -1;
				}); */
				const ilinks = indexLinks
					.filter(
						(l) =>
							workingSet.some((m) => m.id === l.source) ||
							workingSet.some((m) => m.id === l.target)
					)
					.map((e, _, a) => ({
						...e,
						strength:
							Math.log1p(
								workingSet.filter((m) => m.id === e.source || m.id === e.target)
									.length / a.length
							) **
							(Math.random() * 2),
					}));
				let notIncluded = (await Promise.all(
					[...new Set(ilinks.flatMap((a) => [a.target, a.source]))]
						.filter((a) => !workingSet.some((b) => b.id === a))
						.map(async (a) => {
							for (const c of kop) {
								const entry = await getEntry({
									collection: c,
									slug: a.substring(1).substring(c.length).substring(1),
								});
								if(!!entry) return mapper(entry);
							}	
							return null;
						})
				)).filter(a => !!a);
				workingSet.push(...notIncluded);	
				setNodes(workingSet);
				setLinks(ilinks);
				console.log(
					"links",
					links.map((a) => a.strength)
				);
			}
		})();
	}, [setNodes, setLinks, props]);
	return [links, nodes];
}

export function useGraphColor(d: string, props: Omit<Props, "rootDir">) {
	const pathColors = props.pathColors;
	for (const col in pathColors) {
		if (d.startsWith(col)) {
			return pathColors[col]!.color;
		}
	}
	return props.colors!.nodeInactive!;
}

export function parseIdsFromLinks(links: GraphLink[]): string[] {
	return [
		...new Set(
			links.flatMap((link) => [link.source as string, link.target as string])
		),
	];
}
