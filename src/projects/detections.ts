import type { DetectionBounds, DetectionGeometry, DetectionType, FeatureDetections, PolygonCoordinates } from "../api";
import { lineLengthM, polygonAreaM2 } from "../geo/geometry";

export const DETECTION_TYPES: DetectionType[] = ["building", "forest", "water", "road"];
export const DETECTION_STYLES = {
  building: { label: "Buildings", singular: "Building", color: "#d97706" },
  forest: { label: "Forest", singular: "Forest", color: "#16a34a" },
  water: { label: "Water", singular: "Water", color: "#2563eb" },
  road: { label: "Roads", singular: "Road", color: "#a855f7" },
} as const;

export function detectionGeometry(bounds: DetectionBounds): DetectionGeometry {
  return Array.isArray(bounds) ? { type: "building", coordinates: bounds }
    : bounds ?? { type: "building", coordinates: [] };
}

// The current annotation API accepts only the original polygon-array format.
export function canEditDetection(bounds: DetectionBounds): bounds is PolygonCoordinates[] {
  return Array.isArray(bounds);
}

export function detectionCount(bounds: DetectionBounds): number {
  return detectionGeometry(bounds).coordinates.length;
}

export function detectionPoints(bounds: DetectionBounds) {
  const geometry = detectionGeometry(bounds);
  return geometry.type === "road" ? geometry.coordinates.flat()
    : geometry.coordinates.flatMap((polygon) => polygon.flat());
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
