import * as d3 from "d3";
import { flushSync } from "react-dom";
import {
	useContext,
	useCallback,
	useState,
	useMemo,
	useEffect,
	useRef,
	type RefObject
} from "react";
import {
	Graphics,
	type FederatedPointerEvent,
	Point,
} from "pixi.js";
import chroma from "chroma-js";
import { useTick } from "@pixi/react";
import type { GraphNode, GraphLink, Props, GraphProps } from "./types";
import { GRAPH_CONTEXT, INNER_GRAPH_CONTEXT } from "./context";
import { forceAnchoredLabelCollide } from "./d3-extra";
import { getPropertyValue } from "./utils";

export function useGraphColor(d: string, props: Omit<Props, "rootDir">) {
	const pathColors = props.pathColors;
	for (const col in pathColors) {
		if (d.startsWith(col)) {
			return getPropertyValue(pathColors[col]!.color);
		}
	}
	return getPropertyValue(props.colors!.nodeInactive!);
}

export const useNodeRadius = (d: GraphNode, links: GraphLink[]) => {
	let multiplier = d.isCurrent ? 7.5 : 5.5;
	const numOut =
		links.filter((a) => (a.source as GraphNode).id === d.id).length || 0;
	const numIn =
		links.filter((a) => (a.target as GraphNode).id === d.id).length || 0;
	return multiplier * Math.sqrt(numOut + numIn);
};

function useStateTick() {
	const [tick, setTick] = useState(0);
	const raf = useRef<number | null>(null);
	const requestTick = useCallback(() => {
		if (raf.current != null) return;
		setTick((t) => t + 1);
		raf.current = Math.random();
	}, [setTick]);
	useTick(() => {
		requestTick();
	});
	return { tick, requestTick };
}

export function useSimulation({
	nodes,
	links,
	graphConfig,
	container,
}: {
	container: RefObject<HTMLDivElement>;
	graphConfig: Partial<GraphProps>;
	nodes: GraphNode[];
	links: GraphLink[];
}): [d3.Simulation<GraphNode, GraphLink>, number, () => void] {
	/* const [nodeLabelProps, setNodeLabelProps] = useState<
		Map<string, NodeLabelProps>
	>(
		new Map(nodes.map((n) => [n.id, { x: n.x!, y: n.y!, width: 0, height: 0 }]))
	);
	const setter = useCallback(
		(id: string, props: NodeLabelProps) => {
			setNodeLabelProps((prev) => new Map(prev).set(id, props));
		},
		[setNodeLabelProps]
	);
	const quadTree = useMemo(
		() =>
			d3
				.quadtree<NodeLabelProps>(Array.from(nodeLabelProps.values()))
				.x((d) => d.x)
				.y((d) => d.y),
		[nodeLabelProps]
	); */
	
	const { tick, requestTick } = useStateTick();

	const simulation = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);
	useEffect(() => {
		simulation.current = d3
			.forceSimulation<GraphNode>(nodes)
			.force(
				"charge",
				d3
					.forceManyBody()
					.strength(Math.abs(graphConfig.repelForce ?? 25) * -10)
			)
			.force(
				"link",
				d3
					.forceLink<GraphNode, GraphLink>(links)
					.id((d) => d.id)
					.distance(graphConfig.linkDistance ?? 95)
				// .distance((l) => l.strength * links.length)
			)
			.force(
				"center",
				d3.forceCenter(
					(container.current?.clientWidth ?? 300) / 2,
					(container.current?.clientHeight ?? 300) / 2
					/* container.current.clientWidth / 2,
				container.current.clientHeight / 2 */
				)
			)
			// .force("x", d3.forceX())
			// .force("y", d3.forceY())
			.velocityDecay(0.8);
		if (!graphConfig.hideInactiveLabels) {
			simulation.current = simulation.current!.force(
				"anchoredLabelCollide",
				forceAnchoredLabelCollide<GraphNode, GraphLink>({
          padding: 15,
          iterations: 2,

          collideStrength: 1,
          anchorStrength: 0.75,
          damping: 0.25,

          maxDistance: 25,
          overlapEpsilon: 0.1,
					getAnchor: (d) => {
						const llinks = simulation.current!.force("link") as d3.ForceLink<GraphNode, GraphLink>;
						return {
							x: useNodeRadius(d, llinks.links() as GraphLink[]),
							y: useNodeRadius(d, llinks.links() as GraphLink[]),
						}
					}
        })
			);
		}
		simulation.current!.alphaTarget(1).restart();
		return () => {
			simulation.current?.stop();
			simulation.current = null;
		};
	}, []);
	useEffect(() => {
		const s = simulation.current;
		if (!s) return;
		s.nodes(nodes);
		const linkForce = s.force("link") as d3.ForceLink<GraphNode, GraphLink>;
		linkForce.links(links);
		s.alpha(1).restart();
	}, [nodes, links]);

	/* .force(
			"collide",
			forceCollide<GraphNode, GraphLink>().size((d) => ({
				width: d.labelProps?.width ?? 0,
				height: d.labelProps?.height ?? 0,
			})).x((d) => d.labelProps?.x ?? 0).y((d) => d.labelProps?.y ?? 0)
			.setX(nodeSetter("x"))
			.setY(nodeSetter("y")).id((d) => d.id)
		)  */

	return [simulation.current!, tick, requestTick];
}

