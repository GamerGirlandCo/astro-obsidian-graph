import type { PixiReactElementProps, PixiElements } from '@pixi/react';
import { type Viewport, type ViewportWrapper } from "../components/ViewportShim"
import { type Application } from "pixi.js";
import { PropsWithChildren } from "react";
declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends PixiElements {
        pixiViewportWrapper: PropsWithChildren<PixiReactElementProps<typeof ViewportWrapper>> & {
          app: Application;
        };
      }
    }
  }
}
export {}
