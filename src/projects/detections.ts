import type { DetectionBounds, DetectionGeometry, DetectionType, FeatureDetections } from "../api";
import { lineLengthM, polygonAreaM2 } from "../geo/geometry";

export const DETECTION_TYPES: DetectionType[] = ["building", "forest", "water", "road"];
export const DETECTION_STYLES = {
  building: { label: "Buildings", singular: "Building", color: "#d97706" },
  forest: { label: "Forest", singular: "Forest", color: "#16a34a" },
  water: { label: "Water", singular: "Water", color: "#2563eb" },
  road: { label: "Roads", singular: "Road", color: "#475569" },
} as const;

export function detectionGeometry(bounds: DetectionBounds): DetectionGeometry {
  return Array.isArray(bounds) ? { type: "building", coordinates: bounds }
    : bounds ?? { type: "building", coordinates: [] };
}

export function canEditDetection(bounds: DetectionBounds): boolean {
  return detectionCount(bounds) > 0;
}

export function removeDetectionShapes(bounds: DetectionBounds, removed: ReadonlySet<number>): Exclude<DetectionBounds, null> {
  if (Array.isArray(bounds)) return bounds.filter((_, index) => !removed.has(index));
  const geometry = detectionGeometry(bounds);
  if (geometry.type === "road") return { ...geometry,
    coordinates: geometry.coordinates.filter((_, index) => !removed.has(index)),
    width_m: geometry.coordinates.flatMap((_, index) => removed.has(index) ? [] : [geometry.width_m?.[index] ?? null]) };
  return { ...geometry, coordinates: geometry.coordinates.filter((_, index) => !removed.has(index)) };
}

export function detectionCount(bounds: DetectionBounds): number {
  return detectionGeometry(bounds).coordinates.length;
}

export function detectionPoints(bounds: DetectionBounds) {
  const geometry = detectionGeometry(bounds);
  return geometry.type === "road" ? geometry.coordinates.flat()
    : geometry.coordinates.flatMap((polygon) => polygon.flat());
}

export function detectionShapePoints(bounds: DetectionBounds, index: number) {
  const geometry = detectionGeometry(bounds);
  return geometry.type === "road" ? geometry.coordinates[index] ?? [] : geometry.coordinates[index]?.flat() ?? [];
}

export function roadWidth(geometry: Extract<DetectionGeometry, { type: "road" }>, index: number): number | null {
  const width = geometry.width_m?.[index];
  return typeof width === "number" && Number.isFinite(width) && width > 0 ? width : null;
}

export function sheetDetections({ featureId, detections }: FeatureDetections) {
  const counts: Record<DetectionType, number> = { building: 0, forest: 0, water: 0, road: 0 };
  const areasM2 = { building: 0, forest: 0, water: 0 };
  let roadLengthM = 0;
  for (const { bounds } of detections) {
    const geometry = detectionGeometry(bounds);
    counts[geometry.type] += geometry.coordinates.length;
    if (geometry.type === "road") roadLengthM += geometry.coordinates.reduce((sum, line) => sum + lineLengthM(line), 0);
    else areasM2[geometry.type] += geometry.coordinates.reduce((sum, polygon) => sum + polygonAreaM2(polygon), 0);
  }
  return { featureId, counts, areasM2, roadLengthM, totalCount: Object.values(counts).reduce((sum, count) => sum + count, 0) };
}

export type SheetDetections = ReturnType<typeof sheetDetections>;
