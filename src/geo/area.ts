import type { PolygonCoordinates, Project } from "../api";
import { polygonAreaM2 } from "./geometry";

export function calculateAreaKm2(project: Project) {
  const earthRadiusKm = 6_371.0088;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const longitudeSpan = toRadians(project.bottomRight.longitude - project.topLeft.longitude);
  const latitudeBand =
    Math.sin(toRadians(project.topLeft.latitude)) -
    Math.sin(toRadians(project.bottomRight.latitude));

  return earthRadiusKm ** 2 * longitudeSpan * latitudeBand;
}

const numberFormat = new Intl.NumberFormat();

export function formatArea(areaM2: number) {
  return areaM2 >= 10_000
    ? `${(areaM2 / 10_000).toFixed(2)} ha`
    : `${numberFormat.format(Math.round(areaM2))} m²`;
}

export function formatLength(lengthM: number) {
  return lengthM >= 1_000 ? `${(lengthM / 1_000).toFixed(2)} km` : `${numberFormat.format(Math.round(lengthM))} m`;
}

export function outlineGeometryRows(polygon: PolygonCoordinates, label = "Building area") {
  return [
    { label, value: formatArea(polygonAreaM2(polygon)) },
    { label: "Corners", value: String(Math.max((polygon[0]?.length ?? 1) - 1, 0)) },
  ];
}
