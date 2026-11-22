"use client";

import { useEffect, useRef, RefObject } from "react";

export interface LiquidGlassOptions {
  scale?: number;       // displacement strength; negative = magnifying bulge (-60 to -180)
  chroma?: number;      // per-channel scale stagger (prism fringe); 0 disables
  border?: number;      // neutral interior inset fraction (0.05 to 0.1)
  mapBlur?: number;     // edge curvature softness in px
  blur?: number;        // backdrop blur in px
  saturate?: number;    // backdrop saturation multiplier
  radius?: number | null; // corner radius override in px (defaults to computed border-radius)
  fallbackBlur?: number; // frosted blur fallback on Safari/Firefox
}

export interface LiquidGlassInstance {
  supported: boolean;
  refresh: () => void;
  destroy: () => void;
}

const SVG_NS = "http://www.w3.org/2000/svg";
let uid = 0;
let svgDefs: SVGDefsElement | null = null;
let cachedSupported: boolean | null = null;

// Reusable canvas and map cache to prevent memory churn and GC pauses
const MAX_DIM = 192;
const mapCache = new Map<string, string>();
const MAX_CACHE_SIZE = 50;

let sharedCanvas: HTMLCanvasElement | null = null;
let sharedCtx: CanvasRenderingContext2D | null = null;

function getSharedCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
} | null {
  if (typeof document === "undefined") return null;
  if (!sharedCanvas) {
    sharedCanvas = document.createElement("canvas");
    sharedCtx = sharedCanvas.getContext("2d", { willReadFrequently: false });
  }
  if (!sharedCanvas || !sharedCtx) return null;
  sharedCanvas.width = width;
  sharedCanvas.height = height;
  return { canvas: sharedCanvas, ctx: sharedCtx };
}

// Chromium supports SVG filters via backdrop-filter; Safari, Firefox, and reduced motion fallback
const isChromiumSupported = (): boolean => {
  if (cachedSupported !== null) return cachedSupported;
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  // Respect system reduced-motion preference (Apple HIG / Accessibility)
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    cachedSupported = false;
    return false;
  }

  const ua = navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  if (isSafari || isFirefox) {
    cachedSupported = false;
    return false;
  }

  if (!CSS.supports("backdrop-filter", "url(#lg)")) {
    cachedSupported = false;
    return false;
  }

  try {
    const c = document.createElement("canvas");
    c.width = c.height = 4;
    c.getContext("2d")?.getImageData(0, 0, 1, 1);
    cachedSupported = true;
    return true;
  } catch {
    cachedSupported = false;
    return false;
  }
};

