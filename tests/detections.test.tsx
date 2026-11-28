import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Detection, DetectionBounds, DetectionGeometry, FeatureDetections, PolygonCoordinates } from "../src/api";
import { DetectionList } from "../src/components/project/DetectionList";
import { detectionDetails } from "../src/geo/detectionDetails";
import { lineLengthM, polygonAreaM2 } from "../src/geo/geometry";
import { canEditDetection, detectionCount, detectionGeometry, detectionPoints, detectionShapePoints, removeDetectionShapes, roadWidth, sheetDetections } from "../src/projects/detections";
import { annotationBounds, editableGeometry, removeDraftShapes, type AnnotationDraft } from "../src/projects/annotationDrafts";
import { removeOutlineVertex } from "../src/geo/annotationCoordinates";
import { mergeAnnotation } from "../src/projects/annotations";

const polygon: PolygonCoordinates = [
  [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
  [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]],
];
const roads: DetectionGeometry = { type: "road", coordinates: [[[0, 0], [3, 4], [6, 8]], [[0, 0], [0, 20]]], width_m: [6.5, null] };
function detection(bounds: DetectionBounds, id = "result"): Detection {
  return { id, bounds, recognitionJobId: "job", version: 0, source: "MODEL", verifiedBy: null, verifiedAt: null };
}
const mixed: FeatureDetections = { featureId: "sheet", detections: [
  detection([polygon], "legacy"),
  ...(["building", "forest", "water"] as const).map((type) => detection({ type, coordinates: [polygon] }, type)),
  detection(roads, "road"), detection(null, "empty"),
] };

test("reads old buildings, typed polygons, roads and empty results together", () => {
  expect(detectionGeometry([polygon])).toEqual({ type: "building", coordinates: [polygon] });
  expect(mixed.detections.map(({ bounds }) => detectionCount(bounds))).toEqual([1, 1, 1, 1, 2, 0]);
  expect(detectionGeometry(roads)).toBe(roads);
  expect(detectionPoints(roads)).toEqual(roads.coordinates.flat());
  expect(detectionPoints({ type: "forest", coordinates: [polygon] })).toEqual(polygon.flat());
  expect(detectionPoints(null)).toEqual([]);
});

test("summary counts each shape and keeps road lengths separate from polygon areas and holes", () => {
  expect(polygonAreaM2(polygon)).toBe(96);
  expect(lineLengthM(roads.coordinates[0])).toBe(10);
  expect(lineLengthM([])).toBe(0);
  expect(sheetDetections(mixed)).toEqual({
    featureId: "sheet", counts: { building: 2, forest: 1, water: 1, road: 2 },
    areasM2: { building: 192, forest: 96, water: 96 }, roadLengthM: 30, totalCount: 6,
  });
});

test("forest-only and road-only source sheets have detections", () => {
  for (const bounds of [{ type: "forest", coordinates: [polygon] }, roads] satisfies DetectionGeometry[]) {
    const summary = sheetDetections({ featureId: "landcover", detections: [detection(bounds)] });
    expect(summary.totalCount).toBeGreaterThan(0);
    expect(summary.counts.building).toBe(0);
  }
});

test("road widths stay aligned with lines, including null and missing widths", () => {
  expect(roadWidth(roads, 0)).toBe(6.5);
  expect(roadWidth(roads, 1)).toBeNull();
  expect(roadWidth(roads, 2)).toBeNull();
  expect(detectionDetails(roads, 0).rows).toContainEqual({ label: "Estimated width", value: "6.5 m" });
  expect(detectionDetails(roads, 1).rows).toContainEqual({ label: "Estimated width", value: "Unknown" });
  expect(detectionDetails(roads, 0).rows).toContainEqual({ label: "Length", value: "10 m" });
  expect(detectionDetails({ type: "water", coordinates: [polygon] }, 0).rows).toContainEqual({ label: "Water area", value: "96 m²" });
});

test("every populated detection is editable without stripping its type or road widths", () => {
  for (const { bounds } of mixed.detections.slice(0, -1)) {
    expect(canEditDetection(bounds)).toBe(true);
    expect(annotationBounds(editableGeometry(bounds))).toEqual(bounds);
  }
  expect(canEditDetection(null)).toBe(false);
});

test("editing a road node keeps the line open and preserves widths", () => {
  const draft = editableGeometry(roads);
  const bounds = removeOutlineVertex(draft.bounds, 0, 0, 0, false);
  expect(annotationBounds({ ...draft, bounds })).toEqual({ ...roads, coordinates: [[[3, 4], [6, 8]], roads.coordinates[1]] });
  expect(removeOutlineVertex(bounds, 0, 0, 0, false)).toBe(bounds);
});

test("focusing a selected shape uses only its points and preserves polygon holes", () => {
  expect(detectionShapePoints(roads, 1)).toEqual(roads.coordinates[1]);
  for (const type of ["building", "forest", "water"] as const) {
    expect(detectionShapePoints({ type, coordinates: [[], polygon] }, 1)).toEqual(polygon.flat());
    expect(detectionShapePoints({ type, coordinates: [polygon] }, 3)).toEqual([]);
  }
  expect(detectionShapePoints([polygon], 0)).toEqual(polygon.flat());
});

test("removing roads keeps the width belonging to each remaining line", () => {
  const removed = new Set([0]);
  expect(removeDetectionShapes(roads, removed)).toEqual({ type: "road", coordinates: [roads.coordinates[1]], width_m: [null] });
  const draft: AnnotationDraft = { ...editableGeometry(roads), featureId: "sheet", crs: "EPSG:2180", expectedVersion: 1 };
  expect(annotationBounds(removeDraftShapes(draft, removed))).toEqual(removeDetectionShapes(roads, removed));
  expect(removeDetectionShapes({ type: "forest", coordinates: [polygon, polygon] }, removed)).toEqual({ type: "forest", coordinates: [polygon] });
});

test("annotation cache merging preserves typed geometry and widths", () => {
  const state = { ...detection(roads, "road"), projectId: "project", featureId: "sheet", sourceDetectionId: "road",
    deleted: false, updatedBy: "reviewer", updatedAt: "2026-11-26T10:00:00Z", version: 1 };
  const result = mergeAnnotation([mixed], state);
  expect(result[0].detections.find(({ id }) => id === "road")?.bounds).toEqual(roads);
  expect(result[0].detections).toHaveLength(mixed.detections.length);
});

test("detection list renders the new counts and measurements without treating roads as buildings", () => {
  const html = renderToStaticMarkup(<DetectionList sheets={[sheetDetections(mixed)]} isLoading={false} isError={false}
    selectedFeatureId={null} onSelect={() => {}} />);
  for (const text of ["Buildings", "Forest", "Water", "Roads", "Building footprint", "Forest area", "Water area", "Road length", "30 m", "192 m²"])
    expect(html).toContain(text);
  expect(html).toContain("2 buildings · 1 forest · 1 water · 2 roads");
});
