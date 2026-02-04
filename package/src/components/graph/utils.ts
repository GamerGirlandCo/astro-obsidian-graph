import { useState, useEffect, useCallback } from "react";
import chroma from "chroma-js";
import type { Point } from "pixi.js";
import { suburl } from "client-utils";
import type { FullLinkIndex } from "types";
import type { GraphLink, GraphNode, Props } from "./types";

async function getEntry({
	slug,
	collection,
	signal,
}: {
	slug: string;
	collection: string;
	signal: AbortSignal;
}) {
	try {
		const raw = await fetch(`/api/entries/${collection}/${slug}.json`, {
			signal,
		});
		const json = await raw.json();
		return json;
	} catch (e: any) {
		return null;
	}
}

export function useParsedLinks(props: Props): [GraphLink[], GraphNode[]] {
	const [links, setLinks] = useState<GraphLink[]>([]);
	const [nodes, setNodes] = useState<GraphNode[]>([]);

	useEffect(() => {
		const controller = new AbortController();
		const signal = controller.signal;
		console.debug("EFFECT");
		(async () => {
			const { links: indexLinks, index } = (await (
				await fetch("/api/links.json", { signal })
			).json()) as FullLinkIndex;
			// console.log(suburl(props.currentUrl), indexLinks, index);

			let node = suburl(props.currentUrl);
			if (node.endsWith("/")) node = node.substring(0, node.length - 1);
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
					let endIndex = id.lastIndexOf(".");
					if (endIndex == -1) endIndex = id.length;
					id = id.substring(0, endIndex);
					if (id.endsWith("/")) id = id.substring(0, id.lastIndexOf("/"));
					id = `/${b.collection}${id}`;
					return {
						id,
						title: b.data.title,
						isCurrent:
							id ===
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
				const kop = (await (
					await fetch("/api/collections.json", { signal })
				).json()) as string[];
				let wtf = (
					await Promise.all(
						inter.flatMap(async (a) => {
							let interArr = (
								await Promise.all(
									kop.flatMap(async (c) => {
										if (!a.substring(1).startsWith(c)) return null;
										let slug = a.substring(1).substring(c.length).substring(1);
										const fin = await getEntry({
											collection: c,
											slug,
											signal,
										});
										return fin;
									})
								)
							).filter((b) => !!b);
							return await Promise.all(interArr.flatMap(mapper));
						})
					)
				).flat(4);
				console.debug("wtf", wtf);
				workingSet.push(...wtf);
				console.debug("nodes", workingSet);
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
				let notIncluded = (
					await Promise.all(
						[...new Set(ilinks.flatMap((a) => [a.target, a.source]))]
							.filter((a) => !workingSet.some((b) => b.id === a))
							.map(async (a) => {
								for (const c of kop) {
									let slug = a.substring(1).substring(c.length).substring(1);
									if (slug.startsWith("/")) slug = slug.substring(1);
									const entry = await getEntry({
										collection: c,
										slug,
										signal,
									});
									if (!!entry) return mapper(entry);
								}
								return null;
							})
					)
				).filter((a) => !!a);
				workingSet.push(...notIncluded);

				setNodes(workingSet);
				setLinks(ilinks);
			}
		})();
		return () => {
			controller.abort();
		};
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

export function hexToRgb(hex: string): [number, number, number] {
	return chroma(hex).rgb();
}

export function rgbToHex(rgb: [number, number, number]) {
	return chroma(rgb).hex();
}

export function useScuffed<T>(promise: Promise<T>) {
	const [res, setRes] = useState<T>();
	useEffect(() => {
		(async () => {
			setRes(await promise);
		})();
	}, [setRes]);
	return res;
}

export function getMixedColor(
	fg: [number, number, number],
	bg: [number, number, number],
	fgAlpha: number
) {
	return chroma.mix(chroma(bg), chroma(fg), fgAlpha, "rgb").hex();
}

export function cssToRgb(css: string): [number, number, number, number] {
	return chroma(css).rgba();
}

export function isNone(css: string): boolean {
	return (
		css === "none" ||
		css === "" ||
		cssToRgb(css)
			.slice(0, 3)
			.every((a) => a === 0)
	);
}

export function getInheritedBackgroundColor(element: HTMLElement): string {
	let style = getComputedStyle(element);
	let raw = style.backgroundColor;
	if (
		raw === "rgba(0, 0, 0, 0)" ||
		raw === "transparent" ||
		raw === "none" ||
		!raw
	) {
		raw = style.background;
		if (element.parentElement) {
			return getInheritedBackgroundColor(element.parentElement);
		}
	}
	return raw;
}

export function angleBetweenPoints(p1: Point, p2: Point, offset: number = 0) {
	const dx = p1.x - p2.x;
	const dy = p1.y - p2.y;

	let angleRad = Math.atan2(dy, dx);

	let angleDeg = angleRad * (180 / Math.PI);

	angleDeg = -(90 - angleDeg) % 360;

	angleDeg += offset;

	if (angleDeg < 0) {
		angleDeg += 360;
	}

	return angleDeg;
}

export function getPropertyValue(maybeProperty: string): string {
	if (maybeProperty.startsWith("--")) {
		const value = getComputedStyle(document.documentElement).getPropertyValue(
			maybeProperty
		);
		let color = value;
		while (!chroma.valid(color)) {
			const tmpDiv = document.createElement("div");
			tmpDiv.style.color = value;
			document.body.appendChild(tmpDiv);
			color = getComputedStyle(tmpDiv).color;
			document.body.removeChild(tmpDiv);
		}
		return chroma(color).hex();
	}
	return maybeProperty;
}
