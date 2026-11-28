import * as clipping from "polygon-clipping";
import * as preciseClipping from "polyclip-ts";
import type { PolygonCoordinates } from "../api";

type Operation = "union" | "difference" | "intersection";
const NUMERICAL_FAILURE = /sweepline|sweep line|unable to find segment|unable to complete output ring|infinite loop/i;

export function clipPolygons(operation: Operation, subject: PolygonCoordinates[], ...clips: PolygonCoordinates[][]): PolygonCoordinates[] {
  const geometries = [subject, ...clips];
  let origin: [number, number] | undefined;
  for (const geometry of geometries) for (const polygon of geometry) for (const ring of polygon) for (const point of ring) {
    if (!point.every(Number.isFinite)) throw new Error("The outline contains an invalid coordinate.");
    origin ??= [Math.floor(point[0]), Math.floor(point[1])];
  }
  if (!origin) return [];
  const [x, y] = origin;
  // Keep the sweep-line calculations near zero instead of working directly
  // with national-grid coordinates hundreds of thousands of metres away.
  const local = geometries.map((geometry) => geometry.map((polygon) => polygon.map((ring) =>
    ring.map(([px, py]): [number, number] => [px - x, py - y]))));
  let result: PolygonCoordinates[];
  try {
    result = clipping[operation](local[0], ...local.slice(1));
  } catch (error) {
    if (!(error instanceof Error) || !NUMERICAL_FAILURE.test(error.message)) throw error;
    // Retry the same operation with decimal arithmetic and a small tolerance
    // for nearly collinear edges. No draft geometry is replaced until it succeeds.
    try {
      preciseClipping.setPrecision(1e-8);
      result = preciseClipping[operation](local[0], ...local.slice(1));
    } catch (cause) {
      throw new Error("Could not calculate this stroke. Your draft is unchanged; try a shorter stroke.", { cause });
    } finally {
      preciseClipping.setPrecision();
    }
  }
  return result.map((polygon) => polygon.map((ring) => ring.map(([px, py]): [number, number] => [px + x, py + y])));
}
