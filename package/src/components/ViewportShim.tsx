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
      events: app.renderer.events,
    });
		configure?.(this);
  }
}

extend({ ViewportWrapper });

const Viewport = forwardRef(function (props: PropsWithChildren<ViewportProps>, ref: ForwardedRef<ViewportWrapper>) {
  const { children, ...rest } = props;
  const { app } = useApplication();
  return (
    app?.renderer ? (
      <pixiViewportWrapper ref={ref} app={app} {...rest}>
        {children}
      </pixiViewportWrapper>
    ): null
  );
})

export { Viewport };
