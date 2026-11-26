import type { DetectionBounds } from "../api";
import type { MapLine, MapPolygon } from "../components/Map";
import { DETECTION_STYLES, detectionGeometry } from "../projects/detections";
import { detectionDetails } from "./detectionDetails";
import { planarToLatLng } from "./projections";

export function detectionLayers(bounds: DetectionBounds, id: string, options: {
  highlighted?: (index: number) => boolean;
  title?: string;
  rows?: { label: string; value: string }[];
  comparison?: boolean;
} = {}): { polygons: MapPolygon[]; lines: MapLine[] } {
  const geometry = detectionGeometry(bounds);
  const style = DETECTION_STYLES[geometry.type];
  const details = (index: number) => detectionDetails(bounds, index, options.title, options.rows);
  const color = options.comparison ? undefined : style.color;
  if (geometry.type === "road") return { polygons: [], lines: geometry.coordinates.map((line, index) => ({
    id: `${id}:${index}`, color: options.comparison ? "#f59e0b" : color, highlighted: options.highlighted?.(index),
    points: line.map(planarToLatLng).filter((point) => point !== null), details: details(index),
  })) };
  return { lines: [], polygons: geometry.coordinates.map((rings, index) => ({
    id: `${id}:${index}`, color, highlighted: options.highlighted?.(index),
    rings: rings.map((ring) => ring.map(planarToLatLng).filter((point) => point !== null)), details: details(index),
  })) };
}
