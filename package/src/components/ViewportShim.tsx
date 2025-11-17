import { extend, useApplication } from "@pixi/react";
import { Viewport as BaseViewport, type IViewportOptions } from "pixi-viewport";
import { Application } from "pixi.js";
import React, { forwardRef, type PropsWithChildren, type ForwardedRef } from "react";

type ViewportProps = Omit<IViewportOptions, "events"> & {
	configure?: (vp: ViewportWrapper) => void
};

export class ViewportWrapper extends BaseViewport {
  constructor(options: ViewportProps & { app: Application }) {
    const { app, configure, ...rest } = options;
    super({
      ...rest,
      // events is the only required argument to the constructor.
      // This may be why extend() doesn't work propertly with pixi-viewport.
      // other pixi elements have no required arguments to the constructor.
      // hence we need to pass the app to the constructor.
      events: app.renderer.events,
    });
		configure?.(this);
  }
}

extend({ ViewportWrapper });

const Viewport = function (props: PropsWithChildren<ViewportProps>) {
  const { children, ...rest } = props;
  const { app } = useApplication();
  return (
    app?.renderer ? (
      <pixiViewportWrapper app={app} {...rest}>
        {children}
      </pixiViewportWrapper>
    ): null
  );
}

export { Viewport };
