import React, { forwardRef, useContext, useRef, useMemo, useState, useCallback, useEffect, type RefObject } from "react";
import { Graphics } from "pixi.js";
import gsap from "gsap";
import { GRAPH_CONTEXT, INNER_GRAPH_CONTEXT } from "./context";
import type { GraphLink, ColorProps, GraphNode } from "./types";
import { rgbToHex } from "./utils";

export const PixiGraphLink = forwardRef<
	Graphics,
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
	const gctx = useContext(GRAPH_CONTEXT);
	const { hoveredNode } = useContext(INNER_GRAPH_CONTEXT)!;
	const elRef = useRef<Graphics>(null);
	const playedRef = useRef(false);
	let active = useMemo(
		() => source.hover || target.hover,
		[source, target, source.hover, target.hover, hoveredNode]
	);
	const color = useMemo(() => {

		return active ? colors.activeLink! : colors.linkInactive ?? "#ababab"
	}, [active, colors])
	const oppositeColor = useMemo(() => {
		return !active ? colors.activeLink! : colors.linkInactive ?? "#ababab"
	}, [active, colors]);

	const initialState = useRef({color})
	const [colorState, setColor] = useState(initialState.current)

	const fillFn = useCallback((g: Graphics) => {
		g.clear().moveTo(source.x!, source.y!).lineTo(target.x!, target.y!).stroke({
		 width: 1.2,
			color: initialState.current.color
		});
	}, [active, source, target, color, colorState, initialState.current, hoveredNode])
	const draw = useCallback(
		(g: Graphics) => {
			fillFn(g)
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
			fillFn,
			hoveredNode
		]
	);
	useEffect(() => {
			gsap.to(initialState.current, {
				color,
				duration: 0.25,
				onUpdate: () => setColor({ color: rgbToHex(gsap.utils.splitColor(initialState.current.color).slice(0, 3) as [number, number, number]) })
			})
		}, [active, setColor, oppositeColor])
		useEffect(() => {
		return () => {
			(ref as RefObject<Graphics> | null)?.current?.clear();
			elRef.current?.clear();
			(ref as RefObject<Graphics> | null)?.current?.destroy({
				children: true,
			});
		};
	}, []);
	return useMemo(
		() => <pixiGraphics ref={elRef} draw={draw} />,
		[active, link, draw, link.source, link.target, playedRef.current, hoveredNode]
	);
});

PixiGraphLink.displayName = "PixiGraphLink"
