import { clipPolygons } from "./clipPolygons";
import type { LineCoordinates, PolygonCoordinates } from "../api";
import type { AnnotationDraft } from "../projects/annotationDrafts";
import { lineLengthM, polygonAreaM2 } from "./geometry";

export type BrushTool = "paint" | "erase";
type Point = [number, number];
const EPSILON = 1e-7;
const CIRCLE_STEPS = 20;

function distance(a: Point, b: Point) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
function interpolate(a: Point, b: Point, t: number): Point { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }

export function sampleBrushPath(points: LineCoordinates, radius: number): LineCoordinates {
  const sampled: LineCoordinates = [];
  for (const point of points) {
    if (!point.every(Number.isFinite)) throw new Error("The brush path contains an invalid coordinate.");
    if (!sampled.length || distance(sampled[sampled.length - 1], point) >= radius * 0.2) sampled.push(point);
  }
  const last = points.at(-1);
  if (last && sampled.length && distance(last, sampled[sampled.length - 1]) > EPSILON) sampled.push(last);
  if (sampled.length > 512) throw new Error("That stroke is too long. Try several shorter strokes.");
  return sampled;
}

export function brushFootprint(points: LineCoordinates, radius: number): PolygonCoordinates[] {
  if (!Number.isFinite(radius) || radius <= 0) throw new Error("Choose a positive brush size.");
  if (!points.length) return [];
  const shapes: PolygonCoordinates[] = points.map(([x, y]) => {
    const circle: LineCoordinates = Array.from({ length: CIRCLE_STEPS }, (_, index) => {
      const angle = index * Math.PI * 2 / CIRCLE_STEPS;
      return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
    });
    return [[...circle, circle[0]]];
  });
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = distance(a, b);
    if (length < EPSILON) continue;
    const dx = -(b[1] - a[1]) * radius / length, dy = (b[0] - a[0]) * radius / length;
    const rectangle: LineCoordinates = [[a[0] + dx, a[1] + dy], [b[0] + dx, b[1] + dy],
      [b[0] - dx, b[1] - dy], [a[0] - dx, a[1] - dy], [a[0] + dx, a[1] + dy]];
    shapes.push([rectangle]);
  }
  return clipPolygons("union", shapes);
}

function insideRing(point: Point, ring: LineCoordinates): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function insideFootprint(point: Point, footprint: PolygonCoordinates[]): boolean {
  return footprint.some(([outer, ...holes]) => insideRing(point, outer) && !holes.some((hole) => insideRing(point, hole)));
}

function crossingParameters(a: Point, b: Point, c: Point, d: Point): number[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], ex = d[0] - c[0], ey = d[1] - c[1];
  const denominator = dx * ey - dy * ex;
  if (Math.abs(denominator) < EPSILON) {
    if (Math.abs((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) > EPSILON) return [];
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < EPSILON ** 2) return [];
    return [c, d].map((p) => ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared)
      .filter((t) => t > 0 && t < 1);
  }
  const t = ((c[0] - a[0]) * ey - (c[1] - a[1]) * ex) / denominator;
  const u = ((c[0] - a[0]) * dy - (c[1] - a[1]) * dx) / denominator;
  return t > 0 && t < 1 && u >= 0 && u <= 1 ? [t] : [];
}

function onBoundary(point: Point, polygons: PolygonCoordinates[]): boolean {
  return polygons.some((polygon) => polygon.some((ring) => ring.some((b, index) => {
    if (!index) return false;
    const a = ring[index - 1], length = distance(a, b);
    if (length < EPSILON) return distance(point, a) < EPSILON;
    return Math.abs((point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0])) / length < EPSILON
      && (point[0] - a[0]) * (point[0] - b[0]) + (point[1] - a[1]) * (point[1] - b[1]) <= EPSILON ** 2;
  })));
}

