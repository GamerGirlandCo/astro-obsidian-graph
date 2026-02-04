import { useApplication as useApp } from "@pixi/react";
import type { Simulation } from "d3";
import {
	Circle,
	Container,
	Graphics,
	Point,
} from "pixi.js";
import React, {
	type RefObject,
	useContext,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import gsap from "gsap";
import {
	INNER_GRAPH_CONTEXT,
	type GraphContext,
} from "./context";
import {
	useGraphColor,
	useMove,
	useNodeRadius,
	usePointerDown,
	usePointerLeave,
	usePointerOver,
	usePointerUp,
} from "./hooks";
import type { GraphLink, GraphNode } from "./types";
import { NodeLabel } from "./Label";
import { getInheritedBackgroundColor, getMixedColor, getPropertyValue, hexToRgb } from "./utils";

export function PixiGraphNode({
	node,
	simulation,
	graphProps: props,
	links = [],
	index,
	parentRef,
}: {
	node: GraphNode;
	links: GraphLink[];
	index: number;
	simulation: Simulation<GraphNode, GraphLink>;
	graphProps: GraphContext;
	parentRef: RefObject<Container | null>;
}) {
	const app = useApp();
	const { viewportRef, hoveredNode, setHoveredNode,  } =
		useContext(INNER_GRAPH_CONTEXT)!;
	const radius = useNodeRadius(node, links);
	const strokeRef = useRef({ width: 0 });
	const gref = useRef<Graphics>(null);
	const lref = useRef<Graphics>(null);
	const basePoint = useMemo(() => new Point(0, radius), [lref.current, lref]);
	const offset = useRef<Point>(basePoint);
	const { dragging, draggedNode, graphConfig } = props;
	const [hover, setHover] = useState<boolean>(false);
	const [down, setDown] = useState<boolean>(false);

	const [strokeWidth, setStrokeWidth] = useState(strokeRef.current);

	const neighborIds = useMemo(() => {
		return new Set(links
			.filter((l) => {
				let isSource = false;
				if(typeof l.source == "string" || typeof l.source == "number") {
					isSource = l.source == node.id;
				} else {
					isSource = l.source.id == node.id;
				}
				let isTarget = false;
				if(typeof l.target == "string" || typeof l.target == "number") {
					isTarget = l.target == node.id;
				} else {
					isTarget = l.target.id == node.id;
				}
				return isSource || isTarget;
			})
			.map((l) =>
				l.source == node.id
					? typeof l.target == "string" || typeof l.target == "number"
						? l.target
						: l.target.id
					: typeof l.source == "string" || typeof l.source == "number"
					? l.source
					: l.source.id
			));
	}, [node.id, links]);
	const shouldDim = useMemo(() => {
		return !node.isCurrent && props.graphConfig.dimOnDrag && (
			draggedNode.current &&
			!(node.id == draggedNode.current.node.id ||
				neighborIds.has(draggedNode.current.node.id))
		);
	}, [draggedNode.current, node, neighborIds]);

	const color = useMemo(() => {
		return node.isCurrent ? getPropertyValue(props.colors.activeNode ?? "#00e7e3") : useGraphColor(node.id, props);
	}, [node.isCurrent, props.colors, node.id, props]);
	const bgColor = useMemo(() => {
		return getInheritedBackgroundColor(props.container.current ?? document.body);
	}, [props.container.current]);

	const dimmedColor = useMemo(() => {
		return shouldDim ? getMixedColor(hexToRgb(color), hexToRgb(bgColor), 0.5) : color;
	}, [shouldDim, node.isCurrent, props.colors, bgColor])

	const fillo = (gi: Graphics) => {
		gi.clear()
			/* .setStrokeStyle({
					}) */
			.circle(0, 0, useNodeRadius(node, links))
			.fill(
				dimmedColor
			);
		if (node.isCurrent) {
			gi.stroke({
				width: 3,
				color: props.colors.nodeStroke!,
			});
		}
	};
	const move = useMove({
		additionalDeps: [strokeRef.current],
		node,
		label: lref.current,
		offset,
	});
	const pointerUp = usePointerUp({ node, setDown, offset, base: basePoint });
	const pointerDown = usePointerDown({ node, setDown, oref: offset });
	const pointerLeave = usePointerLeave({
		node,
		setHover,
		move,
		additionalDeps: [strokeRef.current],
		setStroke: true,
	});
	const pointerOver = usePointerOver({ node, setHover });

	const boundMoveRef = useRef<typeof move | null>(null);
	const boundPointerUp = useRef<typeof pointerUp | null>(null);
	const draw = useCallback(
		(g: Graphics) => {
			boundMoveRef.current = move.bind(g);
			boundPointerUp.current = pointerUp.bind(g);
			fillo(g);
			if (!node.isCurrent)
				g.stroke({
					width: strokeRef.current.width,
					color: props.colors.nodeStroke!,
					pixelLine: false,
				});
		},
		[
			node,
			draggedNode.current,
			hover,
			simulation,
			links,
			strokeRef.current,
			strokeWidth,
			pointerUp,
			pointerDown,
			pointerLeave,
			pointerOver,
			move,
		]
	);
	useEffect(() => {
		if (hover) {
			setHoveredNode(node.id);
		} else if (hoveredNode == node.id) {
			setHoveredNode(null);
		}
		if (!node.isCurrent)
			gsap.to(strokeRef.current, {
				duration: 0.25,
				width: hover ? 2 : 0,
				onUpdate: () => setStrokeWidth({ width: strokeRef.current.width }),
			});
	}, [hover, node, setStrokeWidth, setHoveredNode]);
	useEffect(() => {
		if (!draggedNode.current) offset.current = basePoint;
	}, [basePoint]);

	useEffect(() => {
		if (boundPointerUp.current) {
			parentRef.current?.on("pointerup", boundPointerUp.current);
			parentRef.current?.on("pointerupoutside", boundPointerUp.current);
		}
		if (boundMoveRef.current)
			parentRef.current?.on("pointermove", boundMoveRef.current);
		return () => {
			if (boundPointerUp.current) {
				parentRef.current?.removeListener("pointerup", boundPointerUp.current);

				parentRef.current?.removeListener(
					"pointerupoutside",
					boundPointerUp.current
				);
			}
			if (boundMoveRef.current)
				parentRef.current?.removeListener("pointermove", boundMoveRef.current);
		};
	}, [
		parentRef.current,
		boundPointerUp.current,
		boundMoveRef.current,
		pointerUp,
	]);
	useEffect(() => {
		gref.current
			?.on("pointerleave", pointerLeave)
			.on("pointerdown", pointerDown)
			.on("pointerover", pointerOver)
			.on("pointerup", pointerUp);
		return () => {
			gref.current?.removeAllListeners();
			gref.current?.clear();
			// gref.current?.destroy({ children: true });
		};
	}, [gref.current]);
	const ha = useMemo(() => {
		let t = new Circle(0, 0, radius);
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
		radius,
	]);
	const z = useMemo(
		() => (node.isCurrent || hoveredNode == node.id ? 10 : 0),
		[node.isCurrent, hoveredNode]
	);
	return useMemo(
		() => (
			<pixiContainer x={node.x!} y={node.y!} zIndex={z} eventMode="passive">
				<NodeLabel
					index={index}
					offset={offset}
					ref={lref}
					node={node}
					{...{ setHover, hover }}
				/>
				<pixiGraphics
					ref={gref}
					hitArea={ha}
					label={`node[${node.id}]`}
					eventMode="static"
					draw={draw}
				></pixiGraphics>
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
			ha,
			draggedNode.current,
			simulation,
			viewportRef.current?.scale.x,
			viewportRef.current?.scale,
			viewportRef.current,
			links,
			z,
		]
	);
}
