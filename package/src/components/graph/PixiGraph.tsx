import type { AstroBuiltinProps } from "astro";
import type {
	ColorProps,
	GraphLink,
	GraphNode,
	GraphProps,
	Props,
} from "./types";
import { Stage } from "@pixi/react";
import React from "react";
import {
	Graphics as Gfx,
	RenderTexture,
	type FederatedPointerEvent,
	Circle,
	Container as PContainer,
} from "pixi.js";
import { useApp } from "@pixi/react";
import { useState } from "react";
import { useEffect } from "react";
import { createContext } from "react";
import type { Dispatch } from "react";
import * as d3 from "d3";
import { type Simulation } from "d3";
import { useRef, useMemo, useCallback } from "react";
import { Graphics } from "@pixi/react";
import type { MutableRefObject } from "react";
import { hexToRgb, rgbToHex, useParsedLinks } from "./utils";
import { forwardRef } from "react";
import { Group, Tween } from "tweedle.js";
import { Container } from "@pixi/react";
import { Interpolation } from "tweedle.js";

function useGraphColor(d: string, props: Omit<Props, "rootDir">) {
	const pathColors = props.pathColors;
	for (const col in pathColors) {
		if (d.startsWith(col)) {
			return pathColors[col]!.color;
		}
	}
	return props.colors!.nodeInactive!;
}

const useNodeRadius = (d: GraphNode, links: GraphLink[]) => {
	let multiplier = d.isCurrent ? 7 : 5.5;
	const numOut =
		links.filter((a) => (a.source as GraphNode).id === d.id).length || 0;
	const numIn =
		links.filter((a) => (a.target as GraphNode).id === d.id).length || 0;
	return multiplier * Math.sqrt(numOut + numIn);
};
function useSimulation({
	nodes,
	links,
	graphConfig,
	container,
}: {
	container: MutableRefObject<HTMLDivElement>;
	nodes: GraphNode[];
	links: GraphLink[];
	graphConfig: Partial<GraphProps>;
}): [d3.Simulation<GraphNode, GraphLink>, () => void] {
	const simulation = d3
		.forceSimulation<GraphNode>(nodes)
		.force(
			"charge",
			d3.forceManyBody().strength(-100 * (graphConfig.repelForce ?? 4))
		)
		.force(
			"link",
			d3
				.forceLink<GraphNode, GraphLink>(links)
				.id((d) => d.id)
				.distance(40)
			// .distance((l) => l.strength * links.length)
		)
		.force(
			"center",
			d3.forceCenter(
				(container.current?.clientWidth || 300) / 2,
				(container.current?.clientHeight || 300) / 2
				/* container.current.clientWidth / 2,
				container.current.clientHeight / 2 */
			)
		) /* .force("x", d3.forceX())
      .force("y", d3.forceY()) */
		.velocityDecay(0.8);
	return [
		simulation,
		() => {
			// simulation.stop();
			// setStopped(true);
		},
	];
}

const PixiGraphLink = forwardRef<
	Gfx,
	{
		link: GraphLink;
		colors: Partial<ColorProps>;
	}
>(function (
	{
		link,
		colors,
	}: {
		link: GraphLink;
		colors: Partial<ColorProps>;
	},
	ref
) {
	let { source: rsource, target: rtarget } = link;
	let source = rsource as GraphNode,
		target = rtarget as GraphNode;
	const [played, setPlayed] = useState(false);
	let active = useMemo(
		() => source.hover || target.hover,
		[source, target, source.hover, target.hover]
	);
	const tween = useMemo(() => {
		setPlayed(false);
		return new Tween(
			active
				? hexToRgb(colors.activeLink!)
				: hexToRgb(colors.linkInactive || "#ababab")
		)
			.to(
				active
					? hexToRgb(colors.linkInactive ?? "#ababab")
					: hexToRgb(colors.activeLink!),
				200
			)
			.interpolation(Interpolation.Color.RGB);
	}, [
		active,
		colors,
		source,
		target,
		rsource,
		rtarget,
		link,
		source.x,
		target.x,
		source.y,
		target.y,
	]);
	const draw = useCallback(
		(g: Gfx) => {
			const fillFn = () => {
				if (!active) g.alpha = 0.67;
				else g.alpha = 1;
				g.beginFill();

				g.moveTo(source.x!, source.y!);
				g.lineTo(target.x!, target.y!);
				g.endFill();
			};

			tween.onUpdate((obj) => {
				g.clear();
				const color = rgbToHex(obj);
				g.lineStyle({ width: 1.5, color });
				fillFn();
			});
			tween.onComplete((_obj) => {
				const color = rgbToHex(_obj);
				g.clear();
				g.lineStyle({
					width: 1.5,
					color,
				});
				fillFn();
				setPlayed(true);
			});
			if (!played) tween.start();
		},
		[
			link,
			source,
			target,
			source.x,
			target.x,
			source.y,
			target.y,
			active,
			tween,
			played,
		]
	);
	useEffect(() => {
		return () => {
			(ref as MutableRefObject<Gfx> | null)?.current?.clear();
			(ref as MutableRefObject<Gfx> | null)?.current?.destroy({
				children: true,
			});
		};
	}, []);
	return useMemo(
		() => <Graphics ref={ref} draw={draw} />,
		[active, link, draw, link.source, link.target, tween, played]
	);
});

