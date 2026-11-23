import * as L from "leaflet";
import { CRS_2180 } from "./projections";

const SCALE_AT_CENTRAL_MERIDIAN = 0.9993;
const FALSE_EASTING = 500_000;
const EARTH_RADIUS_M = 6_381_000;

export function toPlanar(point: L.LatLng): L.Point {
  return CRS_2180.project(point);
}

export function toLatLng(point: L.Point): L.LatLng {
  return CRS_2180.unproject(point);
}

function gridScale(point: L.Point) {
  const offset = point.x - FALSE_EASTING;
  return SCALE_AT_CENTRAL_MERIDIAN * (1 + (offset * offset) / (2 * EARTH_RADIUS_M * EARTH_RADIUS_M));
}

export function groundDistance(a: L.Point, b: L.Point) {
  return a.distanceTo(b) / gridScale(L.point((a.x + b.x) / 2, (a.y + b.y) / 2));
}

export function groundPerimeter(ring: L.Point[]) {
  return ring.reduce((sum, point, index) => sum + groundDistance(point, ring[(index + 1) % ring.length]), 0);
}

export function groundArea(ring: L.Point[]) {
  if (ring.length < 3) return 0;
  let doubled = 0;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    doubled += a.x * b.y - b.x * a.y;
  }
  return Math.abs(doubled) / 2 / gridScale(centroid(ring)) ** 2;
}

export function centroid(ring: L.Point[]) {
  const open = openRing(ring);
  let doubled = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < open.length; index++) {
    const a = open[index];
    const b = open[(index + 1) % open.length];
    const cross = a.x * b.y - b.x * a.y;
    doubled += cross;
    x += (a.x + b.x) * cross;
    y += (a.y + b.y) * cross;
  }
  if (Math.abs(doubled) < 1e-9) {
    return L.point(open.reduce((sum, p) => sum + p.x, 0) / open.length, open.reduce((sum, p) => sum + p.y, 0) / open.length);
  }
  return L.point(x / (3 * doubled), y / (3 * doubled));
}

export function openRing(ring: L.Point[]) {
  return ring.length > 1 && ring[0].equals(ring[ring.length - 1]) ? ring.slice(0, -1) : ring;
}

export function sides(ring: L.Point[]): [L.Point, L.Point][] {
  const open = openRing(ring);
  return open.map((point, index) => [point, open[(index + 1) % open.length]]);
}

export function closestOnSegment(point: L.Point, a: L.Point, b: L.Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return a;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return L.point(a.x + t * dx, a.y + t * dy);
}

export function closestOnRing(point: L.Point, ring: L.Point[]) {
  let best = ring[0];
  let bestDistance = Infinity;
  for (const [a, b] of sides(ring)) {
    const candidate = closestOnSegment(point, a, b);
    const distance = candidate.distanceTo(point);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

export function containsPoint(ring: L.Point[], point: L.Point) {
  let inside = false;
  for (const [a, b] of sides(ring)) {
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function orientation(a: L.Point, b: L.Point, c: L.Point) {
  return Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
}

function segmentsCross([a, b]: [L.Point, L.Point], [c, d]: [L.Point, L.Point]) {
  return orientation(a, b, c) * orientation(a, b, d) < 0 && orientation(c, d, a) * orientation(c, d, b) < 0;
}

export interface Gap {
  from: L.Point;
  to: L.Point;
  distance: number;
}

export function gapBetween(first: L.Point[], second: L.Point[]): Gap {
  const firstSides = sides(first);
  const secondSides = sides(second);
  const overlapping = containsPoint(first, second[0]) || containsPoint(second, first[0])
    || firstSides.some((side) => secondSides.some((other) => segmentsCross(side, other)));
  let best: Gap = { from: first[0], to: second[0], distance: Infinity };
  const consider = (from: L.Point, to: L.Point) => {
    const distance = from.distanceTo(to);
    if (distance < best.distance) best = { from, to, distance };
  };
  for (const point of openRing(first)) consider(point, closestOnRing(point, second));
  for (const point of openRing(second)) consider(closestOnRing(point, first), point);
  return overlapping ? { from: best.from, to: best.from, distance: 0 } : { ...best, distance: groundDistance(best.from, best.to) };
}

export interface PlanarOutline {
  id: string;
  ring: L.Point[];
  bounds: L.Bounds;
}

function boundsGap(a: L.Bounds, b: L.Bounds) {
  const dx = Math.max(0, a.min!.x - b.max!.x, b.min!.x - a.max!.x);
  const dy = Math.max(0, a.min!.y - b.max!.y, b.min!.y - a.max!.y);
  return Math.hypot(dx, dy);
}

export function nearestOutlines(target: PlanarOutline, outlines: PlanarOutline[], count: number, maxDistance: number) {
  const candidates = outlines
    .filter((outline) => outline.id !== target.id)
    .map((outline) => ({ outline, lowerBound: boundsGap(target.bounds, outline.bounds) }))
    .filter(({ lowerBound }) => lowerBound <= maxDistance)
    .sort((a, b) => a.lowerBound - b.lowerBound);
  const found: (Gap & { id: string })[] = [];
  for (const { outline, lowerBound } of candidates) {
    if (found.length >= count && lowerBound > found[count - 1].distance) break;
    const gap = gapBetween(target.ring, outline.ring);
    if (gap.distance > maxDistance) continue;
    found.push({ ...gap, id: outline.id });
    found.sort((a, b) => a.distance - b.distance);
  }
  return found.slice(0, count);
}

const lengthFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function formatDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${lengthFormat.format(meters < 10 ? Math.round(meters * 100) / 100 : Math.round(meters * 10) / 10)} m`;
}
