"use client";

import { useEffect, useRef } from "react";
import { KIGALI, type Destination } from "@/lib/flight-destinations";

/**
 * A slowly turning globe with the routes from Kigali, and air traffic
 * crossing the rest of the world.
 *
 * Drawn on a canvas with an orthographic projection: land as a dot matrix
 * (Natural Earth, sampled into src/data/globe-land-dots.json), great-circle
 * arcs lifted off the surface, aircraft that point the way they fly and
 * leave a fading contrail, and flag-and-city labels for the region chosen on
 * the departures board. It animates only while on screen, holds still for
 * reduced motion, turns by drag, and a press on a city fills the search like
 * the board does. The board is the accessible way in; the globe is described
 * for screen readers and otherwise decorative.
 */

type Place = Destination & { lat: number; lon: number };
type Vec = [number, number, number];
type Point = { x: number; y: number; z: number };

const RAD = Math.PI / 180;
const GOLD = "252,203,26";
const MINT = "140,199,174";
const SPIN = 5; // degrees per second, about 70 seconds a turn
const REST_PITCH = 14;

/**
 * Long-haul traffic elsewhere in the world, for atmosphere only: busy city
 * pairs, flown by faint aircraft with no lines or labels.
 */
const WORLD_TRAFFIC: [number, number, number, number][] = [
  [51.47, -0.45, 40.64, -73.78], // London – New York
  [25.25, 55.36, 1.36, 103.99], // Dubai – Singapore
  [25.27, 51.61, -26.14, 28.25], // Doha – Johannesburg
  [41.26, 28.74, 6.58, 3.32], // Istanbul – Lagos
  [49.01, 2.55, -1.32, 36.93], // Paris – Nairobi
  [50.03, 8.57, 31.14, 121.81], // Frankfurt – Shanghai
  [52.31, 4.76, -23.43, -46.47], // Amsterdam – São Paulo
  [8.98, 38.8, 40.64, -73.78], // Addis Ababa – New York
  [-1.32, 36.93, 19.09, 72.87], // Nairobi – Mumbai
  [30.12, 31.41, 21.68, 39.16], // Cairo – Jeddah
  [33.94, -118.41, 35.77, 140.39], // Los Angeles – Tokyo
  [-33.95, 151.18, 1.36, 103.99], // Sydney – Singapore
  [25.25, 55.36, 51.47, -0.45], // Dubai – London
  [5.61, -0.17, 40.64, -73.78], // Accra – New York
  [22.31, 113.91, 37.62, -122.38], // Hong Kong – San Francisco
  [40.47, -3.56, 4.7, -74.14], // Madrid – Bogotá
  [-33.97, 18.6, 25.27, 51.61], // Cape Town – Doha
  [55.97, 37.41, 25.25, 55.36], // Moscow – Dubai
];

/** A top-down aircraft, nose up, about 20 units long. Built in the browser: Path2D does not exist on the server. */
const AIRCRAFT_PATH =
  "M0 -10 C1 -10 1.4 -8.5 1.4 -7 L1.4 -2.5 L9 2 L9 3.6 L1.4 1.4 L1.2 6.2 L3.6 8 L3.6 9.2 L0 8.3 L-3.6 9.2 L-3.6 8 L-1.2 6.2 L-1.4 1.4 L-9 3.6 L-9 2 L-1.4 -2.5 L-1.4 -7 C-1.4 -8.5 -1 -10 0 -10 Z";

const toVec = (lat: number, lon: number): Vec => [
  Math.cos(lat * RAD) * Math.sin(lon * RAD),
  Math.sin(lat * RAD),
  Math.cos(lat * RAD) * Math.cos(lon * RAD),
];

