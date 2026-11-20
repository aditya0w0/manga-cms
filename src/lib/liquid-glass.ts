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

// Chromium supports SVG filters via backdrop-filter; Safari and Firefox fallback
const isChromiumSupported = (): boolean => {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const ua = navigator.userAgent;
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
  const isFirefox = /Firefox/.test(ua);
  if (isSafari || isFirefox) return false;
  if (!CSS.supports("backdrop-filter", "url(#lg)")) return false;
  try {
    const c = document.createElement("canvas");
    c.width = c.height = 4;
    c.getContext("2d")?.getImageData(0, 0, 1, 1);
    return true;
  } catch {
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

// Generates the red/blue displacement map via canvas data URL
function makeMap(
  w: number,
  h: number,
  radius: number,
  border: number,
  mapBlur: number
): string {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Red ramp: left to right encodes X displacement
  const gx = ctx.createLinearGradient(0, 0, w, 0);
  gx.addColorStop(0, "rgb(0,0,0)");
  gx.addColorStop(1, "rgb(255,0,0)");
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, w, h);

  // Blue ramp: top to bottom encodes Y displacement
  const gy = ctx.createLinearGradient(0, 0, 0, h);
  gy.addColorStop(0, "rgb(0,0,0)");
  gy.addColorStop(1, "rgb(0,0,255)");
  ctx.globalCompositeOperation = "difference";
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, w, h);

  // Neutralized interior: blurred 50% gray rounded rect
  ctx.globalCompositeOperation = "source-over";
  const inset = border * Math.min(w, h);
  ctx.filter = `blur(${mapBlur}px)`;
  ctx.fillStyle = "rgba(128,128,128,0.93)";
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(
      inset,
      inset,
      Math.max(1, w - inset * 2),
      Math.max(1, h - inset * 2),
      Math.max(radius - inset, 2)
    );
  } else {
    ctx.rect(inset, inset, Math.max(1, w - inset * 2), Math.max(1, h - inset * 2));
  }
  ctx.fill();
  ctx.filter = "none";
  return canvas.toDataURL();
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
 * Based on deepika-builds/liquid-glass specification.
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

  function refresh() {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!w || !h) return;
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

/**
 * React hook to attach Apple-style liquid glass optics and specular pointer glare.
 */
export function useLiquidGlass<T extends HTMLElement = HTMLDivElement>(
  opts?: LiquidGlassOptions,
  enableGlare: boolean = true
): RefObject<T> {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const instance = liquidGlass(el, opts);

    let handlePointerMove: ((e: PointerEvent) => void) | null = null;
    if (enableGlare) {
      handlePointerMove = (e: PointerEvent) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const gx = ((e.clientX - rect.left) / rect.width) * 100;
          const gy = ((e.clientY - rect.top) / rect.height) * 100;
          el.style.setProperty("--gx", `${gx.toFixed(1)}%`);
          el.style.setProperty("--gy", `${gy.toFixed(1)}%`);
        }
      };
      el.addEventListener("pointermove", handlePointerMove);
    }

    return () => {
      instance.destroy();
      if (handlePointerMove) {
        el.removeEventListener("pointermove", handlePointerMove);
      }
    };
  }, [opts, enableGlare]);

  return ref;
}
