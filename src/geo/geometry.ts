import type { LineCoordinates, PolygonCoordinates } from "../api";

export function polygonAreaM2([outer, ...holes]: PolygonCoordinates): number {
  return ringArea(outer ?? []) - holes.reduce((sum, hole) => sum + ringArea(hole), 0);
}

function ringArea(ring: LineCoordinates): number {
  let doubled = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    doubled += x1 * y2 - x2 * y1;
  }
  return Math.abs(doubled) / 2;
}

export function lineLengthM(line: LineCoordinates): number {
  return line.reduce((length, [x, y], index) => index === 0 ? 0
    : length + Math.hypot(x - line[index - 1][0], y - line[index - 1][1]), 0);
}
