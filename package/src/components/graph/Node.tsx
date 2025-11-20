import { useApplication as useApp } from "@pixi/react";
import type { Simulation } from "d3";
import { Circle, Container, FederatedPointerEvent, Graphics, Point } from "pixi.js";
import gsap from "gsap";
import React, { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GraphContext } from "./context";
import { useGraphColor, useMove, useNodeRadius, usePointerDown, usePointerLeave, usePointerOver, usePointerUp } from "./hooks";
import type { GraphLink, GraphNode } from "./types";
import { NodeLabel } from "./Label";

export function PixiGraphNode({
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
	parentRef: RefObject<Container | null>;
}) {
	const app = useApp();
	const radius = useNodeRadius(node, links);
	const strokeRef = useRef({width: 0});
	const gref = useRef<Graphics>(null);
	const lref = useRef<Graphics>(null);
	const basePoint = useMemo(() => new Point(0, radius), [lref.current, lref])
	const offset = useRef<Point>(basePoint);
	const { dragging, draggedNode } = props;
	const [hover, setHover] = useState<boolean>(node.hover ?? false);
	const [down, setDown] = useState<boolean>(false);

	const [strokeWidth, setStrokeWidth] = useState(strokeRef.current);


	const nodeTick = () => {
		// if (gref.current) {
		// 	gref.current.x = node.x!;
		// 	gref.current.y = node.y!;
		// }
		// if (draggedNode.current && !draggedNode.current.gfx.label?.includes("label")) {
		// 	draggedNode.current.gfx.x = draggedNode.current.node.x!;
		// 	draggedNode.current.gfx.y = draggedNode.current.node.y!;
		// }
		node.hover = hover;
	};
	simulation.on("tick.node", nodeTick);
	const fillo = (gi: Graphics) => {
		gi
		/* .setStrokeStyle({
					}) */
			.circle(0, 0, useNodeRadius(node, links))
			.fill(
				node.isCurrent ? props.colors.activeNode : useGraphColor(node.id, props)
			);
		if(node.isCurrent) {
			gi.stroke({
				width: 3,
				color: props.colors.nodeStroke!
			})
		}
	};
	const move = useMove({
		additionalDeps: [strokeRef.current],
		node,
		label: lref.current,
		offset
	})
	const pointerUp = usePointerUp({node, setDown, offset, base: basePoint});
	const pointerDown = usePointerDown({ node, setDown, oref: offset });
	const pointerLeave = usePointerLeave({ node, setHover, move, additionalDeps: [strokeRef.current], setStroke: true });
	const pointerOver = usePointerOver({ node, setHover });

	const boundMoveRef = useRef<typeof move | null>(null)
	const boundPointerUp = useRef<typeof pointerUp | null>(null)
	const draw = useCallback(
		(g: Graphics) => {
			boundMoveRef.current = move.bind(g);
			boundPointerUp.current = pointerUp.bind(g);
			g.removeAllListeners();

			fillo(g);
			g.on("pointerleave", pointerLeave)
				.on("pointerdown", pointerDown)
				.on("pointerover", pointerOver);

			// g.x = node.x!;
			// g.y = node.y!;
			if(!node.isCurrent)
				g.stroke({
					width: strokeRef.current.width,
					color: props.colors.nodeStroke!,
					pixelLine: false
				})
		},
		[node, draggedNode.current, hover, simulation, links, strokeRef.current, strokeWidth, pointerUp, pointerDown, pointerLeave, pointerOver, move]
	);
	useEffect(() => {
		props.anyHovered.current = node.hover = hover;
		if(!node.isCurrent)
			gsap.to(strokeRef.current, {
				duration: 0.25,
				width: node.hover ? 2 : 0,
				onUpdate: () => setStrokeWidth({width: strokeRef.current.width})
			})
	}, [hover, node, node.hover, setStrokeWidth]);
	useEffect(() => {
		if(!draggedNode.current)
			offset.current = basePoint
	}, [basePoint])

	useEffect(() => {
		if (boundPointerUp.current)
			parentRef.current
				?.on("pointerup", boundPointerUp.current);
		if (boundMoveRef.current)
			parentRef.current?.on("pointermove", boundMoveRef.current);
		parentRef.current?.on("pointerupoutside", pointerUp);
		return () => {
			if(boundPointerUp.current)
				parentRef.current?.removeListener("pointerup", boundPointerUp.current)
			if(boundMoveRef.current)
				parentRef.current?.removeListener("pointermove", boundMoveRef.current);
			parentRef.current?.removeListener("pointerupoutside", pointerUp);
		}
	}, [parentRef.current, boundPointerUp.current, boundMoveRef.current, pointerUp])
	useEffect(() => {
		return () => {
			gref.current?.clear();
			// gref.current?.destroy({ children: true });
			simulation.on("tick.node", null);
		};
	}, []);
	const ha = useMemo(() => {
		let t = new Circle(radius / 2, radius / 2, radius + 10);
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
	const z = 10;
	return useMemo(
		() => (
			<pixiContainer
					x={node.x!}
					y={node.y!}
					zIndex={node.isCurrent || node.hover ? z : 0}
					eventMode="passive"
			>
				<pixiGraphics
					ref={gref}
					hitArea={ha}
					label={`node[${node.id}]`}
					eventMode="static"
					draw={draw}
					>
				</pixiGraphics>
					<NodeLabel offset={offset} ref={lref} node={node} {...{setHover, hover}} />
			</pixiContainer>
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
