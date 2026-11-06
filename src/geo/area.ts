import type { Project } from "../api";

/** Area of the project's latitude/longitude rectangle on a spherical Earth. */
export function calculateAreaKm2(project: Project) {
  const earthRadiusKm = 6_371.0088;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const longitudeSpan = toRadians(project.bottomRight.longitude - project.topLeft.longitude);
  const latitudeBand =
    Math.sin(toRadians(project.topLeft.latitude)) -
    Math.sin(toRadians(project.bottomRight.latitude));

  return earthRadiusKm ** 2 * longitudeSpan * latitudeBand;
}
