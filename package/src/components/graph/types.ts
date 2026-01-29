import type { SimulationNodeDatum, SimulationLinkDatum } from "d3-force";
import type { Sprite } from "pixi.js";
import type { CSSProperties, ComponentProps } from "react";
import type { Graphics } from "pixi.js";

export interface GraphProps {
	enableZoom: boolean;
	repelForce?: number;
	linkDistance?: number;
	scale?: number;
	dimOnDrag?: boolean;
	hideInactiveLabels?: boolean;
}
export interface ColorProps {
	activeNode: string;
	nodeInactive: string;
	activeLink: string;
	linkInactive: string;
	nodeHover: string;
	nodeStroke: string;
	labelBg: string;
	label: string;
	labelBorder: string;
}

export interface Props {
	enableLegend?: boolean;
	currentUrl: string;
	pathColors?: Record<
		string,
		{
			color: string;
			title: string;
		}
	>;
	fontSize?: number;
	graphConfig: Partial<GraphProps>;
	colors: Partial<ColorProps>;
	rootDir: string;
	labels: {
		borderWidth: number;
		padding: number;
		borderStyle: CSSProperties["borderStyle"]
	};
}

export interface LabelProps {
	x: number;
	y: number;
	width: number;
	height: number;

	_vx?: number;
	_vy?: number;
	_baseX?: number;
	_baseY?: number;
}

export interface GraphNode extends SimulationNodeDatum {
	isCurrent: boolean;
	id: string;
	title: string;
	color?: CSSProperties["color"];
	collection: string;
	labelProps?: LabelProps;
}
export interface SpriteGraphNode extends GraphNode {
	gfx: Graphics;
}

interface BaseGraphLink {
	strength: number;
}

export interface SpriteGraphLink
	extends SimulationLinkDatum<SpriteGraphNode>,
		BaseGraphLink {}
export interface GraphLink
	extends SimulationLinkDatum<GraphNode>,
		BaseGraphLink {}


export interface Rect {
	height: number;
	width: number;
	x: number;
	y: number;
}
