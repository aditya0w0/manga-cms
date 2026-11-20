"use client";

import { useEffect, useRef } from "react";

const SVG_NS = "http://www.w3.org/2000/svg";
let uid = 0;
let svgDefs: SVGDefsElement | null = null;

// Determine if the client environment supports SVG filters via backdrop-filter
function isRefractionSupported(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  const ua = navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|Arc/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  if (isSafari || isFirefox) return false;
  if (!CSS.supports("backdrop-filter", "url(#lg-probe)")) return false;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 4;
    return !!c.getContext("2d")?.getImageData(0, 0, 1, 1);
  } catch {
    return false;
  }
}

function ensureDefs(): SVGDefsElement {
  if (svgDefs && svgDefs.isConnected) return svgDefs;
  const existing = document.getElementById("liquid-glass-svg-root");
  if (existing) {
    const defs = existing.querySelector("defs");
    if (defs) {
      svgDefs = defs;
      return svgDefs;
    }
  }

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.id = "liquid-glass-svg-root";
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.setAttribute("aria-hidden", "true");
  svg.style.position = "absolute";
  svg.style.pointerEvents = "none";
  svgDefs = document.createElementNS(SVG_NS, "defs");
  svg.appendChild(svgDefs);
  document.body.appendChild(svg);
  return svgDefs;
}

// Displacement map generator using red (X) and blue (Y) gradients with neutral interior
function makeMap(
  w: number,
  h: number,
  radius: number,
  border: number,
  mapBlur: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(16, Math.floor(w));
  canvas.height = Math.max(16, Math.floor(h));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Red ramp: X displacement
  const gx = ctx.createLinearGradient(0, 0, canvas.width, 0);
  gx.addColorStop(0, "rgb(0,0,0)");
  gx.addColorStop(1, "rgb(255,0,0)");
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Blue ramp: Y displacement
  const gy = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gy.addColorStop(0, "rgb(0,0,0)");
  gy.addColorStop(1, "rgb(0,0,255)");
  ctx.globalCompositeOperation = "difference";
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Inset neutral 50% gray rounded rect so only rims bend
  ctx.globalCompositeOperation = "source-over";
  const inset = Math.max(4, Math.floor(border * Math.min(canvas.width, canvas.height)));
  ctx.filter = `blur(${mapBlur}px)`;
  ctx.fillStyle = "rgba(128,128,128,0.95)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(
      inset,
      inset,
      canvas.width - inset * 2,
      canvas.height - inset * 2,
      Math.max(radius - inset, 4)
    );
  } else {
    ctx.rect(inset, inset, canvas.width - inset * 2, canvas.height - inset * 2);
  }
  ctx.fill();
  ctx.filter = "none";

  return canvas.toDataURL();
}

// Multi-pass SVG filter for chromatic rim aberration
function buildFilter(id: string, scales: number[]) {
  const filter = document.createElementNS(SVG_NS, "filter");
  filter.setAttribute("id", id);
  filter.setAttribute("x", "0");
  filter.setAttribute("y", "0");
  filter.setAttribute("width", "100%");
  filter.setAttribute("height", "100%");
  filter.setAttribute("color-interpolation-filters", "sRGB");

  const feImage = document.createElementNS(SVG_NS, "feImage");
  feImage.setAttribute("x", "0");
  feImage.setAttribute("y", "0");
  feImage.setAttribute("result", "map");
  feImage.setAttribute("preserveAspectRatio", "none");
  filter.appendChild(feImage);

  const keep = [
    "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
    "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
    "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
  ];

  const channels: string[] = [];
  for (let i = 0; i < 3; i++) {
    const disp = document.createElementNS(SVG_NS, "feDisplacementMap");
    disp.setAttribute("in", "SourceGraphic");
    disp.setAttribute("in2", "map");
    disp.setAttribute("scale", String(scales[i]));
    disp.setAttribute("xChannelSelector", "R");
    disp.setAttribute("yChannelSelector", "B");
    disp.setAttribute("result", `d${i}`);
    filter.appendChild(disp);

    const cm = document.createElementNS(SVG_NS, "feColorMatrix");
    cm.setAttribute("in", `d${i}`);
    cm.setAttribute("type", "matrix");
    cm.setAttribute("values", keep[i]);
    cm.setAttribute("result", `c${i}`);
    filter.appendChild(cm);
    channels.push(`c${i}`);
  }

  const blend1 = document.createElementNS(SVG_NS, "feBlend");
  blend1.setAttribute("in", channels[0]);
  blend1.setAttribute("in2", channels[1]);
  blend1.setAttribute("mode", "screen");
  blend1.setAttribute("result", "c01");
  filter.appendChild(blend1);

  const blend2 = document.createElementNS(SVG_NS, "feBlend");
  blend2.setAttribute("in", "c01");
  blend2.setAttribute("in2", channels[2]);
  blend2.setAttribute("mode", "screen");
  filter.appendChild(blend2);

  ensureDefs().appendChild(filter);
  return { filter, feImage };
}

export interface LiquidGlassOptions {
  scale?: number;
  chroma?: number;
  border?: number;
  mapBlur?: number;
  blur?: number;
  saturate?: number;
  radius?: number | null;
  fallbackBlur?: number;
}

export interface LiquidGlassInstance {
  supported: boolean;
  refresh: () => void;
  destroy: () => void;
}

export function applyLiquidGlass(
  el: HTMLElement,
  options?: LiquidGlassOptions
): LiquidGlassInstance {
  const opts = {
    scale: -80,
    chroma: 4,
    border: 0.06,
    mapBlur: 10,
    blur: 4,
    saturate: 1.4,
    radius: null,
    fallbackBlur: 16,
    ...options,
  };

  const supported = isRefractionSupported();

  if (!supported) {
    const fallbackStyle = `blur(${opts.fallbackBlur}px) saturate(${opts.saturate})`;
    el.style.backdropFilter = fallbackStyle;
    (el.style as any).webkitBackdropFilter = fallbackStyle;
    el.classList.add("lg-fallback");
    return {
      supported: false,
      refresh: () => {},
      destroy: () => {
        el.style.backdropFilter = "";
        (el.style as any).webkitBackdropFilter = "";
        el.classList.remove("lg-fallback");
      },
    };
  }

  const id = `lg-filter-${++uid}`;
  const scales = [opts.scale, opts.scale + opts.chroma, opts.scale + 2 * opts.chroma];
  const parts = buildFilter(id, scales);

  function refresh() {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h) return;
    const radius =
      opts.radius ??
      (parseFloat(window.getComputedStyle(el).borderTopLeftRadius || "16") || 16);
    parts.feImage.setAttribute("href", makeMap(w, h, radius, opts.border, opts.mapBlur));
    parts.feImage.setAttribute("width", String(w));
    parts.feImage.setAttribute("height", String(h));
  }

  refresh();
  el.style.backdropFilter = `url(#${id}) blur(${opts.blur}px) saturate(${opts.saturate})`;

  let timer: NodeJS.Timeout | null = null;
  const ro = new ResizeObserver(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(refresh, 100);
  });
  ro.observe(el);

  return {
    supported: true,
    refresh,
    destroy: () => {
      ro.disconnect();
      if (timer) clearTimeout(timer);
      parts.filter.remove();
      el.style.backdropFilter = "";
    },
  };
}

// React Hook to attach liquid glass to any container ref
export function useLiquidGlass<T extends HTMLElement>(
  options?: LiquidGlassOptions
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;
    const instance = applyLiquidGlass(ref.current, options);
    return () => instance.destroy();
  }, [options]);

  return ref;
}
