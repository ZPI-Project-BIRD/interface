import { expect, spyOn, test } from "bun:test";
import * as clipping from "polygon-clipping";
import * as preciseClipping from "polyclip-ts";
import type { LineCoordinates, PolygonCoordinates } from "../src/api";
import { clipPolygons } from "../src/geo/clipPolygons";
import { applyBrushStroke, brushFootprint } from "../src/geo/brush";
import { polygonAreaM2 } from "../src/geo/geometry";
import type { AnnotationDraft } from "../src/projects/annotationDrafts";

const x = 745242.2239240926, y = 586967.0970030397;
const numericalError = () => new Error(`Unable to find segment #65404 [${x}, ${y}] -> [745242.2736450966, 586967.1467240435] in SweepLine tree.`);
const square: PolygonCoordinates = [[[x, y], [x + 20, y], [x + 20, y + 20], [x, y + 20], [x, y]]];
const area = (polygons: PolygonCoordinates[]) => polygons.reduce((sum, polygon) => sum + polygonAreaM2(polygon), 0);

test("the exact reported sweep-line failure recovers when constructing a brush footprint", () => {
  const failure = spyOn(clipping, "union").mockImplementationOnce(() => { throw numericalError(); });
  try {
    const footprint = brushFootprint([[x, y], [x + 2, y + 2], [x + 1, y + 1]], 0.5);
    expect(footprint.length).toBeGreaterThan(0);
    expect(area(footprint)).toBeGreaterThan(2);
    for (const polygon of footprint) for (const ring of polygon) {
      expect(ring[0]).toEqual(ring.at(-1));
      expect(ring.flat().every(Number.isFinite)).toBe(true);
    }
  } finally { failure.mockRestore(); }
});

test("the precise fallback can union overlapping polygons at source imagery coordinates", () => {
  const moved: PolygonCoordinates = square.map((ring) => ring.map(([px, py]) => [px + 10, py]));
  const original = structuredClone([square, moved]);
  const failure = spyOn(clipping, "union").mockImplementationOnce(() => { throw numericalError(); });
  try {
    const result = clipPolygons("union", [square], [moved]);
    expect(result).toHaveLength(1);
    expect(area(result)).toBeCloseTo(600, 3);
    expect([square, moved]).toEqual(original);
  } finally { failure.mockRestore(); }
});

test("the precise fallback preserves holes when an eraser difference fails", () => {
  const hole: PolygonCoordinates = [[[x + 5, y + 5], [x + 15, y + 5], [x + 15, y + 15], [x + 5, y + 15], [x + 5, y + 5]]];
  const failure = spyOn(clipping, "difference").mockImplementationOnce(() => { throw numericalError(); });
  try {
    const result = clipPolygons("difference", [square], [hole]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(2);
    expect(area(result)).toBeCloseTo(300, 3);
  } finally { failure.mockRestore(); }
});

test("clipping at the project perimeter also recovers from a sweep-line failure", () => {
  const perimeter: PolygonCoordinates = [[[x + 10, y - 10], [x + 30, y - 10], [x + 30, y + 30], [x + 10, y + 30], [x + 10, y - 10]]];
  const original = structuredClone([square, perimeter]);
  const failure = spyOn(clipping, "intersection").mockImplementationOnce(() => { throw numericalError(); });
  try {
    const result = clipPolygons("intersection", [square], [perimeter]);
    expect(result).toHaveLength(1);
    expect(area(result)).toBeCloseTo(200, 3);
    expect(result.flat(2).every(([px, py]) => px >= x + 10 && px <= x + 20 && py >= y && py <= y + 20)).toBe(true);
    expect([square, perimeter]).toEqual(original);
  } finally { failure.mockRestore(); }
});

test("a failed fallback leaves the original geometry unchanged and the next stroke still works", () => {
  const original = structuredClone([square]);
  const first = spyOn(clipping, "union").mockImplementationOnce(() => { throw numericalError(); });
  const second = spyOn(preciseClipping, "union").mockImplementationOnce(() => { throw numericalError(); });
  try {
    expect(() => clipPolygons("union", [square])).toThrow("Your draft is unchanged");
    expect([square]).toEqual(original);
  } finally { first.mockRestore(); second.mockRestore(); }
  expect(area(clipPolygons("union", [square]))).toBeCloseTo(400, 3);
});

test("repeated dense overlapping paint and erase strokes stay finite and closed", () => {
  let current: AnnotationDraft = { featureId: "sheet", expectedVersion: 0, geometryType: "forest", crs: "EPSG:2180", bounds: [square] };
  for (let stroke = 0; stroke < 12; stroke++) {
    const path: LineCoordinates = Array.from({ length: 60 }, (_, index) => {
      const t = index / 6;
      return [x + 10 + Math.sin(t + stroke * 0.01) * 4, y + 10 + Math.sin(t * 2 + stroke * 0.01) * 4];
    });
    current = applyBrushStroke(current, path, 0.5 + (stroke % 4) * 0.5, stroke % 3 === 2 ? "erase" : "paint");
    for (const polygon of current.bounds) for (const ring of polygon) {
      expect(ring[0]).toEqual(ring.at(-1));
      expect(ring.flat().every(Number.isFinite)).toBe(true);
    }
  }
  expect(area(current.bounds)).toBeGreaterThan(0);
});
