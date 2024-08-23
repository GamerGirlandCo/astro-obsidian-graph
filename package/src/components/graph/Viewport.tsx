import { PixiComponent, useApp } from "@pixi/react";
import { Plugin, Viewport, type IViewportOptions } from "pixi-viewport";
import { forwardRef } from "react";
import {DisplayObject} from "pixi.js";
import React from "react";
import type { PropsWithChildren } from "react";
import type { AstroBuiltinProps } from "astro";

const PixiViewportComponent = PixiComponent("Viewport", {
  create(props) {
    const { app, ...viewportProps } = props;

    const viewport = new Viewport({
      ticker: props.app.ticker,
      interaction: props.app.renderer.plugins.interaction,
	
      ...viewportProps
    });

    // activate plugins
    (props.plugins || []).forEach((plugin) => {
      viewport[plugin]();
    });

    return viewport;
  },
  applyProps(viewport, _oldProps, _newProps) {
    const { plugins: oldPlugins, children: oldChildren, ...oldProps } = _oldProps as any;
    const { plugins: newPlugins, children: newChildren, ...newProps } = _newProps as any;
    

    Object.keys(newProps).forEach((p) => {
      if (oldProps[p] !== newProps[p]) {
        viewport[p] = newProps[p];
      }
    });

  },
  didMount() {
    console.log("viewport mounted");
  }
});

// create a component that can be consumed
// that automatically pass down the app
export const PixiViewport = forwardRef<Viewport, PropsWithChildren<IViewportOptions & AstroBuiltinProps>>((props, ref) => (
  <PixiViewportComponent ref={ref} app={useApp()} {...props} />
));

export type PixiViewportType = typeof PixiViewportComponent;

PixiViewport.displayName = 'PixiViewport';

