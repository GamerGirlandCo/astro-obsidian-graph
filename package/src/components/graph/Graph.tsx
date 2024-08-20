import React, {
	useEffect,
	useMemo,
	useRef,
	useState,
	type MutableRefObject,
} from "react";
import type { Simulation } from "d3-force";
import * as d3fc from "@d3fc/d3fc-label-layout";
const {
	layoutTextLabel,
	layoutLabel,
	layoutGreedy,
	layoutAnnealing,
	layoutBoundingBox,
} = d3fc;
import {
	type ContentCollectionKey,
	getCollection,
	getEntry,
	type ContentConfig,
} from "astro:content";
import type { Props, Rect } from "./types";
import * as d3 from "d3";
import type { GraphLink, GraphNode } from "./types";
import { navigate } from "astro:transitions/client";
import { prefetch } from "astro:prefetch";
import type { AstroBuiltinProps } from "astro";
import type { FullLinkIndex } from "types";
import { keys } from "ts-transformer-keys";

function isOverlapping(
	first: Rect,
	second: Rect,
	pad: number = 10
): {
	x: boolean;
	y: boolean;
} {
	let b = {
		x: first.x < second.right + pad && first.x > second.left + pad,
		y: first.y < second.bottom + pad && first.y > second.top + pad,
	};
	return b;
}

function makeRect(d: GraphNode, el: SVGGraphicsElement) {
	let bbox = el.getBBox();
	let curRect: Rect = {
		x: d.x || 0,
		y: d.y || 0,
		width: bbox?.width || 0,
		height: bbox?.height || 0,
		left: bbox?.left || 0,
		right: bbox?.right || 0,
		bottom: bbox?.bottom || 0,
		top: bbox?.top || 0,
	};
	return { rect: curRect, bbox };
}

function useGraphColor(d: string, props: Omit<Props, "rootDir">) {
	const pathColors = props.pathColors;
	for (const col in pathColors) {
		if (d.startsWith(col)) {
			return pathColors[col]!.color;
		}
	}
	return props.colors!.nodeInactive!;
}

function parseIdsFromLinks(links: GraphLink[]): string[] {
	return [
		...new Set(
			links.flatMap((link) => [link.source as string, link.target as string])
		),
	];
}

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
			console.log(node, suburl, props);
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
				const kop = (await (await fetch("/collections")).json()) as string[];
				console.log(kop, inter);
				let wtf = (
					await Promise.all(
						inter.flatMap(async (a) => {
							console.log("A", a);
							let interArr = (
								await Promise.all(
									kop.flatMap(async (c) => {
										const fin = await getEntry({
											collection: c,
											slug: a.substring(1),
										});
										console.log("finy", fin);
										return fin;
									})
								)
							).filter((b) => !!b);
							console.log("interArr->", interArr);
							return await Promise.all(
								interArr.flatMap(async (a) => {
									const b = a;
									let id = b.id.startsWith("/") ? b.id : `/${b.id}`;
									id = id.substring(0, id.lastIndexOf("."));
									if (id.endsWith("/"))
										id = id.substring(0, id.lastIndexOf("/"));
									console.log(
										"BBBBB",
										b,
										id,
										props.currentUrl,
										`/${b.collection}${id}`
									);
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
								})
							);
						})
					)
				).flat(4);

				workingSet.push(...wtf);
				console.log("nodes", workingSet);
				/* workingSet = workingSet.filter((v, _, a) => {
					console.log("fil", v);
					return a.findIndex((b) => b.id === v.id) != -1;
				}); */
				setNodes(workingSet);
				console.log("linkos", indexLinks);
				setLinks(
					indexLinks
						.filter(
							(l) =>
								workingSet.some((m) => m.id === l.source) ||
								workingSet.some((m) => m.id === l.target)
						)
						.map((e) => ({ ...e, strength: 1 }))
				);
			}
		})();
	}, [setNodes, setLinks, props]);
	return [links, nodes];
}

