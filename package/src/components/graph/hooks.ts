import * as d3 from "d3";
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
				.distance(40)
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
	return useCallback(function (this: Graphics, _evt: FederatedPointerEvent) {
			if (!draggedNode.current) {
				node.hover = false;
				setHover(false);
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
				if (draggedNode.current?.node.id === node.id) {
					// console.log(evt)
					node.fx = draggedNode.current.node.fx = nx;
					node.fy = draggedNode.current.node.fy = ny;
				} else if (draggedNode.current) {
					draggedNode.current.node.fx = nx;
					draggedNode.current.node.fy = ny;
				}
					// console.log({x: node.x, y: node.y}, {x: nx, y: ny})
		},
		[label, parentRef.current, ...additionalDeps, offset?.current, offset, offset?.current.x, offset?.current.y]
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
	const { simulation } = useContext(INNER_GRAPH_CONTEXT)!;
	return useCallback(function(this: Graphics, _evt: FederatedPointerEvent) {
		if (draggedNode.current) {
			simulation.alphaTarget(0);
			dragging.current = false;
			setDown(false);
			draggedNode.current.node.hover = false;
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
	const { simulation } = useContext(INNER_GRAPH_CONTEXT)!;
	return useCallback(function (this: Graphics, evt: FederatedPointerEvent) {
		if (!draggedNode.current) {
			draggedNode.current = { node, isDraggingLabel: this.label?.includes("label[") };
			const offset = this.label?.includes("label[") ? evt.getLocalPosition(this) : new Point(0, 0)
			if(oref) {
				oref.current = new Point(offset.x + oref.current.x, offset.y + oref.current.y);
			}
			simulation.alphaTarget(1).restart();
			if(!oref)
			{
				node.fx = node.x! - offset.x;
				node.fy = node.y! - offset.y;
			}
			if(this.label)
				console.log("pdown", this.label, evt.target.label, evt.getLocalPosition(this))
			setDown(true);
			dragging.current = true;
		}
	}, [setDown, simulation])
}

export function usePointerOver({node, setHover}: {
	node: GraphNode;
	setHover: React.Dispatch<React.SetStateAction<boolean>>;
}) {

	const { draggedNode, dragging } = useContext(GRAPH_CONTEXT)!;
	return useCallback(function (this: Graphics) {
		if (!draggedNode.current) {
			setHover(true);
			node.hover = true;
		}
	}, [draggedNode.current, setHover])
}
