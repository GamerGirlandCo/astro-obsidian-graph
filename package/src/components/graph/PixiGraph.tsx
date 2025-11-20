import { Application, useApplication as useApp, useExtend, useTick } from "@pixi/react";
import type { AstroBuiltinAttributes } from "astro";
import type { RefObject } from "react";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Viewport, ViewportWrapper } from "../ViewportShim";
import {
	Graphics as Gfx,
	Container as PContainer,
	Text
} from "pixi.js";
import type {
	GraphNode,
	Props,
} from "./types";
import { useParsedLinks } from "./utils";
import gsap from "gsap";
import { PixiPlugin } from "gsap/PixiPlugin";
import { GRAPH_CONTEXT, INNER_GRAPH_CONTEXT, type GraphContext } from "./context";
import { useSimulation } from "./hooks";
import { PixiGraphNode } from "./Node";
import { PixiGraphLink } from "./Link";
import { NodeLabel } from "./Label";

gsap.registerPlugin(PixiPlugin);

const InnerPixiGraph = memo(function (props: GraphContext) {
	const [links, nodes] = useParsedLinks(props);
	// const nodes: GraphNode[] = [];
	// const links: GraphLink[] = []
	const { graphConfig, container, linkGfx, colors, draggedNode } = props;

	const { app } = useApp();
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
	const cRef = useRef<PContainer>(null);
	useEffect(() => {
		simulation.restart()
		simulation.on("tick.outer", outerTick);
		if (container.current)
			app.renderer.resize(
				container.current.clientWidth,
				container.current.clientHeight
			);
	}, [simulation, outerTick]);
	useTick(() => {
		simulation!.tick();
	});

	const viewportRef = useRef<ViewportWrapper | null>(null)
	const cfgr = useCallback((c: ViewportWrapper) => {
		console.log("config", c, c.boundsArea)
		c.boundsArea = app.screen
		c.drag({ mouseButtons: "right" }).pinch().wheel({
			interrupt: true
		});
	}, [props, container.current]);

	useEffect(() => {
		if(viewportRef.current) {
			console.log(viewportRef.current.getBounds(), viewportRef.current.hitArea)
		}
	}, [viewportRef])

	// console.log("vpr", viewportRef)
	// console.log(viewportRef.current?.getBounds(), viewportRef.current?.hitArea, app.screen)
	return useMemo(() => (
		<INNER_GRAPH_CONTEXT.Provider value={{nodes, links, parentRef: cRef, simulation}}>
			<Viewport configure={cfgr} ref={viewportRef} disableOnContextMenu
				worldHeight={document.body.clientHeight}
				worldWidth={document.body.clientWidth}
			>
				<pixiContainer>{linkEls}</pixiContainer>
				<pixiContainer eventMode="static" hitArea={
					viewportRef.current?.hitArea!
				} ref={cRef}>
					{nodeEls}
				</pixiContainer>
				{/*<pixiContainer>{labels}</pixiContainer>*/}
			</Viewport>
		</INNER_GRAPH_CONTEXT.Provider>),
			[nodes, links, simulation, props, linkEls, nodeEls, outerTick]
		)
})


function OuterPixiGraph(props: Props & AstroBuiltinAttributes) {
	const divRef = useRef<HTMLDivElement>(null);
	const linkGraphics = new Gfx();
	const dragging = useRef<boolean>(false);
	const currentDraggedNode = useRef<{ node: GraphNode; isDraggingLabel: boolean }>(null);
	const anyHovered = useRef(false);
	const context = useMemo(
		() => ({
			dragging,
			...props,
			colors: Object.assign(
				{
					nodeStroke: "#000000",
				},
				props.colors,
			),
			container: divRef as RefObject<HTMLDivElement>,
			linkGfx: linkGraphics,
			draggedNode: currentDraggedNode,
			anyHovered
		}),
		[props, linkGraphics]
	);
	const noopEvent = (e: Event) => {
		e.preventDefault()
	}
	useEffect(() => {
		divRef.current?.addEventListener("wheel", noopEvent)
		return () => {
			divRef.current?.removeEventListener("wheel", noopEvent)
		}
	}, [noopEvent, divRef])
	useEffect(() => {
		return () => linkGraphics.destroy();
	}, []);
	if (typeof window === "undefined") {
		return <progress value={null as unknown as number} />;
	}

	return (
		<div id="graph-container" ref={divRef} style={{overscrollBehavior: "contain"}} onWheel={(e) => e.preventDefault()}>
			<Application
				height={300}
				antialias
				backgroundAlpha={0}
				autoStart
				resizeTo={divRef!}
			>
				<GRAPH_CONTEXT.Provider value={context}>
						<InnerPixiGraph {...context} />
				</GRAPH_CONTEXT.Provider>
			</Application>
		</div>
	);
}

export function PixiGraph(props: Props & AstroBuiltinAttributes) {
	useExtend({Container: PContainer, Graphics: Gfx, ViewportWrapper, Text})
	return <OuterPixiGraph {...props} />;
}
