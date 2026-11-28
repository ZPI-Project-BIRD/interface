import { expect, test } from "bun:test";
import type { AnnotationDraft } from "../src/projects/annotationDrafts";
import type { PolygonCoordinates } from "../src/api";
import { applyBrushStroke, brushFootprint, eraseRoadLine, sampleBrushPath } from "../src/geo/brush";
import { polygonAreaM2 } from "../src/geo/geometry";
import { annotationBounds } from "../src/projects/annotationDrafts";
import { projectPerimeter, projectVertex } from "../src/geo/annotationCoordinates";

const square: PolygonCoordinates = [[[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]]];
function draft(bounds = [square]): AnnotationDraft {
  return { id: "result", featureId: "sheet", expectedVersion: 2, geometryType: "forest", crs: "EPSG:2180", bounds: structuredClone(bounds) };
}
function area(value: AnnotationDraft) { return value.bounds.reduce((sum, polygon) => sum + polygonAreaM2(polygon), 0); }

test("a brush tap creates a closed circular polygon that can be saved", () => {
  const result = applyBrushStroke(draft([]), [[10, 10]], 4, "paint");
  expect(area(result)).toBeGreaterThan(12);
  expect(area(result)).toBeLessThan(13);
  const ring = result.bounds[0][0];
  expect(ring[0]).toEqual(ring.at(-1));
  expect(annotationBounds(result)).toEqual({ type: "forest", coordinates: result.bounds });
});

test("paint joins new area to an existing polygon without mutating the original draft", () => {
  const original = draft();
  const result = applyBrushStroke(original, [[15, 10], [25, 10]], 4, "paint");
  expect(result.bounds).toHaveLength(1);
  expect(area(result)).toBeGreaterThan(400);
  expect(original.bounds).toEqual([square]);
  expect(result.geometryType).toBe("forest");
  expect(result.expectedVersion).toBe(2);
});

test("erasing inside a polygon creates a closed hole", () => {
  const result = applyBrushStroke(draft(), [[10, 10]], 4, "erase");
  expect(result.bounds).toHaveLength(1);
  expect(result.bounds[0]).toHaveLength(2);
  expect(area(result)).toBeGreaterThan(387);
  expect(area(result)).toBeLessThan(388);
  for (const ring of result.bounds[0]) expect(ring[0]).toEqual(ring.at(-1));
});

test("an eraser stroke can split an outline into two polygons", () => {
  const result = applyBrushStroke(draft(), [[10, -5], [10, 25]], 4, "erase");
  expect(result.bounds).toHaveLength(2);
  expect(area(result)).toBeCloseTo(320, 5);
});

test("paint can refill an erased hole", () => {
  const cut = applyBrushStroke(draft(), [[10, 10]], 4, "erase");
  const filled = applyBrushStroke(cut, [[10, 10]], 6, "paint");
  expect(filled.bounds[0]).toHaveLength(1);
  expect(area(filled)).toBeCloseTo(400, 5);
});

test("full erasing leaves an empty draft and preserves the original for undo", () => {
  const original = draft();
  expect(applyBrushStroke(original, [[10, 10]], 100, "erase").bounds).toEqual([]);
  expect(original.bounds).toEqual([square]);
});

test("a road brush adds an open centreline and assigns its width", () => {
  const original: AnnotationDraft = { ...draft([]), geometryType: "road", roadWidths: [] };
  expect(applyBrushStroke(original, [[0, 0]], 6.5, "paint")).toBe(original);
  const result = applyBrushStroke(original, [[0, 0], [10, 10], [20, 10]], 6.5, "paint");
  expect(annotationBounds(result)).toEqual({ type: "road", coordinates: [[[0, 0], [10, 10], [20, 10]]], width_m: [6.5] });
});

test("road erasing splits centrelines and preserves each matching width", () => {
  const original: AnnotationDraft = { ...draft([[[[0, 0], [10, 0]]], [[[0, 20], [10, 20]]]]), geometryType: "road", roadWidths: [6.5, null] };
  const result = applyBrushStroke(original, [[5, -5], [5, 5]], 2, "erase");
  expect(result.bounds).toHaveLength(3);
  expect(result.roadWidths).toEqual([6.5, 6.5, null]);
  expect(result.bounds[0][0]).toEqual([[0, 0], [4, 0]]);
  expect(result.bounds[1][0]).toEqual([[6, 0], [10, 0]]);
  expect(result.bounds[2]).toEqual(original.bounds[1]);
  expect(original.roadWidths).toEqual([6.5, null]);
});

test("road erasing keeps connected fragments across vertices and can remove a whole line", () => {
  const footprint = brushFootprint([[5, 0]], 2);
  expect(eraseRoadLine([[0, 0], [3, 0], [5, 0], [7, 0], [10, 0]], footprint)).toEqual([
    [[0, 0], [3, 0]], [[7, 0], [10, 0]],
  ]);
  expect(eraseRoadLine([[4, 0], [6, 0]], footprint)).toEqual([]);
});

