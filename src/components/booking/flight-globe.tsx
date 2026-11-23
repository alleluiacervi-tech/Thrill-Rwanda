"use client";

import { useEffect, useRef } from "react";
import { KIGALI, type Destination } from "@/lib/flight-destinations";

/**
 * A slowly turning globe with the routes from Kigali.
 *
 * Drawn on a canvas with an orthographic projection: land as a dot matrix
 * (Natural Earth, sampled into src/data/globe-land-dots.json), great-circle
 * arcs lifted off the surface, and planes moving along the routes of the
 * region chosen on the departures board. It animates only while on screen,
 * holds still for reduced motion, turns by drag, and a press on a city fills
 * the search like the board does. The board is the accessible way in; the
 * globe is described for screen readers and otherwise decorative.
 */

type Place = Destination & { lat: number; lon: number };
type Vec = [number, number, number];

const RAD = Math.PI / 180;
const GOLD = "252,203,26";
const MINT = "140,199,174";
const SPIN = 5; // degrees per second, about 70 seconds a turn
const REST_PITCH = 14;

const toVec = (lat: number, lon: number): Vec => [
  Math.cos(lat * RAD) * Math.sin(lon * RAD),
  Math.sin(lat * RAD),
  Math.cos(lat * RAD) * Math.cos(lon * RAD),
];

/** Points along the great circle, lifted into an arc by distance. */
function arcPoints(a: Vec, b: Vec, samples = 56): Vec[] {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const angle = Math.acos(dot);
  const lift = 0.04 + 0.34 * (angle / Math.PI);
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples;
    const s = Math.sin(angle) || 1;
    const k1 = Math.sin((1 - t) * angle) / s;
    const k2 = Math.sin(t * angle) / s;
    const h = 1 + lift * Math.sin(Math.PI * t);
    return [(a[0] * k1 + b[0] * k2) * h, (a[1] * k1 + b[1] * k2) * h, (a[2] * k1 + b[2] * k2) * h];
  });
}