function PixiGraphNode({
	node,
	simulation,
	graphProps: props,
	links = [],
	parentRef,
}: {
	node: GraphNode;
	links: GraphLink[];
	simulation: Simulation<GraphNode, GraphLink>;
	graphProps: GraphContext;
	parentRef: MutableRefObject<PContainer | null>;
}) {
	const app = useApp();
	const gref = useRef<Gfx>(null);
	const { dragging, draggedNode } = props;
	const [hover, setHover] = useState<boolean>(false);
	const [down, setDown] = useState<boolean>(false);
	const [, forceUpdate] = useState<null>(null);
	const nodeTick = () => {
		if (gref.current) {
			gref.current.x = node.x!;
			gref.current.y = node.y!;
		}
		if (draggedNode.current) {
			draggedNode.current.gfx.x = draggedNode.current.node.x!;
			draggedNode.current.gfx.y = draggedNode.current.node.y!;
		}
		node.hover = hover;
	};
	simulation.on("tick.node", nodeTick);
	const fillo = (gi: Gfx) => {
		if (node.isCurrent) {
			gi.lineStyle(3, props.colors.nodeStroke);
		}
		gi.beginFill(
			node.isCurrent ? props.colors.activeNode : useGraphColor(node.id, props)
		);
		gi.drawCircle(0, 0, useNodeRadius(node, links));
		gi.endFill();
	};
	const move = useCallback(
		function (this: Gfx, evt: FederatedPointerEvent) {
			const np = evt.getLocalPosition(parentRef.current!);

			if (draggedNode.current?.node.id === node.id) {
				node.fx = draggedNode.current.node.fx = np.x;
				node.fy = draggedNode.current.node.fy = np.y;
			} else if (draggedNode.current) {
				draggedNode.current.node.fx = np.x;
				draggedNode.current.node.fy = np.y;
			}
		},
		[node, draggedNode.current]
	);

	const leave = useCallback(
		function (this: Gfx, evt: FederatedPointerEvent) {
			const g = gref.current;
			if (!draggedNode.current) {
				const tween = new Tween({ width: 2 }, Group.shared)
					.from({ width: 2 })
					.to({ width: 0 }, 250);

				tween.onUpdate((obj, _, _thing) => {
					g?.clear();
					g?.lineStyle(obj.width, props.colors.nodeStroke);
					if (g) fillo(g);
				});
				tween.onComplete(() => {
					g?.clear();
					g?.lineStyle(0, props.colors.nodeStroke);
					if (g) fillo(g);
				});
				tween.start();
			} else {
				move.bind(this)(evt);
			}
			node.hover = false;
			setHover(false);
			// fillo();
		},
		[node, draggedNode.current]
	);
	const draw = useCallback(
		(g: Gfx) => {
			parentRef.current?.removeAllListeners();
			g.removeAllListeners();
			const boundMove = move.bind(g);

			const pointerUp = function (this: Gfx, evt: FederatedPointerEvent) {
				if (draggedNode.current) {
					evt.stopPropagation();
					simulation.alphaTarget(0);
					dragging.current = false;
					setDown(false);
					draggedNode.current.node.hover = false;
					draggedNode.current.node.fx = null;
					draggedNode.current.node.fy = null;
					draggedNode.current = null;
					node.fx = null;
					node.fy = null;
				}
				node.hover = false;
				setHover(false);
			};

			fillo(g);
			g.on("pointerleave", leave)
				.on("pointerdown", function (this: Gfx) {
					if (!draggedNode.current) {
						draggedNode.current = { node, gfx: g };
						simulation.alphaTarget(1).restart();
						node.fx = node.x!;
						node.fy = node.y!;
						setDown(true);
						dragging.current = true;
					}
				})
				.on("pointerover", function (this: Gfx) {
					if (!draggedNode.current) {
						if (g.geometry.graphicsData[0])
							g.geometry.graphicsData[0].lineStyle.visible = true;
						const tween = new Tween({ width: 0 }, Group.shared)
							.from({ width: 0 })
							.to({ width: 2 }, 250);

						setHover(true);
						node.hover = true;
						tween.onUpdate((obj, _, _thing) => {
							g.clear();
							g.lineStyle(obj.width, props.colors.nodeStroke);
							fillo(g);
						});
						tween.onComplete(() => {
							g.clear();
							g.lineStyle(2, props.colors.nodeStroke);
							fillo(g);
						});
						tween.start();
					}
				});
			parentRef.current
				?.on("pointerup", pointerUp.bind(g))
				.on("pointermove", boundMove)
				.on("pointerupoutside", pointerUp);

			g.x = node.x!;
			g.y = node.y!;
		},
		[node, draggedNode.current, hover, simulation, links]
	);
	useEffect(() => {
		node.hover = hover;
	}, [hover]);
	useEffect(() => {
		return () => {
			gref.current?.clear();
			// gref.current?.destroy({ children: true });
			simulation.on("tick.node", null);
		};
	}, []);
	const ha = useMemo(() => {
		let rad = useNodeRadius(node, links);
		let t = new Circle(rad / 2, rad / 2, useNodeRadius(node, links) + 10);
		return t;
	}, [
		draw,
		node,
		node.x,
		node.y,
		dragging.current,
		hover,
		down,
		simulation,
		draggedNode.current,
		links,
	]);
	return useMemo(
		() => (
			<Graphics
				ref={gref}
				hitArea={ha}
				eventMode="static"
				draw={draw}
				x={node.x!}
				y={node.y!}
			/>
		),
		[
			draw,
			node,
			node.x,
			node.y,
			dragging.current,
			hover,
			down,
			draggedNode.current,
			simulation,
			links,
		]
	);
}