test("brush operations remain stable at the projected coordinates used by source imagery", () => {
  const projected: PolygonCoordinates = square.map((ring) => ring.map(([x, y]) => [x + 7500000, y + 5100000]));
  const result = applyBrushStroke(draft([projected]), [[7500010, 5099995], [7500010, 5100025]], 4, "erase");
  expect(result.bounds).toHaveLength(2);
  expect(area(result)).toBeCloseTo(320, 2);
});

test("brush paths reject invalid sizes, non-finite coordinates and excessively long strokes", () => {
  expect(() => applyBrushStroke(draft(), [[0, 0]], 0, "paint")).toThrow("positive brush size");
  expect(() => applyBrushStroke(draft(), [[NaN, 0]], 5, "paint")).toThrow("invalid coordinate");
  expect(() => sampleBrushPath(Array.from({ length: 600 }, (_, x) => [x, 0]), 1)).toThrow("too long");
  expect(sampleBrushPath([[0, 0], [0.01, 0], [0.02, 0]], 5)).toEqual([[0, 0], [0.02, 0]]);
});

test("paint stops at the project perimeter for every polygon detection type", () => {
  for (const geometryType of ["building", "forest", "water"] as const) {
    const original = { ...draft([]), geometryType };
    const result = applyBrushStroke(original, [[-5, 10], [25, 10]], 4, "paint", [square]);
    expect(area(result)).toBeCloseTo(80, 6);
    expect(result.bounds[0][0]).toHaveLength(5);
    expect(result.bounds[0][0].every(([x, y]) => x >= 0 && x <= 20 && y >= 0 && y <= 20)).toBe(true);
    expect(result.geometryType).toBe(geometryType);
    expect(original.bounds).toEqual([]);
    expect(applyBrushStroke(original, [[-10, -10]], 4, "paint", [square]).bounds).toEqual([]);
  }
});

test("a large brush covering the project is cut to its exact outline", () => {
  const result = applyBrushStroke(draft([]), [[10, 10]], 100, "paint", [square]);
  expect(area(result)).toBeCloseTo(400, 6);
  expect(result.bounds[0][0]).toHaveLength(5);
});

test("clipping an existing outline retains holes and supports erasing at the perimeter", () => {
  const original = draft([[[[-10, -10], [30, -10], [30, 30], [-10, 30], [-10, -10]],
    [[8, 8], [8, 12], [12, 12], [12, 8], [8, 8]]]]);
  const before = structuredClone(original);
  const result = applyBrushStroke(original, [[0, -5], [0, 25]], 4, "erase", [square]);
  expect(area(result)).toBeCloseTo(344, 6);
  expect(result.bounds[0]).toHaveLength(2);
  expect(result.bounds.flat(2).every(([x, y]) => x >= 2 && x <= 20 && y >= 0 && y <= 20)).toBe(true);
  expect(original).toEqual(before);
});

test("road painting cuts crossings and preserves widths when a stroke leaves and re-enters the project", () => {
  const original: AnnotationDraft = { ...draft([]), geometryType: "road", roadWidths: [] };
  const result = applyBrushStroke(original, [[-5, 5], [25, 5], [25, 15], [-5, 15]], 6.5, "paint", [square]);
  expect(result.bounds).toEqual([[[[0, 5], [20, 5]]], [[[20, 15], [0, 15]]]]);
  expect(result.roadWidths).toEqual([6.5, 6.5]);
  expect(original.bounds).toEqual([]);
  expect(applyBrushStroke(original, [[-10, 0], [-5, 10]], 6.5, "paint", [square]).bounds).toEqual([]);
});

test("roads along any project edge remain and erasing preserves the remaining fragments' widths", () => {
  const original: AnnotationDraft = { ...draft([]), geometryType: "road", roadWidths: [] };
  const edges = applyBrushStroke(original, square[0], 4, "paint", [square]);
  expect(edges.bounds).toEqual([square]);
  const crossing: AnnotationDraft = { ...draft([[[[-5, 10], [25, 10]]]]), geometryType: "road", roadWidths: [null] };
  const cut = applyBrushStroke(crossing, [[10, 10]], 4, "erase", [square]);
  expect(cut.bounds).toEqual([[[[0, 10], [8, 10]]], [[[12, 10], [20, 10]]]]);
  expect(cut.roadWidths).toEqual([null, null]);
});

test("the project perimeter uses the draft projection and matches the displayed map rectangle", () => {
  const project = { topLeft: { latitude: 50.68, longitude: 17.9 }, bottomRight: { latitude: 50.67, longitude: 17.92 } };
  for (const crs of ["EPSG:2180", 6] as const) {
    const perimeter = projectPerimeter(project, crs);
    const centre = projectVertex({ lat: 50.675, lng: 17.91 }, crs);
    const result = applyBrushStroke({ ...draft([]), crs }, [centre], 5000, "paint", perimeter);
    expect(area(result)).toBeCloseTo(perimeter.reduce((sum, polygon) => sum + polygonAreaM2(polygon), 0), 2);
    const ring = perimeter[0][0];
    const corner = projectVertex({ lat: 50.68, lng: 17.9 }, crs);
    expect(ring[0][0]).toBeCloseTo(corner[0], 6);
    expect(ring[0][1]).toBeCloseTo(corner[1], 6);
    expect(ring.at(-1)).toEqual(ring[0]);
  }
});
