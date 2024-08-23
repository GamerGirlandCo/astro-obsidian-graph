import type {
	FederatedEventMap,
	FederatedEvent,
	InteractionEventTypes,
	Graphics as PixiGraphics,
} from "pixi.js";
import "pixi.js";
import React from "react";
declare module "pixi.js" {
	interface Sprite {
		on(
			eventName: keyof FederatedEventMap,
			fn: (this: Sprite, ev: FederatedEventMap[typeof eventName]) => void
		);
	}
}

declare module "@pixi/react" {	
	declare const Graphics: React.FC<
		Container<
			PixiGraphics,
			{
				/**
				try 
				 */
				draw?(graphics: PixiGraphics): void;
				geometry?: PixiGraphics
			}
		>
	>;
	export {Graphics}
}