export function useResizeObserver(el: HTMLElement | null): {width: number, height: number} {
	const resizeObserver = useRef<ResizeObserver | null>(null);
	const [size, setSize] = useState<{width: number, height: number}>({width: 0, height: 0});
	useEffect(() => {
		if (!el) return;
		resizeObserver.current = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setSize({width: entry.contentRect.width, height: entry.contentRect.height});
			}
		});
		resizeObserver.current.observe(el);
		return () =>{
		resizeObserver.current?.disconnect();
		resizeObserver.current = null;
		} 
	}, [el, setSize]);
	return size;
}
export function usePointerLeave({
	node,
	setHover,
	move,
	additionalDeps = [],
	setStroke,
}: {
	node: GraphNode;
	setHover: React.Dispatch<React.SetStateAction<boolean>>;
	move: ReturnType<typeof useMove>;
	additionalDeps?: any[];
	setStroke?: boolean;
}) {
	const { draggedNode, colors } = useContext(GRAPH_CONTEXT)!;
	const { hoveredNode, setHoveredNode } = useContext(INNER_GRAPH_CONTEXT)!;
	return useCallback(
		function (this: Graphics, _evt: FederatedPointerEvent) {
			if (!draggedNode.current) {
				flushSync(() => {
					setHover(false);
				});
				setHoveredNode(null);
				if (!node.isCurrent && setStroke)
					this?.stroke({
						width: 0,
						color: getPropertyValue(colors.nodeStroke!),
					});
			} /*else {
				move.bind(this)(evt);
			}*/
		},
		[node, draggedNode.current, move, setHover, ...additionalDeps]
	);
}

export function useMove({
	node,
	additionalDeps = [],
	label,
	offset,
}: {
	node: GraphNode;
	additionalDeps?: any[];
	label?: Graphics | null;
	offset?: RefObject<Point>;
}) {
	const { draggedNode, dragging } = useContext(GRAPH_CONTEXT)!;
	const { parentRef } = useContext(INNER_GRAPH_CONTEXT)!;
	const hasLogged = useRef(Date.now());
	return useCallback(
		function (this: Graphics, evt: FederatedPointerEvent) {
			if (!draggedNode.current) {
				hasLogged.current = Date.now();
				return;
			}
			if (draggedNode.current.node.id !== node.id) {
				return;
			}
			if (!label && evt.target.label?.includes("label["))
				label = evt.target as Graphics;
			const np = evt.getLocalPosition(parentRef.current!);

			const nx =
				np.x -
				(draggedNode.current?.isDraggingLabel ? offset?.current.x ?? 0 : 0);
			const ny =
				np.y -
				(draggedNode.current?.isDraggingLabel ? offset?.current.y ?? 0 : 0);
			if (
				dragging.current &&
				draggedNode.current?.node.id == node.id
				// && Date.now() - hasLogged.current <= 5000
			) {
				// console.log(`(${nx}, ${ny}); (${np.x}, ${np.y})`)
				// console.log({x: nx, y: ny}, "\n", {x: np.x, y: np.y}, "\nORIG->", {x: node.fx, y: node.fy}, "\n", {x: (offset?.current.x ?? 0) + nx, y: (offset?.current.y ?? 0) + ny})
				// console.log(offset?.current)
			}
			draggedNode.current.node.fx = node.fx = nx;
			draggedNode.current.node.fy = node.fy = ny;
		},
		[
			label,
			parentRef.current,
			...additionalDeps,
			offset?.current,
			offset,
			offset?.current.x,
			offset?.current.y,
			node.id,
		]
	);
}