function ensureDefs(): SVGDefsElement {
  if (svgDefs && document.body.contains(svgDefs.ownerSVGElement)) {
    return svgDefs;
  }
  const svg = document.createElementNS(SVG_NS, "svg");
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

/**
 * Generates the red/blue displacement map via downscaled canvas with bilinear sampling.
 * Normalized to max 192px to eliminate multi-megabyte base64 overhead and GPU stalls.
 */
function makeMap(
  w: number,
  h: number,
  radius: number,
  border: number,
  mapBlur: number
): string {
  const safeW = Math.max(1, Math.round(w));
  const safeH = Math.max(1, Math.round(h));
  const aspect = safeW / safeH;

  let cw = safeW;
  let ch = safeH;
  if (safeW > MAX_DIM || safeH > MAX_DIM) {
    if (safeW >= safeH) {
      cw = MAX_DIM;
      ch = Math.max(16, Math.round(MAX_DIM / aspect));
    } else {
      ch = MAX_DIM;
      cw = Math.max(16, Math.round(MAX_DIM * aspect));
    }
  }

  const scaleFactor = cw / safeW;
  const scaledRadius = Math.max(2, Math.round(radius * scaleFactor));
  const scaledInset = Math.max(1, Math.round(border * Math.min(cw, ch)));
  const scaledBlur = Math.max(1, Math.round(mapBlur * scaleFactor));

  const cacheKey = `${cw}_${ch}_${scaledRadius}_${scaledInset}_${scaledBlur}`;
  const cached = mapCache.get(cacheKey);
  if (cached) return cached;

  const target = getSharedCanvas(cw, ch);
  if (!target || !target.ctx) return "";
  const ctx = target.ctx;

  // Red ramp: left to right encodes X displacement
  const gx = ctx.createLinearGradient(0, 0, cw, 0);
  gx.addColorStop(0, "rgb(0,0,0)");
  gx.addColorStop(1, "rgb(255,0,0)");
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, cw, ch);

  // Blue ramp: top to bottom encodes Y displacement
  const gy = ctx.createLinearGradient(0, 0, 0, ch);
  gy.addColorStop(0, "rgb(0,0,0)");
  gy.addColorStop(1, "rgb(0,0,255)");
  ctx.globalCompositeOperation = "difference";
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, cw, ch);

  // Neutralized interior: blurred 50% gray rounded rect
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = `blur(${scaledBlur}px)`;
  ctx.fillStyle = "rgba(128,128,128,0.93)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(
      scaledInset,
      scaledInset,
      Math.max(1, cw - scaledInset * 2),
      Math.max(1, ch - scaledInset * 2),
      Math.max(scaledRadius - scaledInset, 2)
    );
  } else {
    ctx.rect(scaledInset, scaledInset, Math.max(1, cw - scaledInset * 2), Math.max(1, ch - scaledInset * 2));
  }
  ctx.fill();
  ctx.filter = "none";

  const dataUri = target.canvas.toDataURL("image/png");

  if (mapCache.size >= MAX_CACHE_SIZE) {
    const firstKey = mapCache.keys().next().value;
    if (firstKey) mapCache.delete(firstKey);
  }
  mapCache.set(cacheKey, dataUri);

  return dataUri;
}

