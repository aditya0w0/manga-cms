"use client";

import React, { HTMLAttributes, forwardRef, useImperativeHandle } from "react";
import { useLiquidGlass, LiquidGlassOptions } from "@/lib/liquid-glass";

export interface LiquidGlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  glassOptions?: LiquidGlassOptions;
  enableGlare?: boolean;
}

export const LiquidGlassPanel = forwardRef<HTMLDivElement, LiquidGlassPanelProps>(
  ({ children, className = "", glassOptions, enableGlare = true, ...props }, outerRef) => {
    const internalRef = useLiquidGlass<HTMLDivElement>(glassOptions, enableGlare);

    useImperativeHandle(outerRef, () => internalRef.current as HTMLDivElement);

    return (
      <div
        ref={internalRef}
        className={`liquid-glass-panel ${enableGlare ? "liquid-glass-glare" : ""} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

LiquidGlassPanel.displayName = "LiquidGlassPanel";
