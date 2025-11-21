import * as d3 from "d3";
import { flushSync } from "react-dom";
import type { RefObject } from "react";
import { useContext, useCallback, useRef } from "react";
import { Container, Graphics, type FederatedPointerEvent, Point } from "pixi.js";
import type { GraphNode, GraphLink, Props, GraphProps } from "./types";
import { GRAPH_CONTEXT, INNER_GRAPH_CONTEXT } from "./context";

export function useGraphColor(d: string, props: Omit<Props, "rootDir">) {
	const pathColors = props.pathColors;
	for (const col in pathColors) {
		if (d.startsWith(col)) {
			return pathColors[col]!.color;
		}
	}
	return props.colors!.nodeInactive!;
}

export const useNodeRadius = (d: GraphNode, links: GraphLink[]) => {
	let multiplier = d.isCurrent ? 7.5 : 5.5;
	const numOut =
		links.filter((a) => (a.source as GraphNode).id === d.id).length || 0;
	const numIn =
		links.filter((a) => (a.target as GraphNode).id === d.id).length || 0;
	return multiplier * Math.sqrt(numOut + numIn);
};

export function useSimulation({
	nodes,
	links,
	graphConfig,
	container,
}: {
	container: RefObject<HTMLDivElement>;
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
				.distance(graphConfig.linkDistance ?? 25)
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

export function usePointerLeave({
	node,
	setHover,
	move,
	additionalDeps = [],
	setStroke
}: {
		node: GraphNode;
		setHover: React.Dispatch<React.SetStateAction<boolean>>;
		move: ReturnType<typeof useMove>;
		additionalDeps?: any[];
		setStroke?: boolean
}) {
	const { draggedNode, colors } = useContext(GRAPH_CONTEXT)!;
	const { hoveredNode, setHoveredNode } = useContext(INNER_GRAPH_CONTEXT)!;
	return useCallback(function (this: Graphics, _evt: FederatedPointerEvent) {
			if (!draggedNode.current) {
					node.hover = false
					flushSync(() => {
						setHover(false);
					})
				setHoveredNode(null);
				if(!node.isCurrent && setStroke)
				this?.stroke({
					width: 0,
					color: colors.nodeStroke!,
				})
			} /*else {
				move.bind(this)(evt);
			}*/
	}, [node, draggedNode.current, move, setHover, ...additionalDeps])
}

export function useMove({
	node,
	additionalDeps = [],
	label,
	offset
}: {
	node: GraphNode;
	additionalDeps?: any[],
	label?: Graphics | null,
	offset?: RefObject<Point>
}) {
	const { draggedNode, dragging } = useContext(GRAPH_CONTEXT)!;
	const { parentRef } = useContext(INNER_GRAPH_CONTEXT)!;
	const hasLogged = useRef(Date.now());
	return useCallback(
		function (this: Graphics, evt: FederatedPointerEvent) {
			if(!draggedNode.current) {
				hasLogged.current = Date.now()
				return
			}
			if(draggedNode.current.node.id !== node.id) {
				return;
			}
			if(!label && evt.target.label?.includes("label["))
				label = evt.target as Graphics
			const np = evt.getLocalPosition(parentRef.current!);

			const nx =  (np.x - (draggedNode.current?.isDraggingLabel ? offset?.current.x ?? 0 : 0));
			const ny = (np.y - (draggedNode.current?.isDraggingLabel ? offset?.current.y ?? 0 : 0));
			if(dragging.current && draggedNode.current?.node.id == node.id
			// && Date.now() - hasLogged.current <= 5000
			) {
				// console.log(`(${nx}, ${ny}); (${np.x}, ${np.y})`)
				// console.log({x: nx, y: ny}, "\n", {x: np.x, y: np.y}, "\nORIG->", {x: node.fx, y: node.fy}, "\n", {x: (offset?.current.x ?? 0) + nx, y: (offset?.current.y ?? 0) + ny})
				// console.log(offset?.current)
			}
			draggedNode.current.node.fx = node.fx = nx;
			draggedNode.current.node.fy = node.fy = ny;
		},
		[label, parentRef.current, ...additionalDeps, offset?.current, offset, offset?.current.x, offset?.current.y, node.id]
	)
}

export function usePointerUp({
	node,
	setDown,
	shouldChangeForce = true,
	offset,
	base
}: {
	node: GraphNode,
	setDown: React.Dispatch<React.SetStateAction<boolean>>,
	shouldChangeForce?: boolean;
		offset?: RefObject<Point>;
		base?: Point
}) {
	const { draggedNode, dragging } = useContext(GRAPH_CONTEXT)!;
	const { simulation, setHoveredNode, hoveredNode } = useContext(INNER_GRAPH_CONTEXT)!;
	return useCallback(function(this: Graphics, _evt: FederatedPointerEvent) {
		if (draggedNode.current) {
			simulation.alphaTarget(0);
			if(draggedNode.current) {
					draggedNode.current.node.hover = false
				}
			setHoveredNode(null);
				node.hover = dragging.current = false
				setDown(false);
			if(shouldChangeForce) {
				draggedNode.current.node.fx = null;
				draggedNode.current.node.fy = null;
			}
			draggedNode.current = null;
			if(shouldChangeForce) {
				node.fx = null;
				node.fy = null;
			}
			if(offset?.current && base) {
				offset.current = base
			}
		}
	}, [node, draggedNode.current, setDown, simulation, base])
}

export function usePointerDown({node, setDown, oref}: {
	node: GraphNode
	setDown: React.Dispatch<React.SetStateAction<boolean>>,
	oref?: RefObject<Point>
}) {
	const { draggedNode, dragging } = useContext(GRAPH_CONTEXT)!;
	const { simulation, parentRef } = useContext(INNER_GRAPH_CONTEXT)!;
	return useCallback(function (this: Graphics, evt: FederatedPointerEvent) {
		if (!draggedNode.current) {
			const isLabel = Boolean(this.label?.includes("label["));
			const offset = evt.getLocalPosition(this);
			draggedNode.current = { node, isDraggingLabel: isLabel };
			if(isLabel && oref) {
				if(
					parentRef.current &&
					typeof node.x === "number" &&
					typeof node.y === "number"
				) {
					const parentPos = evt.getLocalPosition(parentRef.current);
					oref.current = new Point(parentPos.x - node.x, parentPos.y - node.y);
				} else {
					oref.current = new Point(offset.x + oref.current.x, offset.y + oref.current.y);
				}
			}
			simulation.alphaTarget(1).restart();
			if(!oref)
			{
				node.fx = node.x! - offset.x;
				node.fy = node.y! - offset.y;
			}
			
			setDown(true);
			dragging.current = true;
		}
	}, [setDown, simulation, parentRef])
}

export function usePointerOver({node, setHover}: {
	node: GraphNode;
	setHover: React.Dispatch<React.SetStateAction<boolean>>;
}) {

	const { draggedNode } = useContext(GRAPH_CONTEXT)!;
	const { hoveredNode, setHoveredNode } = useContext(INNER_GRAPH_CONTEXT)!;
	return useCallback(function (this: Graphics) {
		if (!draggedNode.current) {
				flushSync(() => {
					setHover(node.hover = true);
				})
				flushSync(() => {
					setHoveredNode(node.id);
				})
		}
	}, [draggedNode.current, setHover])
}