function buildFilter(id: string, scales: [number, number, number]) {
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

  const keepMatrices = [
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
    cm.setAttribute("values", keepMatrices[i]);
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

function resolveRadius(el: HTMLElement, w: number, h: number, override?: number | null): number {
  if (override != null) return override;
  const raw = getComputedStyle(el).borderTopLeftRadius || "0px";
  const v = parseFloat(raw) || 28;
  return raw.trim().endsWith("%") ? (v / 100) * Math.min(w, h) : v;
}

/**
 * Apply optical liquid glass to any HTML element.
 * Follows Apple materials architecture: hardware compositing isolation,
 * resolution-independent displacement maps, and layout thrashing prevention.
 */
export function liquidGlass(el: HTMLElement, opts?: LiquidGlassOptions): LiquidGlassInstance {
  const o = Object.assign(
    {
      scale: -90,
      chroma: 5,
      border: 0.06,
      mapBlur: 10,
      blur: 3,
      saturate: 1.6,
      radius: null,
      fallbackBlur: 18,
    },
    opts
  );

  const supported = isChromiumSupported();

  if (!supported) {
    const frosted = `blur(${o.fallbackBlur}px) saturate(${o.saturate})`;
    el.style.backdropFilter = frosted;
    (el.style as any).webkitBackdropFilter = frosted;
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
  const scales: [number, number, number] = [
    o.scale,
    o.scale + o.chroma,
    o.scale + 2 * o.chroma,
  ];
  const parts = buildFilter(id, scales);

  let lastW = 0;
  let lastH = 0;

  function refresh() {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h) return;
    if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;
    lastW = w;
    lastH = h;

    const radius = resolveRadius(el, w, h, o.radius);
    const mapUri = makeMap(w, h, radius, o.border, o.mapBlur);
    if (mapUri) {
      parts.feImage.setAttribute("href", mapUri);
      parts.feImage.setAttribute("width", String(w));
      parts.feImage.setAttribute("height", String(h));
    }
  }

  refresh();
  el.style.backdropFilter = `url(#${id}) blur(${o.blur}px) saturate(${o.saturate})`;

  let rafId: number | null = null;
  const ro = new ResizeObserver((entries) => {
    const entry = entries[0];
    if (!entry) return;
    const newW = Math.round(entry.contentRect.width);
    const newH = Math.round(entry.contentRect.height);
    if (Math.abs(newW - lastW) < 2 && Math.abs(newH - lastH) < 2) return;

    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(refresh);
  });
  ro.observe(el);

  return {
    supported: true,
    refresh,
    destroy: () => {
      ro.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
      parts.filter.remove();
      el.style.backdropFilter = "";
    },
  };
}

/**
 * React hook to attach Apple-style liquid glass optics and specular pointer glare.
 * Optimized with requestAnimationFrame batching, bounding box caching, and zero
 * layout thrashing during mouse movement.
 */
export function useLiquidGlass<T extends HTMLElement = HTMLDivElement>(
  opts?: LiquidGlassOptions,
  enableGlare: boolean = true
): RefObject<T> {
  const ref = useRef<T>(null);

  // Extract primitive parameters to prevent re-execution on inline object literals
  const scale = opts?.scale ?? -90;
  const chroma = opts?.chroma ?? 5;
  const border = opts?.border ?? 0.06;
  const mapBlur = opts?.mapBlur ?? 10;
  const blur = opts?.blur ?? 3;
  const saturate = opts?.saturate ?? 1.6;
  const radius = opts?.radius ?? null;
  const fallbackBlur = opts?.fallbackBlur ?? 18;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const instance = liquidGlass(el, {
      scale,
      chroma,
      border,
      mapBlur,
      blur,
      saturate,
      radius,
      fallbackBlur,
    });

    let rafId: number | null = null;
    let cachedRect: DOMRect | null = null;
    let lastClientX = 0;
    let lastClientY = 0;

    const updateGlare = () => {
      rafId = null;
      if (!cachedRect) {
        cachedRect = el.getBoundingClientRect();
      }
      if (cachedRect.width > 0 && cachedRect.height > 0) {
        const gx = Math.max(-5, Math.min(105, ((lastClientX - cachedRect.left) / cachedRect.width) * 100));
        const gy = Math.max(-5, Math.min(105, ((lastClientY - cachedRect.top) / cachedRect.height) * 100));
        el.style.setProperty("--gx", `${gx.toFixed(1)}%`);
        el.style.setProperty("--gy", `${gy.toFixed(1)}%`);
      }
    };

    const handlePointerEnter = () => {
      cachedRect = el.getBoundingClientRect();
      el.style.setProperty("--glare-opacity", "1");
    };

    const handlePointerLeave = () => {
      cachedRect = null;
      el.style.setProperty("--glare-opacity", "0");
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      if (rafId === null) {
        rafId = requestAnimationFrame(updateGlare);
      }
    };

    const handleInvalidateRect = () => {
      cachedRect = null;
    };

    if (enableGlare && instance.supported) {
      el.addEventListener("pointerenter", handlePointerEnter, { passive: true });
      el.addEventListener("pointerleave", handlePointerLeave, { passive: true });
      el.addEventListener("pointermove", handlePointerMove, { passive: true });
      window.addEventListener("scroll", handleInvalidateRect, { passive: true });
      window.addEventListener("resize", handleInvalidateRect, { passive: true });
    }

    return () => {
      instance.destroy();
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (enableGlare) {
        el.removeEventListener("pointerenter", handlePointerEnter);
        el.removeEventListener("pointerleave", handlePointerLeave);
        el.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("scroll", handleInvalidateRect);
        window.removeEventListener("resize", handleInvalidateRect);
      }
    };
  }, [
    scale,
    chroma,
    border,
    mapBlur,
    blur,
    saturate,
    radius,
    fallbackBlur,
    enableGlare,
  ]);

  return ref;
}
