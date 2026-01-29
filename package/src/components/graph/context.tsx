import type { AstroBuiltinAttributes } from "astro";
import { createContext, type RefObject, type Dispatch, type SetStateAction } from "react";
import type { Simulation } from "d3-force";
import type { Quadtree } from "d3";
import { Graphics, Container } from "pixi.js";
import type { GraphLink, GraphNode, Props, Rect } from "./types";
import type { ViewportWrapper } from "components/ViewportShim";

/*type Textures = {
	hover: RenderTexture;
	normal: RenderTexture;
};*/

export interface GraphContext extends Props, AstroBuiltinAttributes {
	container: RefObject<HTMLDivElement>;
	dragging: RefObject<boolean>;
	draggedNode: RefObject<{ node: GraphNode; isDraggingLabel: boolean; } | null>;
}

export const GRAPH_CONTEXT = createContext<GraphContext | null>(null);

interface InnerGraphContext {
	links: GraphLink[];
	nodes: GraphNode[];
	parentRef: RefObject<Container | null>;
	simulation: Simulation<GraphNode, GraphLink>;
	viewportRef: RefObject<ViewportWrapper | null>;
	zoom: number;
	hoveredNode: string | null;
	setHoveredNode: Dispatch<SetStateAction<string | null>>;
	updateNodeLabelProps: (idx: number, props: Rect) => void;
	currentNode: RefObject<GraphNode | null>;
}

export const INNER_GRAPH_CONTEXT = createContext<InnerGraphContext | null>(null);
