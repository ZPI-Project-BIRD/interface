import type { DetectionBounds } from "../api";
import { DETECTION_STYLES, detectionGeometry, roadWidth } from "../projects/detections";
import { formatLength, outlineGeometryRows } from "./area";
import { lineLengthM } from "./geometry";

export function detectionDetails(bounds: DetectionBounds, index: number, title?: string, rows: { label: string; value: string }[] = []) {
  const geometry = detectionGeometry(bounds);
  const style = DETECTION_STYLES[geometry.type];
  const width = geometry.type === "road" ? roadWidth(geometry, index) : null;
  return {
    title: `${title ?? style.singular} · ${index + 1} of ${geometry.coordinates.length}`,
    rows: [
      { label: "Type", value: style.singular },
      ...(geometry.type === "road" ? [
        { label: "Length", value: formatLength(lineLengthM(geometry.coordinates[index])) },
        { label: "Estimated width", value: width === null ? "Unknown" : `${width} m` },
      ] : outlineGeometryRows(geometry.coordinates[index], `${style.singular} area`)),
      ...rows,
    ],
  };
}
