import type { AstroBuiltinAttributes } from "astro";
import { createContext, type RefObject } from "react";
import type { Simulation } from "d3";
import { Graphics, Container } from "pixi.js";
import type { GraphLink, GraphNode, Props } from "./types";

/*type Textures = {
	hover: RenderTexture;
	normal: RenderTexture;
};*/

export interface GraphContext extends Props, AstroBuiltinAttributes {
	container: RefObject<HTMLDivElement>;
	linkGfx: Graphics;
	dragging: RefObject<boolean>;
	draggedNode: RefObject<{ node: GraphNode; isDraggingLabel: boolean; } | null>;
	anyHovered: RefObject<boolean>;
}

export const GRAPH_CONTEXT = createContext<GraphContext | null>(null);

interface InnerGraphContext {
	links: GraphLink[];
	nodes: GraphNode[];
	parentRef: RefObject<Container | null>;
	simulation: Simulation<GraphNode, GraphLink>
}

export const INNER_GRAPH_CONTEXT = createContext<InnerGraphContext | null>(null);
