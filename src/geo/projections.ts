import * as L from "leaflet";
import proj4 from "proj4";
import "proj4leaflet";
import type { PolygonCoordinates } from "../api";
import { EPSG_2180 } from "./crs";

const SCALE_DENOMINATORS = [
  30238155.714285716, 15119077.857142858, 7559538.928571429, 3779769.4642857146, 1889884.7321428573,
  944942.3660714286, 472471.1830357143, 236235.59151785716, 94494.23660714286, 47247.11830357143,
  23623.559151785714, 9449.423660714287, 4724.711830357143, 1889.8847321428573, 944.9423660714286,
  472.4711830357143, 236.23559151785716,
];

export const CRS_2180 = new L.Proj.CRS("EPSG:2180", EPSG_2180, {
  resolutions: SCALE_DENOMINATORS.map((s) => s * 0.00028),
  origin: [100000, 850000],
});

const PL_2000_ZONES = new globalThis.Map(
  [5, 6, 7, 8].map((zone) => [
    zone,
    proj4(
      `+proj=tmerc +lat_0=0 +lon_0=${zone * 3} +k=0.999923 +x_0=${zone}500000 +y_0=0 +ellps=GRS80 +units=m +no_defs`,
      "WGS84",
    ),
  ]),
);

export function planarToLatLng([x, y]: [number, number]): L.LatLng | null {
  if (x < 1_000_000) {
    return CRS_2180.unproject(L.point(x, y));
  }

  const converter = PL_2000_ZONES.get(Math.floor(x / 1_000_000));

  if (!converter) {
    return null;
  }

  const [longitude, latitude] = converter.forward([x, y]);
  return L.latLng(latitude, longitude);
}

export function polygonAreaM2([outer, ...holes]: PolygonCoordinates): number {
  return ringArea(outer ?? []) - holes.reduce((sum, hole) => sum + ringArea(hole), 0);
}

function ringArea(ring: [number, number][]): number {
  let doubled = 0;

  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    doubled += x1 * y2 - x2 * y1;
  }

  return Math.abs(doubled) / 2;
}