function clipRoadLine(line: LineCoordinates, footprint: PolygonCoordinates[], keepInside: boolean): LineCoordinates[] {
  const fragments: LineCoordinates[] = [];
  let current: LineCoordinates = [];
  const flush = () => {
    if (current.length >= 2 && lineLengthM(current) > EPSILON) fragments.push(current);
    current = [];
  };
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i];
    if (distance(a, b) < EPSILON) continue;
    const cuts = [0, 1];
    for (const polygon of footprint) for (const ring of polygon) {
      for (let j = 1; j < ring.length; j++) cuts.push(...crossingParameters(a, b, ring[j - 1], ring[j]));
    }
    const sorted = [...new Set(cuts)].sort((x, y) => x - y);
    for (let j = 1; j < sorted.length; j++) {
      const from = interpolate(a, b, sorted[j - 1]), to = interpolate(a, b, sorted[j]);
      if (distance(from, to) < EPSILON) continue;
      const midpoint = interpolate(from, to, 0.5);
      const inside = insideFootprint(midpoint, footprint) || (keepInside && onBoundary(midpoint, footprint));
      if (inside !== keepInside) { flush(); continue; }
      if (current.length && distance(current[current.length - 1], from) > EPSILON) flush();
      if (!current.length) current.push(from);
      current.push(to);
    }
  }
  flush();
  return fragments;
}

export function eraseRoadLine(line: LineCoordinates, footprint: PolygonCoordinates[]): LineCoordinates[] {
  return clipRoadLine(line, footprint, false);
}

export function applyBrushStroke(draft: AnnotationDraft, points: LineCoordinates, diameterM: number, tool: BrushTool, perimeter?: PolygonCoordinates[]): AnnotationDraft {
  const radius = diameterM / 2;
  if (!Number.isFinite(radius) || radius <= 0) throw new Error("Choose a positive brush size.");
  const path = sampleBrushPath(points, radius);
  if (!path.length) return draft;
  let next: AnnotationDraft;
  if (draft.geometryType === "road" && tool === "paint") {
    if (path.length < 2 || lineLengthM(path) < EPSILON) return draft;
    next = { ...draft, bounds: [...draft.bounds, [path]], roadWidths: [...draft.bounds.map((_, index) => draft.roadWidths?.[index] ?? null), diameterM] };
  } else {
    const footprint = brushFootprint(path, radius);
    if (draft.geometryType === "road") {
      const bounds: PolygonCoordinates[] = [], roadWidths: (number | null)[] = [];
      draft.bounds.forEach(([line], index) => {
        for (const fragment of eraseRoadLine(line, footprint)) {
          bounds.push([fragment]);
          roadWidths.push(draft.roadWidths?.[index] ?? null);
        }
      });
      next = { ...draft, bounds, roadWidths };
    } else {
      const bounds = tool === "paint" ? clipPolygons("union", draft.bounds, footprint)
        : draft.bounds.length ? clipPolygons("difference", draft.bounds, footprint) : [];
      next = { ...draft, bounds: bounds.filter((polygon) => polygonAreaM2(polygon) > EPSILON) };
    }
  }
  if (perimeter) {
    if (next.geometryType === "road") {
      const bounds: PolygonCoordinates[] = [], roadWidths: (number | null)[] = [];
      next.bounds.forEach(([line], index) => {
        for (const fragment of clipRoadLine(line, perimeter, true)) {
          bounds.push([fragment]);
          roadWidths.push(next.roadWidths?.[index] ?? null);
        }
      });
      next = { ...next, bounds, roadWidths };
    } else {
      next = { ...next, bounds: clipPolygons("intersection", next.bounds, perimeter).filter((polygon) => polygonAreaM2(polygon) > EPSILON) };
    }
  }
  if (next.bounds.length > 10000 || next.bounds.reduce((sum, polygon) => sum + polygon.reduce((count, ring) => count + ring.length, 0), 0) > 100000) {
    throw new Error("This result is too detailed to save. Use fewer or broader strokes.");
  }
  return next;
}