/** Points along the great circle, lifted into an arc by distance. */
function arcPoints(a: Vec, b: Vec, samples: number, lift: number): Vec[] {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const angle = Math.acos(dot);
  const height = lift * (0.12 + angle / Math.PI);
  const s = Math.sin(angle) || 1;
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples;
    const k1 = Math.sin((1 - t) * angle) / s;
    const k2 = Math.sin(t * angle) / s;
    const h = 1 + height * Math.sin(Math.PI * t);
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

/** Flags as images, loaded once and shared by every globe on the page. */
const flagCache = new Map<string, HTMLImageElement>();
function flag(country: string) {
  let image = flagCache.get(country);
  if (!image) {
    image = new Image();
    image.src = `/media/flags/${country.toLowerCase()}.svg`;
    flagCache.set(country, image);
  }
  return image;
}

export function FlightGlobe({
  places,
  highlight,
  focus,
  onPick,
  prices,
}: {
  places: Place[];
  /** Codes whose routes are lit and flown. */
  highlight: string[];
  /** A code to turn towards, e.g. the row under the pointer. */
  focus: string | null;
  onPick: (place: Place) => void;
  /** A fare to show beside a city's label, by code, e.g. { NBO: "US$215" }. */
  prices?: Record<string, string>;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const live = useRef({ highlight, focus, onPick, places, prices });
  useEffect(() => {
    live.current = { highlight, focus, onPick, places, prices };
  }, [highlight, focus, onPick, places, prices]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const font = getComputedStyle(el).fontFamily;
    const AIRCRAFT = new Path2D(AIRCRAFT_PATH);

    let land = new Float32Array(0);
    import("@/data/globe-land-dots.json").then(({ default: flat }) => {
      const out = new Float32Array((flat.length / 2) * 3);
      for (let i = 0; i < flat.length; i += 2) out.set(toVec(flat[i + 1] / 10, flat[i] / 10), (i / 2) * 3);
      land = out;
    });

    const hub = toVec(KIGALI.lat, KIGALI.lon);
    flag(KIGALI.country);
    const routes = new Map(live.current.places.map((p, i) => {
      flag(p.country);
      return [p.code, { place: p, ground: toVec(p.lat, p.lon), arc: arcPoints(hub, toVec(p.lat, p.lon), 64, 0.3), offset: (i * 0.37) % 1 }];
    }));
    const traffic = WORLD_TRAFFIC.map(([la1, lo1, la2, lo2], i) => {
      const arc = arcPoints(toVec(la1, lo1), toVec(la2, lo2), 120, 0.12);
      // Longer flights move a little slower, and half fly the other way.
      return { arc: i % 2 ? arc.reverse() : arc, period: 26 + (i % 5) * 4, offset: (i * 0.53) % 1 };
    });
    const graticule: Vec[][] = [
      ...Array.from({ length: 12 }, (_, m) => Array.from({ length: 37 }, (_, k) => toVec(-90 + k * 5, m * 30))),
      ...[-60, -30, 0, 30, 60].map((lat) => Array.from({ length: 73 }, (_, k) => toVec(lat, k * 5))),
    ];

    // The view: start over East Africa, a little north so Europe shows.
    const view = { yaw: -KIGALI.lon + 18, pitch: REST_PITCH };
    const drag = { on: false, x: 0, y: 0, moved: 0, resumeAt: 0 };
    let size = 0, dpr = 1, frame = 0, running = false, last = 0;
    let hits: { x: number; y: number; place: Place }[] = [];

    function project(v: Vec | Float32Array, i = 0): Point {
      const cy = Math.cos(view.yaw * RAD), sy = Math.sin(view.yaw * RAD);
      const cp = Math.cos(view.pitch * RAD), sp = Math.sin(view.pitch * RAD);
      const x0 = v[i] * cy + v[i + 2] * sy;
      const z0 = -v[i] * sy + v[i + 2] * cy;
      return { x: x0, y: v[i + 1] * cp - z0 * sp, z: v[i + 1] * sp + z0 * cp };
    }
    /** A smooth point part-way along an arc. */
    function along(arc: Vec[], u: number): Point {
      const f = Math.max(0, Math.min(1, u)) * (arc.length - 1);
      const i = Math.min(arc.length - 2, Math.floor(f)), k = f - i;
      const a = arc[i], b = arc[i + 1];
      return project([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]);
    }
    // In front of the globe from here, lifted or not?
    const seen = (p: Point) => p.z > 0 || p.x * p.x + p.y * p.y > 1;

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
      const X = (p: Point) => c + p.x * R, Y = (p: Point) => c - p.y * R;
      const t = now / 1000;

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
      for (const line of graticule) {
        let pen = false;
        for (const v of line) {
          const p = project(v);
          if (p.z <= 0) { pen = false; continue; }
          if (pen) ctx!.lineTo(X(p), Y(p)); else ctx!.moveTo(X(p), Y(p));
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
        bands[band].rect(X(p) - r / 2, Y(p) - r / 2, r, r);
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

      /** An aircraft at u along an arc, pointing the way it flies, with its contrail. */
      const fly = (arc: Vec[], u: number, scale: number, body: string, trail: string, trailLength: number) => {
        const p = along(arc, u);
        if (!seen(p)) return;
        const tail: Point[] = [];
        for (let k = 0; k <= 10; k++) tail.push(along(arc, u - (trailLength * k) / 10));
        for (let k = 1; k < tail.length; k++) {
          const a = tail[k - 1], b = tail[k];
          if (!seen(a) || !seen(b)) break;
          ctx!.beginPath();
          ctx!.moveTo(X(a), Y(a));
          ctx!.lineTo(X(b), Y(b));
          ctx!.strokeStyle = `rgba(${trail},${0.55 * (1 - k / tail.length)})`;
          ctx!.lineWidth = scale * 1.6 * dpr * (1 - k / (tail.length + 2));
          ctx!.stroke();
        }
        const ahead = along(arc, u + 0.004);
        const heading = Math.atan2(Y(ahead) - Y(p), X(ahead) - X(p)) + Math.PI / 2;
        const depth = 0.65 + 0.35 * Math.max(0, p.z);
        ctx!.save();
        ctx!.translate(X(p), Y(p));
        ctx!.rotate(heading);
        ctx!.scale(scale * depth * dpr * 0.62, scale * depth * dpr * 0.62);
        ctx!.fillStyle = body;
        ctx!.fill(AIRCRAFT);
        ctx!.restore();
      };

      // The rest of the world's traffic: faint, no lines, no labels.
      // On a small globe, half as many, so it stays calm.
      if (!reduced) traffic.forEach((flight, i) => {
        if (size < 480 && i % 2) return;
        fly(flight.arc, (t / flight.period + flight.offset) % 1, 0.8, "rgba(214,236,226,0.7)", MINT, 0.05);
      });

      // Routes from Kigali: hairlines for the rest, gold for the chosen region.
      for (const [code, route] of routes) {
        const on = lit.includes(code);
        const focused = aim === code;
        ctx!.beginPath();
        let pen = false;
        for (const v of route.arc) {
          const p = project(v);
          if (!seen(p)) { pen = false; continue; }
          if (pen) ctx!.lineTo(X(p), Y(p)); else ctx!.moveTo(X(p), Y(p));
          pen = true;
        }
        if (focused) {
          ctx!.strokeStyle = `rgba(${GOLD},0.22)`;
          ctx!.lineWidth = 6 * dpr;
          ctx!.stroke();
        }
        ctx!.strokeStyle = on || focused ? `rgba(${GOLD},${focused ? 1 : 0.7})` : `rgba(${MINT},0.16)`;
        ctx!.lineWidth = (focused ? 2.2 : on ? 1.3 : 0.8) * dpr;
        ctx!.stroke();
        if ((on || focused) && !reduced) fly(route.arc, (t / 6 + route.offset) % 1, 1, "#ffffff", GOLD, 0.09);
      }

      // Cities.
      hits = [];
      const pulse = reduced ? 0.5 : (t / 2.2) % 1;
      for (const [code, route] of routes) {
        const p = project(route.ground);
        if (p.z <= 0.05) continue;
        const on = lit.includes(code) || aim === code;
        if (on) {
          const phase = (pulse + route.offset) % 1;
          ctx!.beginPath();
          ctx!.arc(X(p), Y(p), (3 + 9 * phase) * dpr, 0, Math.PI * 2);
          ctx!.strokeStyle = `rgba(${GOLD},${0.6 * (1 - phase)})`;
          ctx!.lineWidth = dpr;
          ctx!.stroke();
        }
        ctx!.beginPath();
        ctx!.arc(X(p), Y(p), (on ? 3.2 : 2.2) * dpr, 0, Math.PI * 2);
        ctx!.fillStyle = on ? `rgba(${GOLD},1)` : `rgba(${MINT},${0.4 + 0.5 * p.z})`;
        ctx!.fill();
        hits.push({ x: X(p) / dpr, y: Y(p) / dpr, place: route.place });
      }

      // Labels: a flag and the city, placed where they do not collide.
      const boxes: [number, number, number, number][] = [];
      const label = (text: string, country: string, x: number, y: number, strong: boolean, price?: string) => {
        ctx!.font = `700 ${12.5 * dpr}px ${font}`;
        const pad = 6 * dpr, h = 24 * dpr, fw = 16 * dpr, fh = 12 * dpr;
        const priceW = price ? ctx!.measureText(price).width + 7 * dpr : 0;
        const wBox = pad + fw + 6 * dpr + ctx!.measureText(text).width + priceW + pad * 1.6, gap = 9 * dpr;
        // Right of the dot, then left, above and below: the first spot that is free.
        const spots: [number, number][] = [
          [x + gap, y - h / 2], [x - gap - wBox, y - h / 2], [x - wBox / 2, y - gap - h], [x - wBox / 2, y + gap],
          [x + gap, y - h - gap / 2], [x + gap, y + gap / 2],
        ];
        const free = spots.find(([bx, by]) => bx >= 2 && by >= 2 && bx + wBox <= S - 2 && by + h <= S - 2 && !boxes.some(
          ([x1, y1, w1, h1]) => bx < x1 + w1 + 3 * dpr && bx + wBox + 3 * dpr > x1 && by < y1 + h1 + 3 * dpr && by + h + 3 * dpr > y1));
        if (!free) return;
        const [bx, by] = free;
        boxes.push([bx, by, wBox, h]);
        ctx!.beginPath();
        ctx!.roundRect(bx, by, wBox, h, h / 2);
        ctx!.fillStyle = strong ? "rgba(252,203,26,0.97)" : "rgba(6,26,19,0.86)";
        ctx!.fill();
        ctx!.strokeStyle = strong ? `rgba(${GOLD},1)` : "rgba(140,199,174,0.32)";
        ctx!.lineWidth = dpr;
        ctx!.stroke();
        const image = flag(country);
        const fx = bx + pad + 1 * dpr, fy = by + (h - fh) / 2;
        if (image.complete && image.naturalWidth) {
          ctx!.save();
          ctx!.beginPath();
          ctx!.roundRect(fx, fy, fw, fh, 2.5 * dpr);
          ctx!.clip();
          ctx!.drawImage(image, fx, fy, fw, fh);
          ctx!.restore();
          ctx!.beginPath();
          ctx!.roundRect(fx, fy, fw, fh, 2.5 * dpr);
          ctx!.strokeStyle = "rgba(0,0,0,0.18)";
          ctx!.stroke();
        }
        ctx!.textBaseline = "middle";
        ctx!.fillStyle = strong ? "#0f3a2c" : "#ffffff";
        ctx!.fillText(text, fx + fw + 6 * dpr, by + h / 2 + dpr * 0.5);
        if (price) {
          ctx!.fillStyle = `rgb(${GOLD})`;
          ctx!.fillText(price, fx + fw + 6 * dpr + ctx!.measureText(text).width + 7 * dpr, by + h / 2 + dpr * 0.5);
        }
      };

      // Kigali first: it is the one label that must always show.
      const hubP = project(hub);
      const labelled = [...routes.values()]
        .filter(({ place }) => place.code === aim || lit.includes(place.code))
        .sort((a, b) => (a.place.code === aim ? -1 : b.place.code === aim ? 1 : 0));
      if (hubP.z > 0) {
        const x = X(hubP), y = Y(hubP);
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
        boxes.push([x - 6 * dpr, y - 6 * dpr, 12 * dpr, 12 * dpr]);
        label(KIGALI.city, KIGALI.country, x, y, true);
      }
      // Then reserve every lit city, so no label covers a dot.
      for (const { ground } of labelled) {
        const p = project(ground);
        if (p.z > 0) boxes.push([X(p) - 6 * dpr, Y(p) - 6 * dpr, 12 * dpr, 12 * dpr]);
      }
      for (const { place, ground } of labelled) {
        const p = project(ground);
        if (p.z > 0.22) label(place.city, place.country, X(p), Y(p), false, live.current.prices?.[place.code]);
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