function InnerPixiGraph(props: GraphContext) {
	const [links, nodes] = useParsedLinks(props);
	const { graphConfig, container, linkGfx, colors, draggedNode } = props;

	const app = useApp();
	const [st, set] = useState(null);
	const [linkEls, setLinkEls] = useState<React.ReactElement[]>([]);
	const [nodeEls, setNodeEls] = useState<React.ReactElement[]>([]);
	const [simulation, destroy] = useMemo(
		() =>
			useSimulation({
				links,
				nodes,
				graphConfig,
				container,
			}),
		[nodes, links]
	);

	const outerTick = useCallback(
		function hi() {
			set(null);
			setLinkEls(
				links.map((l) => (
					<PixiGraphLink key={l.index} link={l} colors={props.colors} />
				))
			);
			setNodeEls(
				nodes.map((n) => (
					<PixiGraphNode
						parentRef={cRef}
						links={links}
						key={n.id}
						graphProps={props}
						node={n}
						simulation={simulation!}
					/>
				))
			);
		},
		[props, links, nodes, simulation, props, draggedNode]
	);
	const ticky = function () {
		simulation.on("tick.outer", outerTick);
		// simulation.restart();
		Group.shared.update();

		simulation!.tick();
		if (simulation) {
		}
	};
	app.ticker.add(ticky);
	useEffect(() => {
		return () => {
			simulation.on("tick.outer", null);
			app.ticker.remove(ticky);
		};
	}, [nodes, links, simulation, ticky]);
	const cRef = useRef<PContainer>(null);
	useEffect(() => {
		if (container.current)
			app.renderer.resize(
				container.current.clientWidth,
				container.current.clientHeight
			);
		return () => {
			// app.destroy(true, { children: true });
		};
	}, []);
	addEventListener("resize", () => {
		if (container.current)
			app.renderer.resize(
				container.current.clientWidth,
				container.current.clientHeight
			);
	});
	return useMemo(
		() => (
			<>
				<Container>{linkEls}</Container>
				<Container eventMode="dynamic" hitArea={app.screen} ref={cRef}>
					{nodeEls}
				</Container>
			</>
		),
		[nodes, links, simulation, props, linkEls]
	);
}
type Textures = {
	hover: RenderTexture;
	normal: RenderTexture;
};
type GraphContext = (Props & AstroBuiltinProps) & {
	container: MutableRefObject<HTMLDivElement>;
	linkGfx: Gfx;
	dragging: MutableRefObject<boolean>;
	draggedNode: MutableRefObject<{ node: GraphNode; gfx: Gfx } | null>;
};

const GRAPH_CONTEXT = createContext<GraphContext | null>(null);

function OuterPixiGraph(props: Props & AstroBuiltinProps) {
	const divRef = useRef<HTMLDivElement>(null);
	const linkGraphics = new Gfx();
	const dragging = useRef<boolean>(false);
	const currentDraggedNode = useRef<{ node: GraphNode; gfx: Gfx }>(null);
	const context = useMemo(
		() => ({
			dragging,
			...props,
			colors: Object.assign(
				{
					nodeStroke: "#000",
				},
				props.colors
			),
			container: divRef as MutableRefObject<HTMLDivElement>,
			linkGfx: linkGraphics,
			draggedNode: currentDraggedNode,
		}),
		[props, linkGraphics]
	);
	useEffect(() => {
		return () => linkGraphics.destroy();
	}, []);
	if (typeof window === "undefined") {
		return <progress value={null as unknown as number} />;
	}
	return (
		<div id="graph-container" ref={divRef}>
			<GRAPH_CONTEXT.Provider value={context}>
				<Stage
					raf
					height={300}
					options={{
						antialias: true,
						resizeTo: document.body.querySelector("main")!,
						backgroundAlpha: 0,
					}}
					color="transparent"
				>
					<InnerPixiGraph {...context} />
				</Stage>
			</GRAPH_CONTEXT.Provider>
		</div>
	);
}

export function PixiGraph(props: Props & AstroBuiltinProps) {
	return <OuterPixiGraph {...props} />;
}