export function usePointerUp({
	node,
	setDown,
	shouldChangeForce = true,
	offset,
	base,
}: {
	node: GraphNode;
	setDown: React.Dispatch<React.SetStateAction<boolean>>;
	shouldChangeForce?: boolean;
	offset?: RefObject<Point>;
	base?: Point;
}) {
	const { draggedNode, dragging } = useContext(GRAPH_CONTEXT)!;
	const { simulation, setHoveredNode } = useContext(INNER_GRAPH_CONTEXT)!;
	return useCallback(
		function (this: Graphics, evt: FederatedPointerEvent) {
			setHoveredNode(null);
			if (evt.button != 0 && evt.pointerType === "mouse") return;
			if (draggedNode.current) {
				simulation.alphaTarget(0).restart();
				dragging.current = false;
				setDown(false);
				if (shouldChangeForce) {
					draggedNode.current.node.fx = null;
					draggedNode.current.node.fy = null;
				}
				draggedNode.current = null;
				if (shouldChangeForce) {
					node.fx = null;
					node.fy = null;
				}
				if (offset?.current && base) {
					offset.current = base;
				}
			}
		},
		[node, draggedNode.current, setDown, simulation, base]
	);
}

export function usePointerDown({
	node,
	setDown,
	oref,
}: {
	node: GraphNode;
	setDown: React.Dispatch<React.SetStateAction<boolean>>;
	oref?: RefObject<Point>;
}) {
	const { draggedNode, dragging } = useContext(GRAPH_CONTEXT)!;
	const { simulation, parentRef } = useContext(INNER_GRAPH_CONTEXT)!;
	return useCallback(
		function (this: Graphics, evt: FederatedPointerEvent) {
			evt.stopPropagation();
			if (evt.button != 0 && evt.pointerType == "mouse") return;
			if (!draggedNode.current) {
				const isLabel = Boolean(this.label?.includes("label["));
				const offset = evt.getLocalPosition(this);
				draggedNode.current = { node, isDraggingLabel: isLabel };
				if (isLabel && oref) {
					if (
						parentRef.current &&
						typeof node.x === "number" &&
						typeof node.y === "number"
					) {
						const parentPos = evt.getLocalPosition(parentRef.current);
						oref.current = new Point(
							parentPos.x - node.x,
							parentPos.y - node.y
						);
					} else {
						oref.current = new Point(
							offset.x + oref.current.x,
							offset.y + oref.current.y
						);
					}
				}
				if (!oref) {
					node.fx = node.x! - offset.x;
					node.fy = node.y! - offset.y;
				}
				simulation.alphaTarget(1).restart();

				setDown(true);
				dragging.current = true;
			}
		},
		[setDown, simulation, parentRef]
	);
}

export function usePointerOver({
	node,
	setHover,
}: {
	node: GraphNode;
	setHover: React.Dispatch<React.SetStateAction<boolean>>;
}) {
	const { draggedNode } = useContext(GRAPH_CONTEXT)!;
	const { hoveredNode, setHoveredNode } = useContext(INNER_GRAPH_CONTEXT)!;
	return useCallback(
		function (this: Graphics, evt: FederatedPointerEvent) {
			if (
				evt.nativeEvent.target instanceof HTMLElement &&
				evt.nativeEvent.target.tagName.toLocaleLowerCase() != "canvas"
			)
				return;
			if (!draggedNode.current) {
				flushSync(() => {
					setHover(true);
				});
				flushSync(() => {
					setHoveredNode(node.id);
				});
			}
		},
		[draggedNode.current, setHover]
	);
}
