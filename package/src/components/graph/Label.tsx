import React, {forwardRef, useContext, useState, useCallback, useRef, useEffect, useMemo, type RefObject, type ForwardedRef, type Dispatch, type SetStateAction} from "react";
import {Graphics, Container, Text, Rectangle, Point} from "pixi.js"
import gsap from "gsap";
import type { GraphNode } from "./types";
import { GRAPH_CONTEXT, INNER_GRAPH_CONTEXT } from "./context";
import { useMove, useNodeRadius, usePointerDown, usePointerLeave, usePointerOver, usePointerUp } from "./hooks";


export const NodeLabel = forwardRef(function ({node, hover, setHover, offset}: {
	node: GraphNode,
	hover: boolean,
	setHover: React.Dispatch<React.SetStateAction<boolean>>,
	offset: RefObject<Point>
}, ref: ForwardedRef<Graphics>) {
	const gctx = useContext(GRAPH_CONTEXT);
	if(!gctx)
		return null
	const { links, viewportRef, zoom } = useContext(INNER_GRAPH_CONTEXT)!;
	const textRes = useMemo(() => Math.max(zoom ?? 1, 1), [zoom])

	const [down, setDown] = useState<boolean>(false);
	const bgAlpha = useRef({ alpha: 0.5 });
	const { colors, labels } = gctx;
	const tref = useRef<Text>(null);
	const cref = useRef<Container>(null);

	const bgWidth = useMemo(() => {
		const width = tref.current ? tref.current.width : 0;
		return width + (labels.padding * 2)
	}, [tref.current?.width, labels.padding])
	const bgHeight = useMemo(() => {
		const height = tref.current ? tref.current.height : 0;
		return height + (labels.padding * 2)
	}, [tref.current?.height, labels.padding])
	const additionalY = useNodeRadius(node, links);


	const move = useMove({node, label: (ref as RefObject<Graphics> | null)?.current ?? null, offset })
	const pointerUp = usePointerUp({node, setDown, offset });
	const pointerDown = usePointerDown({ node, setDown, oref: offset });
	const pointerLeave = usePointerLeave({ node, setHover, move });
	const pointerOver = usePointerOver({ node, setHover });

	const boundPointerUp = useRef<typeof pointerUp | null>(null)
	const boundPointerDown = useRef<typeof pointerDown | null>(null);

	const bgDraw = useCallback((g: Graphics) => {
		boundPointerUp.current = pointerUp.bind(g);
		boundPointerDown.current = pointerDown.bind(g);
		g.removeAllListeners();
		// g.x = node.x! + (bgWidth / 2)
		// g.y = node.y! + bgHeight!
		g.on("pointerleave", pointerLeave.bind(g))
			.on("pointerdown", boundPointerDown.current)
			.on("pointerup", function(this: Graphics, evt) {
				pointerUp.call(this, evt)
			})
			.on("pointerover", pointerOver.bind(g))
		if (tref.current) {
			// console.log(`w=${bgWidth}; h=${bgHeight}`)
			g.clear().setFillStyle({
				color: (colors.labelBg ?? "#ededed"),
				// alpha: bgAlpha.current.alpha
			})
				.roundRect(
					0,
					0,
					bgWidth,
					bgHeight,
					3.75
				)
				.fill()
		}

		if(cref.current) {
			// cref.current.x = node.x!
		}
	}, [
		colors, tref, tref.current,
		node,
		hover,
		// node.x, node.y,
		pointerLeave, pointerDown,
		pointerOver, pointerUp,
		bgWidth, bgHeight,
		bgAlpha,
		bgAlpha.current,
		bgAlpha.current.alpha
	]);

	useEffect(() => {
		gsap.to(cref.current, {
				alpha: hover ? 1 : 0.5,
				duration: 0.3
			})
	}, [hover]);

	// useEffect(() => {
	// 	if(parentRef.current) {
	// 		if(boundPointerUp.current)
	// 			parentRef.current.on("pointerupoutside", boundPointerUp.current);
	// 		parentRef.current.on("pointerup", pointerUp);
	// 	}
	// 	return () => {
	// 		if(boundPointerUp.current)
	// 			parentRef.current?.removeEventListener("pointerupoutside", boundPointerUp.current)
	// 		parentRef.current?.removeEventListener("pointerup", pointerUp);
	// 	}
	// }, [parentRef, parentRef.current])
	useEffect(() => {
		// if(cref.current)
			// console.log(`${node.id}=[${cref.current.x}, ${cref.current.y}]`)
	}, [cref.current])
	const ha = useMemo(() => {
		return new Rectangle(0,
					0, bgWidth, bgHeight)
	}, [bgWidth, bgHeight])
	// if(node.hover)
		// console.log(`{ id=${node.id}, offset=${yOffset} }`)
		return useMemo(() => (
		<pixiContainer eventMode="passive" ref={cref} label={`container.label[${node.id}]`} anchor={{x: 1, y: 0}} y={additionalY} x={-bgWidth} isRenderGroup>
				<pixiGraphics draw={bgDraw} ref={ref} eventMode="static" hitArea={ha} label={`label[${node.id}]`}>
					</pixiGraphics>
					<pixiText
					resolution={textRes}
					eventMode="none"
					ref={tref}
					x={labels.padding}
					y={labels.padding}
					text={node.title}
					style={{ align: "center", fontSize: "14pt", fill: colors.label ?? "#000" }}
					/>
		</pixiContainer>
		), [node.title, textRes, hover, offset, ha, bgDraw, bgAlpha.current.alpha, bgAlpha.current, bgAlpha, zoom])
})
NodeLabel.displayName = "NodeLabel"
