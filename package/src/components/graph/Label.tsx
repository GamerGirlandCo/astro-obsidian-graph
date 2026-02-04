import React, {
	forwardRef,
	useContext,
	useState,
	useCallback,
	useRef,
	useEffect,
	useMemo,
	type RefObject,
	type ForwardedRef,
	type Dispatch,
	type SetStateAction,
} from "react";
import {
	Graphics,
	Container,
	Text,
	Rectangle,
	Point,
	CanvasTextMetrics,
	TextStyle,
} from "pixi.js";
import { DashLine } from "@btfash/pixi-dashed-line";
import gsap from "gsap";
import type { GraphNode } from "./types";
import { getPropertyValue } from "./utils";
import { GRAPH_CONTEXT, INNER_GRAPH_CONTEXT } from "./context";
import {
	useMove,
	useNodeRadius,
	usePointerDown,
	usePointerLeave,
	usePointerOver,
	usePointerUp,
} from "./hooks";
import chroma from "chroma-js";

export const NodeLabel = forwardRef(function (
	{
		node,
		hover,
		setHover,
		offset,
		index
	}: {
		node: GraphNode;
		hover: boolean;
		setHover: React.Dispatch<React.SetStateAction<boolean>>;
		index: number;
		offset: RefObject<Point>;
	},
	ref: ForwardedRef<Graphics>
) {
	const gctx = useContext(GRAPH_CONTEXT);
	if (!gctx) return null;
	const { links, viewportRef, zoom, updateNodeLabelProps, currentNode } =
		useContext(INNER_GRAPH_CONTEXT)!;
	const textRes = useMemo(() => Math.max(zoom ?? 1, 1), [zoom]);

	const [down, setDown] = useState<boolean>(false);
	const bgAlpha = useRef({
		alpha: gctx.graphConfig.hideInactiveLabels ? 0 : 0.5,
	});
	const { colors, labels } = gctx;
	const tref = useRef<Text>(null);
	const cref = useRef<Container>(null);
	const bref = useRef<Graphics>(null);

	const textStyle: TextStyle = useMemo(
		() =>
			new TextStyle({
				align: "center",
				fontSize: labels.fontSize ?? "14pt",
				fill: getPropertyValue(colors.label ?? "#000"),
				fontFamily: labels.fontFamily ?? "sans-serif",
			}),
		[colors.label, labels.fontFamily, labels.fontSize]
	);

	const { width: textWidth, height: textHeight } = useMemo(() => {
		return CanvasTextMetrics.measureText(node.title, textStyle);
	}, [node.title, textStyle]);

	const bgWidth = useMemo(() => {
		return textWidth + labels.padding * 2;
	}, [textWidth, labels.padding]);
	const bgHeight = useMemo(() => {
		return textHeight + labels.padding * 2;
	}, [textHeight, labels.padding]);
	const additionalY = useNodeRadius(node, links);

	const move = useMove({
		node,
		label: (ref as RefObject<Graphics> | null)?.current ?? null,
		offset,
	});
	const pointerUp = usePointerUp({ node, setDown, offset });
	const pointerDown = usePointerDown({ node, setDown, oref: offset });
	const pointerLeave = usePointerLeave({ node, setHover, move });
	const pointerOver = usePointerOver({ node, setHover });

	const boundPointerUp = useRef<typeof pointerUp | null>(null);
	const boundPointerDown = useRef<typeof pointerDown | null>(null);

	const labelBg = useMemo(() => {
		return chroma(getPropertyValue(colors.labelBg ?? "#ededed")).hex();
	}, [colors.labelBg]);

	const dashPattern = useMemo(() => {
		switch (labels.borderStyle) {
			case "dashed":
				return [2, 5];
			case "dotted":
				return [0.5, 3];
			case "solid":
			default:
				return undefined;
		}
	}, [labels.borderStyle]);

	const bgDraw = useCallback(
		(g: Graphics) => {
			boundPointerUp.current = pointerUp.bind(g);
			boundPointerDown.current = pointerDown.bind(g);
			g.removeAllListeners();
			// g.x = node.x! + (bgWidth / 2)
			// g.y = node.y! + bgHeight!
			g.on("pointerleave", pointerLeave.bind(g))
				.on("pointerdown", boundPointerDown.current)
				.on("pointerup", function (this: Graphics, evt) {
					pointerUp.call(this, evt);
				})
				.on("pointerover", pointerOver.bind(g));
			if (tref.current) {
				// console.log(`w=${bgWidth}; h=${bgHeight}`)
				g.clear();
				g.setFillStyle({
					color: labelBg,
					// alpha: bgAlpha.current.alpha
				})
					.roundRect(0, 0, bgWidth, bgHeight, 3.75)
					.fill();
				if (
					labels.borderWidth !== undefined &&
					labels.borderWidth > 0 &&
					!dashPattern
				) {
					g.stroke({
						width: labels.borderWidth,
						color: chroma(getPropertyValue(colors.labelBorder ?? "#000")).hex(),
						pixelLine: false,
					});
				}
			}

			if (cref.current) {
				// cref.current.x = node.x!
			}
		},
		[
			colors,
			tref,
			tref.current,
			node,
			hover,
			dashPattern,
			zoom,
			pointerLeave,
			pointerDown,
			pointerOver,
			pointerUp,
			bgWidth,
			bgHeight,
			labels.borderWidth,
			bgAlpha,
			bgAlpha.current,
			bgAlpha.current.alpha,
		]
	);

	const borderDraw = useCallback(
		(g: Graphics) => {
			if (dashPattern) {
				const asNumber = chroma(getPropertyValue(colors.labelBorder ?? "#000"))
					.alpha(1)
					.hex();
				const dash = new DashLine(g, {
					dash: dashPattern,
					width: labels.borderWidth,
					useTexture: false,
					scale: 1,
					join: "round",
					cap: "round",
					alpha: 1,
					color: parseInt(
						"0x" +
							chroma(getPropertyValue(colors.labelBorder ?? "#000000"))
								.hex("rgb")
								.slice(1),
						16
					),
				});
				dash.setStrokeStyle();
				// dash.setStrokeStyle();
				dash.roundRect(
					0,
					0,
					bgWidth,
					bgHeight,
					3.75
					//3.75
				);
			}
		},
		[
			dashPattern,
			labels.borderWidth,
			bgWidth,
			bgHeight,
			colors.labelBorder,
			tref.current,
			// bgDraw,
		]
	);

	useEffect(() => {
		gsap.to(cref.current, {
			alpha: hover ? 1 : gctx.graphConfig.hideInactiveLabels ? 0 : 0.5,
			duration: 0.3,
		});
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
	}, [cref.current]);
	const ha = useMemo(() => {
		return new Rectangle(0, 0, bgWidth, bgHeight);
	}, [bgWidth, bgHeight]);

	useEffect(() => {
		updateNodeLabelProps(index, {
			x: node.labelProps?.x ?? 0,
			y: node.labelProps?.y ?? 0,
			width: bgWidth,
			height: bgHeight,
		});
	}, [bgWidth, bgHeight]);

	useEffect(() => {
		if(bref.current) {
			// borderDraw(bref.current);
		}
	}, [bref.current, node.x, node.y, borderDraw])
	// if(node.hover)
	// console.log(`{ id=${node.id}, offset=${yOffset} }`)
	return useMemo(
		() => (
			<pixiContainer
				eventMode="passive"
				ref={cref}
				label={`container.label[${node.id}]`}
				anchor={{ x: 0, y: 0 }}
				y={node.labelProps?.y ?? 0}
				x={node.labelProps?.x ?? 0}
				isRenderGroup
			>
				<pixiGraphics
					draw={bgDraw}
					ref={ref}
					eventMode="static"
					hitArea={ha}
					label={`label[${node.id}]`}
				></pixiGraphics>
				<pixiGraphics
					draw={borderDraw}
					eventMode="none"
					label={`label.border[${node.id}]`}
				></pixiGraphics>
				<pixiText
					resolution={textRes}
					eventMode="none"
					ref={tref}
					x={labels.padding}
					y={labels.padding}
					text={node.title}
					style={textStyle}
				/>
			</pixiContainer>
		),
		[
			node.title,
			textRes,
			hover,
			offset,
			ha,
			bgDraw,
			bgAlpha.current.alpha,
			bgAlpha.current,
			bgAlpha,
			zoom,
			node.labelProps?.x,
			node.labelProps?.y,
			currentNode.current,
			borderDraw,
		]
	);
});
NodeLabel.displayName = "NodeLabel";