function runGraph(
	props: {
		nodes: GraphNode[];
		links: GraphLink[];
		flattened: string[];
		container: MutableRefObject<HTMLDivElement | null>;
	} & Props
) {
	const {
		nodes,
		links,
		container,
		currentUrl,
		graphConfig = {
			enableZoom: false,
			repelForce: 3,
		},
		colors,
		enableLegend = true,
		pathColors,
		flattened,
		fontSize = 0.65,
		labels: labelProps = Object.assign(
			{ borderWidth: 0, padding: 6, borderStyle: "solid" },
			props.labels
		),
		...rest
	} = props;
	const {
		nodeInactive = "#1aadab",
		activeNode = "#00e7e3",
		linkInactive = "#adadad",
		activeLink = "#ff69a3",
		nodeStroke = "#000",
		labelBg = "#f00",
		labelBorder: labelBorderStroke = "#000",
	} = colors;
	console.log("LINKS", links, nodes);
	function drag<T extends Element>(
		simulation: Simulation<GraphNode, GraphLink>
	) {
		function dragstarted(event: any, d: GraphNode) {
			if (!event.active) simulation.alphaTarget(1).restart();
			d.fx = d.x;
			d.fy = d.y;
		}

		function dragged(event: any, d: GraphNode) {
			d.fx = event.x;
			d.fy = event.y;
		}

		function dragended(event: any, d: GraphNode) {
			if (!event.active) simulation.alphaTarget(0);
			d.fx = null;
			d.fy = null;
		}

		return d3
			.drag<T, GraphNode>()
			.on("start", dragstarted)
			.on("drag", dragged)
			.on("end", dragended);
	}

	const height = Math.max(
		container!.current?.offsetHeight ?? 300,
		currentUrl === "/" ? 300 : 250
	);
	const width = container.current?.offsetWidth ?? 300;

	const simulation = d3
		.forceSimulation<GraphNode>(nodes)
		.force(
			"charge",
			d3.forceManyBody().strength(-100 * graphConfig.repelForce!)
		)
		.force(
			"link",
			d3
				.forceLink<GraphNode, GraphLink>(links)
				.id((d) => d.id)
				.distance(100)
		)
		.force("center", d3.forceCenter());
	const svg = d3
		.select("#graph-container")
		.append("svg")
		.attr("width", width)
		.attr("height", height)
		.attr("viewBox", [-width / 2, -height / 2, width, height]);

	const labels = svg.append("g").attr("class", "graph-labels");
	const nl = svg.append("g");

	if (enableLegend) {
		const legend: Record<string, string> = {
			Current: activeNode,
			Note: nodeInactive,
		};
		for (let k in pathColors) {
			legend[pathColors[k]!.title] = pathColors[k]!.color;
		}
		const legendEl = svg.append("g").attr("class", "graph-legend");

		Object.keys(legend).forEach((legendEntry, i) => {
			const key = legendEntry;
			const colour = legend[legendEntry];
			let group = legendEl
				.append("g")
				.attr("class", "legend-entry")
				.style("transform", `translateY(${-(i * 0.75)}em)`);
			group
				.append("circle")
				.attr("cx", -width / 2 + 20)
				.attr("cy", height / 2 - 15 * (i + 1))
				.attr("r", 8)
				.style("fill", colour!);
			group
				.append("text")
				.attr("x", -width / 2 + 40)
				.attr("y", height / 2 - 15 * (i + 1))
				.text(key)
				.style("font-size", "15px")
				.attr("alignment-baseline", "top");
		});
	}

	// draw links between nodes
	const link = nl
		.append("g")
		.selectAll("line")
		.data<GraphLink>(links)
		.join("line")
		.attr("class", "link")
		.attr("stroke", linkInactive!)
		.attr("stroke-width", 2)
		.attr("data-source", (d) => (d.source as GraphNode).id)
		.attr("data-target", (d) => (d.target as GraphNode).id);

	// svg groups
	const graphNode = nl
		.append("g")
		.selectAll("g")
		.data(nodes)
		.enter()
		.append("g");

	// calculate radius
	const nodeRadius = (d: GraphNode) => {
		let multiplier = d.isCurrent ? 7 : 5.5;
		const numOut =
			links.filter((a) => (a.source as GraphNode).id === d.id).length || 0;
		const numIn =
			links.filter((a) => (a.target as GraphNode).id === d.id).length || 0;
		return multiplier * Math.sqrt(numOut + numIn);
	};

	const node = graphNode
		.append("circle")
		.attr("class", "node")
		.attr("id", (d) => d.id)
		.attr("r", nodeRadius)
		.attr("dy", "0px")
		.attr("fill", (d) =>
			d.isCurrent
				? activeNode
				: (useGraphColor(d.id, {
						currentUrl,
						graphConfig,
						colors,
						labels: labelProps,
				  }) as string)
		)
		.style("cursor", "pointer")
		.on("click", (_, d) => {
			// SPA navigation
			navigate(`${decodeURI(d.id).replace(/\s+/g, "-")}`);
		})
		.on("mouseover", function (_, d) {
			d3.selectAll<d3.BaseType, GraphNode>(".node")
				.transition()
				.duration(200)
				.attr("fill", (d) => (d.isCurrent ? activeNode! : nodeInactive!));
			d3.selectAll<d3.BaseType, GraphNode>(".node")
				.filter((D) => D.id === d.id)
				.transition()
				.duration(200)
				.attr("stroke-width", 1)
				.attr("stroke", nodeStroke)
				.attr("fill", activeNode!);
			const neighbours: string[] = parseIdsFromLinks([
				...links.filter((a) => a.source === d.id),
				...links.filter((a) => a.target === d.id),
			]);
			const neighbourNodes = d3
				.selectAll<SVGCircleElement, GraphNode>(".node")
				.filter((d) => neighbours.includes(d.id));
			const currentId = d.id;

			const linkNodes = d3.selectAll<d3.BaseType, GraphLink>(".link");

			// highlight neighbour nodes
			neighbourNodes
				.transition()
				.duration(200)
				.attr("fill", (d) => useGraphColor(d.id, props));

			// highlight links
			linkNodes
				.filter(
					(l) =>
						(l.source as GraphNode).id === d.id ||
						(l.target as GraphNode).id === d.id
				)
				.transition()
				.duration(200)
				.attr("stroke", activeLink);

			const bigFont = fontSize * (6/5);

			// show text for self
			d3.select<SVGElement, GraphNode>(labels.node()!)
				.selectAll<SVGGElement, GraphNode>(".label")
				.filter((d1) => d1.id === d.id)
				.select<SVGGElement>("g")
				.transition()
				.duration(200)
				.attr("transform", function (d) {
					let m = this.transform.baseVal[0]!.matrix;
					return `translate(${m.e}, ${m.f - nodeRadius(d) - 15})`;
				})
				.attr(
					"opacityOld",
					d3
						.select<SVGElement, GraphNode>(labels.node()!)
						.selectAll<SVGGElement, GraphNode>(".label")
						.filter((d1) => d1.id === d.id)
						.select("g")
						.style("opacity")
				)
				.style("opacity", 1)
				.style("font-size", bigFont + "em");

			prefetch(
				`${window.location.hostname}/${d.collection}${decodeURI(d.id).replace(
					/\s+/g,
					"-"
				)}/`
			);
		})
		.on("mouseleave", function (_, d) {
			d3.selectAll<d3.BaseType, GraphNode>(".node")
				.transition()
				.duration(200)
				.attr("fill", (d) =>
					d.isCurrent
						? activeNode!
						: useGraphColor(d.id, {
								...rest,
								currentUrl,
								colors,
								graphConfig,
								labels: labelProps,
						  })
				)
				.attr("stroke-width", 0)
				.attr("stroke", nodeStroke);

			const currentId = d.id;
			const linkNodes = d3.selectAll<d3.BaseType, GraphLink>(".link");

			linkNodes.transition().duration(200).attr("stroke", linkInactive!);

			d3.select<SVGGElement, GraphNode>(labels.node()!)
				.selectAll<SVGGElement, GraphNode>(".label")
				.filter((d1) => d1.id === d.id)
				.select<SVGGElement>("g")
				.transition()
				.duration(200)
				.attr("transform", function (d) {
					let m = this.transform.baseVal[0]!.matrix;
					return `translate(${m.e}, ${m.f + nodeRadius(d) + 15})`;
				})
				.style(
					"opacity",
					d3
						.select<SVGGElement, GraphNode>(labels.node()!)
						.selectAll<SVGGElement, GraphNode>(".label")
						.filter((d1) => d1.id === d.id)
						.select("g")
						.attr("opacityOld")
				)
				.style("font-size", fontSize + "em");
		})
		.call(drag(simulation));
	// draw labels
	const opacityScale = 3;

	/* const labels = graphNode
		.append("text")
		.attr("class", "node-label")
		.attr("dx", 0)
		.attr("dy", (d) => nodeRadius(d) + 8 + "px")
		// .attr("text-anchor", "middle")
		.text((d) => d.title || d.id.replace("-", " "))
		.style("opacity", (opacityScale - 1) / 3.75)
		.style("pointer-events", "none")
		.style("font-size", fontSize + "em")
		.raise()
		.call(drag(simulation)); */
	const anneal = layoutAnnealing();
	anneal.bounds({
		width: container.current!.getBoundingClientRect().width,
		height: container.current!.getBoundingClientRect().height,
	});
	anneal.temperature(200);
	const strategy = layoutGreedy(anneal);
	const labelArranger = layoutLabel(strategy)
		.size((_: GraphNode, i: number, g: any[]) => {
			const size = g[i].querySelector("g").getBBox();
			const padding = 2;
			return [size.width + padding, size.height + padding];
		})
		.position((d: GraphNode) => [d.x ?? 0, d.y ?? 0])
		.component(function (d: d3.Selection<SVGGElement, GraphNode, any, any>) {
			d.each((d: GraphNode, iii: number, gg) => {
				const { borderStyle, borderWidth, padding } = labelProps;
				var el: d3.Selection<SVGGElement, GraphNode, any, any> = d3
					.select<SVGGElement, GraphNode>(gg[iii]!)
					.style("pointer-events", "none");
				let outer = el
					.html("")
					.append("g")
					.style("pointer-events", "none")
					/* .attr(
					"transform",
					(de) =>
						`translate(${nodeRadius(de) + padding}, ${
							nodeRadius(de) + padding
						})`
				); */
				let inner = outer.append("g").style("pointer-events", "none");

				let text = inner
					.append("text")
					.attr("class", "node-label")
					.attr("text-anchor", "middle")
					.text(d.title || d.id.replace("-", " "))
					.style("opacity", (opacityScale - 1) / 3.75)
					.style("pointer-events", "none")
					.style("font-size", fontSize + "em")
					.style("background-color", labelBg)
					.style("padding", padding + "px")
					.style(
						"border",
						`${borderWidth}px ${borderStyle} ${labelBorderStroke}`
					)
					.call(drag(simulation));
				let bbox = text.node()!.getBBox();
				let style = getComputedStyle(text.node()!);
				let rect = inner
					.append("rect")
					.attr("x", bbox.x - padding)
					.attr("y", bbox.y - padding)
					.attr("width", bbox.width + padding * 2)
					.attr("height", bbox.height + padding * 2)
					.attr("rx", 4)
					.attr("stroke", labelBorderStroke)
					.attr("fill", labelBg)
					.attr("stroke-width", borderWidth)
					.lower();
				inner.style("pointer-events", "none");
				inner.lower().call(drag(simulation));
			});
		});
	labels.datum(nodes).call(labelArranger);
	svg.select(".graph-legend").raise();

	// set panning

	if (graphConfig.enableZoom) {
		svg.call(
			d3
				.zoom<SVGSVGElement, unknown>()
				.extent([
					[0, 0],
					[width, height],
				])
				.scaleExtent([0.25, 4])
				.on("zoom", ({ transform }) => {
					link.attr("transform", transform);
					node.attr("transform", transform);
					const scale = transform.k * opacityScale;
					const scaledOpacity = Math.max((scale - 1) / 3.75, 0);
					// labels.attr("transform", transform).style("opacity", scaledOpacity);
				})
		);
	}

	// progress the simulation
	simulation.on("tick", () => {
		link
			.attr("x1", (d) => (d.source as GraphNode).x as number)
			.attr("y1", (d) => (d.source as GraphNode).y as number)
			.attr("x2", (d) => (d.target as GraphNode).x as number)
			.attr("y2", (d) => (d.target as GraphNode).y as number);
		node.attr("cx", (d) => d.x as number).attr("cy", (d) => d.y as number);
		// labels.attr("x", (d) => d.x!).attr("y", (d) => d.y!);

		// labels.attr("x", (d) => null).attr("y", (d) => null);
		labels.datum(nodes).call(labelArranger);
		svg.select(".graph-legend").raise();
	});

	return {
		destroy: () => {
			container.current!.innerHTML = "";
			simulation.stop();
		},
	};
}
// @note suburl
function suburl(url: string) {
	let args: ((cv: string) => any[])[] = [
		() => [1],
		(cv) => [cv.indexOf("/") + 1],
	];
	let suburl = args.reduce((pv, cv) => {
		console.log(pv);
		return String.prototype.substring.apply(pv, cv(pv) as [number, number]);
	}, url);
	console.log("SUB", suburl);
	if (suburl.endsWith("/"))
		suburl = suburl.substring(0, suburl.lastIndexOf("/"));
	return `/${suburl}`;
}

function InnerGraph(props: Props & AstroBuiltinProps) {
	console.log("graph props", props);
	const [links, nodes] = useParsedLinks(props);
	const [flattened, setFlattened] = useState<string[]>([]);

	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		console.log("LINKS", links);
		console.log("NODES", nodes);
		const { destroy } = runGraph({
			nodes,
			links,
			...props,
			container: containerRef,
			flattened,
		});
		return () => destroy();
	}, [links, nodes, props, flattened]);

	return <div ref={containerRef} id="graph-container"></div>;
}
export function Graph(props: Props) {
	console.log("hi");
	return <InnerGraph client:load client:only="react" {...props} />;
}