/** The point halfway along a route, as the view to turn towards. */
function midpoint(a: Vec, b: Vec) {
  const m: Vec = [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const n = Math.hypot(...m) || 1;
  return { lat: Math.asin(m[1] / n) / RAD, lon: Math.atan2(m[0], m[2]) / RAD };
}

const shortest = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

export function FlightGlobe({
  places,
  highlight,
  focus,
  onPick,
}: {
  places: Place[];
  /** Codes whose routes are lit and flown. */
  highlight: string[];
  /** A code to turn towards, e.g. the row under the pointer. */
  focus: string | null;
  onPick: (place: Place) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ highlight, focus, onPick, places });
  useEffect(() => {
    live.current = { highlight, focus, onPick, places };
  }, [highlight, focus, onPick, places]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const font = getComputedStyle(el).fontFamily;

    let land = new Float32Array(0);
    import("@/data/globe-land-dots.json").then(({ default: flat }) => {
      const out = new Float32Array((flat.length / 2) * 3);
      for (let i = 0; i < flat.length; i += 2) out.set(toVec(flat[i + 1] / 10, flat[i] / 10), (i / 2) * 3);
      land = out;
    });

    const hub = toVec(KIGALI.lat, KIGALI.lon);
    const graticule: Vec[][] = [
      ...Array.from({ length: 12 }, (_, m) => Array.from({ length: 37 }, (_, k) => toVec(-90 + k * 5, m * 30))),
      ...[-60, -30, 0, 30, 60].map((lat) => Array.from({ length: 73 }, (_, k) => toVec(lat, k * 5))),
    ];
    const routes = new Map(live.current.places.map((p, i) => [p.code, { place: p, ground: toVec(p.lat, p.lon), arc: arcPoints(hub, toVec(p.lat, p.lon)), offset: (i * 0.37) % 1 }]));

    // The view: start over East Africa, a little north so Europe shows.
    const view = { yaw: -KIGALI.lon + 18, pitch: REST_PITCH };
    const drag = { on: false, x: 0, y: 0, moved: 0, resumeAt: 0 };
    let size = 0, dpr = 1, frame = 0, running = false, last = 0;
    let hits: { x: number; y: number; place: Place }[] = [];

    function project(v: Vec | Float32Array, i = 0) {
      const cy = Math.cos(view.yaw * RAD), sy = Math.sin(view.yaw * RAD);
      const cp = Math.cos(view.pitch * RAD), sp = Math.sin(view.pitch * RAD);
      const x0 = v[i] * cy + v[i + 2] * sy;
      const z0 = -v[i] * sy + v[i + 2] * cy;
      const y = v[i + 1] * cp - z0 * sp;
      const z = v[i + 1] * sp + z0 * cp;
      return { x: x0, y, z };
    }

    function draw(now: number) {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const w = el!.clientWidth;
      if (w !== size || window.devicePixelRatio !== dpr) {
        size = w;
        dpr = Math.min(2, window.devicePixelRatio || 1);
        el!.width = el!.height = Math.round(size * dpr);
      }
      const { highlight: lit, focus: aim } = live.current;
      const S = size * dpr, c = S / 2, R = S * 0.4;

      // Turn: towards a focused route, else a slow spin.
      const target = aim && routes.get(aim);
      if (target && !drag.on) {
        const mid = midpoint(hub, target.ground);
        view.yaw += shortest(view.yaw, -mid.lon) * Math.min(1, dt * 3);
        view.pitch += (Math.max(-20, Math.min(40, mid.lat)) - view.pitch) * Math.min(1, dt * 3);
      } else if (!drag.on && !reduced && now > drag.resumeAt) {
        view.yaw += SPIN * dt;
        view.pitch += (REST_PITCH - view.pitch) * Math.min(1, dt * 0.8);
      }

      ctx!.clearRect(0, 0, S, S);

      // Atmosphere, then the sphere itself, lit from the upper left.
      const halo = ctx!.createRadialGradient(c, c, R * 0.92, c, c, R * 1.24);
      halo.addColorStop(0, "rgba(87,168,136,0.32)");
      halo.addColorStop(0.35, "rgba(87,168,136,0.12)");
      halo.addColorStop(1, "rgba(87,168,136,0)");
      ctx!.fillStyle = halo;
      ctx!.fillRect(0, 0, S, S);
      const sea = ctx!.createRadialGradient(c - R * 0.35, c - R * 0.45, R * 0.1, c, c, R);
      sea.addColorStop(0, "#164a37");
      sea.addColorStop(0.55, "#0d3326");
      sea.addColorStop(1, "#071c15");
      ctx!.beginPath();
      ctx!.arc(c, c, R, 0, Math.PI * 2);
      ctx!.fillStyle = sea;
      ctx!.fill();

      // Graticule every 30 degrees, faint, so the ocean still reads as a sphere.
      ctx!.beginPath();
      for (const v of graticule) {
        let pen = false;
        for (const point of v) {
          const p = project(point);
          if (p.z <= 0) { pen = false; continue; }
          const x = c + p.x * R, y = c - p.y * R;
          if (pen) ctx!.lineTo(x, y); else ctx!.moveTo(x, y);
          pen = true;
        }
      }
      ctx!.strokeStyle = "rgba(140,199,174,0.09)";
      ctx!.lineWidth = dpr;
      ctx!.stroke();

      // Land dots, in four depth bands so the far side fades into the limb.
      const bands = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      const dot = Math.max(1.4, S / 430);
      for (let i = 0; i < land.length; i += 3) {
        const p = project(land, i);
        if (p.z <= 0.02) continue;
        const band = p.z > 0.75 ? 3 : p.z > 0.5 ? 2 : p.z > 0.25 ? 1 : 0;
        const r = dot * (0.55 + 0.45 * p.z);
        bands[band].rect(c + p.x * R - r / 2, c - p.y * R - r / 2, r, r);
      }
      [0.3, 0.52, 0.75, 0.98].forEach((alpha, i) => {
        ctx!.fillStyle = `rgba(${MINT},${alpha})`;
        ctx!.fill(bands[i]);
      });

      // Limb: a darker edge and a thin rim of light.
      const limb = ctx!.createRadialGradient(c, c, R * 0.72, c, c, R);
      limb.addColorStop(0, "rgba(3,12,9,0)");
      limb.addColorStop(1, "rgba(3,12,9,0.45)");
      ctx!.beginPath();
      ctx!.arc(c, c, R, 0, Math.PI * 2);
      ctx!.fillStyle = limb;
      ctx!.fill();
      ctx!.strokeStyle = "rgba(140,199,174,0.35)";
      ctx!.lineWidth = dpr;
      ctx!.stroke();

      // Is a point, lifted or not, in front of the globe from here?
      const seen = (p: { x: number; y: number; z: number }) => p.z > 0 || p.x * p.x + p.y * p.y > 1;

      // Routes: dim for the rest of the world, gold for the chosen region.
      const t = now / 1000;
      for (const [code, route] of routes) {
        const on = lit.includes(code);
        const focused = aim === code;
        const pts = route.arc.map((v) => project(v));
        ctx!.beginPath();
        let pen = false;
        for (const p of pts) {
          if (!seen(p)) { pen = false; continue; }
          const x = c + p.x * R, y = c - p.y * R;
          if (pen) ctx!.lineTo(x, y); else ctx!.moveTo(x, y);
          pen = true;
        }
        if (focused) {
          ctx!.strokeStyle = `rgba(${GOLD},0.25)`;
          ctx!.lineWidth = 6 * dpr;
          ctx!.stroke();
        }
        ctx!.strokeStyle = on || focused ? `rgba(${GOLD},${focused ? 1 : 0.75})` : `rgba(${MINT},0.22)`;
        ctx!.lineWidth = (focused ? 2.2 : on ? 1.4 : 0.9) * dpr;
        ctx!.stroke();

        // A plane along each lit route, with a fading trail.
        if ((on || focused) && !reduced) {
          const head = (t / 4.8 + route.offset) % 1;
          const n = pts.length - 1;
          for (let k = 0; k < 14; k++) {
            const u = head - k * 0.012;
            if (u < 0) break;
            const p = pts[Math.round(u * n)];
            if (!seen(p)) continue;
            ctx!.beginPath();
            ctx!.arc(c + p.x * R, c - p.y * R, (k === 0 ? 2.6 : 1.8 * (1 - k / 14)) * dpr, 0, Math.PI * 2);
            ctx!.fillStyle = k === 0 ? "rgba(255,255,255,1)" : `rgba(${GOLD},${0.7 * (1 - k / 14)})`;
            ctx!.fill();
          }
        }
      }

      // Cities, then labels that do not collide.
      hits = [];
      const boxes: [number, number, number, number][] = [];
      const label = (text: string, code: string, x: number, y: number, strong: boolean) => {
        ctx!.font = `700 ${12 * dpr}px ${font}`;
        const tw = ctx!.measureText(text).width;
        ctx!.font = `800 ${10 * dpr}px ${font}`;
        const cw = ctx!.measureText(code).width;
        const pad = 7 * dpr, h = 22 * dpr, wBox = tw + cw + pad * 3, gap = 9 * dpr;
        // Right of the dot, then left, above and below: the first spot that is free.
        const spots: [number, number][] = [
          [x + gap, y - h / 2], [x - gap - wBox, y - h / 2], [x - wBox / 2, y - gap - h], [x - wBox / 2, y + gap],
          [x + gap, y - h - gap / 2], [x + gap, y + gap / 2],
        ];
        const free = spots.find(([bx, by]) => bx >= 2 && by >= 2 && bx + wBox <= S - 2 && by + h <= S - 2 && !boxes.some(([x1, y1, w1, h1]) => bx < x1 + w1 + 3 * dpr && bx + wBox + 3 * dpr > x1 && by < y1 + h1 + 3 * dpr && by + h + 3 * dpr > y1));
        if (!free) return;
        const [bx, by] = free;
        y = by + h / 2;
        boxes.push([bx, by, wBox, h]);
        ctx!.beginPath();
        ctx!.roundRect(bx, by, wBox, h, h / 2);
        ctx!.fillStyle = strong ? "rgba(252,203,26,0.96)" : "rgba(6,26,19,0.82)";
        ctx!.fill();
        ctx!.strokeStyle = strong ? "rgba(252,203,26,1)" : "rgba(140,199,174,0.35)";
        ctx!.lineWidth = dpr;
        ctx!.stroke();
        ctx!.textBaseline = "middle";
        ctx!.font = `700 ${12 * dpr}px ${font}`;
        ctx!.fillStyle = strong ? "#0f3a2c" : "#ffffff";
        ctx!.fillText(text, bx + pad, y + dpr);
        ctx!.font = `800 ${10 * dpr}px ${font}`;
        ctx!.fillStyle = strong ? "rgba(15,58,44,0.75)" : `rgba(${GOLD},1)`;
        ctx!.fillText(code, bx + pad * 2 + tw, y + dpr);
      };

      const hubP = project(hub);
      const pulse = reduced ? 0.5 : (t / 2.2) % 1;
      for (const [code, route] of routes) {
        const p = project(route.ground);
        if (p.z <= 0.05) continue;
        const on = lit.includes(code) || aim === code;
        const x = c + p.x * R, y = c - p.y * R;
        if (on) {
          ctx!.beginPath();
          ctx!.arc(x, y, (3 + 9 * ((pulse + route.offset) % 1)) * dpr, 0, Math.PI * 2);
          ctx!.strokeStyle = `rgba(${GOLD},${0.6 * (1 - ((pulse + route.offset) % 1))})`;
          ctx!.lineWidth = dpr;
          ctx!.stroke();
        }
        ctx!.beginPath();
        ctx!.arc(x, y, (on ? 3.2 : 2.2) * dpr, 0, Math.PI * 2);
        ctx!.fillStyle = on ? `rgba(${GOLD},1)` : `rgba(${MINT},${0.4 + 0.5 * p.z})`;
        ctx!.fill();
        hits.push({ x: x / dpr, y: y / dpr, place: route.place });
      }

      const labelled = [...routes.values()]
        .filter(({ place }) => place.code === aim || lit.includes(place.code))
        .sort((a, b) => (a.place.code === aim ? -1 : b.place.code === aim ? 1 : 0));
      // Kigali last, so it sits above everything.
      if (hubP.z > 0) {
        const x = c + hubP.x * R, y = c - hubP.y * R;
        for (const phase of [pulse, (pulse + 0.5) % 1]) {
          ctx!.beginPath();
          ctx!.arc(x, y, (5 + 16 * phase) * dpr, 0, Math.PI * 2);
          ctx!.strokeStyle = `rgba(${GOLD},${0.7 * (1 - phase)})`;
          ctx!.lineWidth = 1.5 * dpr;
          ctx!.stroke();
        }
        ctx!.beginPath();
        ctx!.arc(x, y, 5 * dpr, 0, Math.PI * 2);
        ctx!.fillStyle = "#fff";
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(x, y, 3 * dpr, 0, Math.PI * 2);
        ctx!.fillStyle = `rgb(${GOLD})`;
        ctx!.fill();
        // Kigali's label goes first: it is the one that must always show.
        boxes.push([x - 6 * dpr, y - 6 * dpr, 12 * dpr, 12 * dpr]);
        label(KIGALI.city, KIGALI.code, x, y, true);
      }
      // Then reserve every lit city, so no label covers a dot.
      for (const v of labelled.map((r) => r.ground)) {
        const p = project(v);
        if (p.z > 0) boxes.push([c + p.x * R - 6 * dpr, c - p.y * R - 6 * dpr, 12 * dpr, 12 * dpr]);
      }

      for (const { place, ground } of labelled) {
        const p = project(ground);
        if (p.z > 0.22) label(place.city, place.code, c + p.x * R, c - p.y * R, false);
      }

      if (running) frame = requestAnimationFrame(draw);
    }

    function start() {
      if (running) return;
      running = true;
      last = 0;
      frame = requestAnimationFrame(draw);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(frame);
    }
    // Only animate while the globe is on screen and the tab is visible.
    const seenObserver = new IntersectionObserver(([entry]) => (entry.isIntersecting && !document.hidden ? start() : stop()));
    seenObserver.observe(el);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    const nearest = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      const x = event.clientX - box.left, y = event.clientY - box.top;
      let best: Place | null = null, bestD = 18;
      for (const h of hits) {
        const d = Math.hypot(h.x - x, h.y - y);
        if (d < bestD) { bestD = d; best = h.place; }
      }
      return best;
    };
    const down = (event: PointerEvent) => {
      drag.on = true; drag.x = event.clientX; drag.y = event.clientY; drag.moved = 0;
      el.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!drag.on) { el.style.cursor = nearest(event) ? "pointer" : "grab"; return; }
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      drag.x = event.clientX; drag.y = event.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      view.yaw += dx * 0.35;
      view.pitch = Math.max(-35, Math.min(50, view.pitch + dy * 0.25));
      if (reduced) requestAnimationFrame(draw);
    };
    const up = (event: PointerEvent) => {
      if (!drag.on) return;
      drag.on = false;
      drag.resumeAt = performance.now() + 2500;
      if (drag.moved < 6) {
        const place = nearest(event);
        if (place) live.current.onPick(place);
      }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);

    return () => {
      stop();
      seenObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={`Globe of flight routes from Kigali to ${places.map((p) => p.city).join(", ")}.`}
      className="block aspect-square w-full touch-pan-y select-none"
      style={{ cursor: "grab" }}
    />
  );
}
