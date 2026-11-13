import proj4 from "proj4";
import { EPSG_2180 } from "./crs";
import type { PolygonCoordinates } from "../api";

export type AnnotationCrs = "EPSG:2180" | 5 | 6 | 7 | 8;

function definition(crs: AnnotationCrs) {
  return crs === "EPSG:2180" ? EPSG_2180
    : `+proj=tmerc +lat_0=0 +lon_0=${crs * 3} +k=0.999923 +x_0=${crs}500000 +y_0=0 +ellps=GRS80 +units=m +no_defs`;
}

export function annotationCrs(bounds: PolygonCoordinates[]): AnnotationCrs {
  const x = bounds[0]?.[0]?.[0]?.[0];
  if (x === undefined) throw new Error("This result has no outline to edit.");
  if (x < 1_000_000) return "EPSG:2180";
  const zone = Math.floor(x / 1_000_000);
  if (zone < 5 || zone > 8) throw new Error("This outline's coordinate system is not supported.");
  return zone as AnnotationCrs;
}

export function projectVertex(point: { lat: number; lng: number }, crs: AnnotationCrs): [number, number] {
  const [x, y] = proj4("WGS84", definition(crs), [point.lng, point.lat]);
  return [x, y];
}

export function replaceOutline(bounds: PolygonCoordinates[], index: number, rings: { lat: number; lng: number }[][], crs: AnnotationCrs): PolygonCoordinates[] {
  const outline = rings.map((ring) => ring.map((point) => projectVertex(point, crs)));
  return bounds.map((polygon, position) => position === index ? outline : polygon);
}
