import { useMemo } from "react";
import proj4 from "proj4";
import type { Project } from "../../api";
import { EPSG_2180 } from "../../geo/crs";
import { POLAND_OUTLINE } from "../../geo/polandOutline";

const toPuwg1992 = proj4("WGS84", EPSG_2180);

const MIN_FOOTPRINT_KM = 34;
const HALO_RADIUS_KM = 52;

function toOutlineSpace(longitude: number, latitude: number) {
  const [easting, northing] = toPuwg1992.forward([longitude, latitude]);
  return {
    x: easting / 1000 - POLAND_OUTLINE.minEastingKm,
    y: POLAND_OUTLINE.maxNorthingKm - northing / 1000,
  };
}

interface PolandMiniMapProps {
  project: Pick<Project, "topLeft" | "bottomRight">;
  width?: number;
  className?: string;
}

export function PolandMiniMap({ project, width = 56, className }: PolandMiniMapProps) {
  const footprint = useMemo(() => {
    const corners = [
      toOutlineSpace(project.topLeft.longitude, project.topLeft.latitude),
      toOutlineSpace(project.bottomRight.longitude, project.bottomRight.latitude),
    ];
    const left = Math.min(corners[0].x, corners[1].x);
    const right = Math.max(corners[0].x, corners[1].x);
    const top = Math.min(corners[0].y, corners[1].y);
    const bottom = Math.max(corners[0].y, corners[1].y);
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const w = Math.max(right - left, MIN_FOOTPRINT_KM);
    const h = Math.max(bottom - top, MIN_FOOTPRINT_KM);

    return { cx, cy, x: cx - w / 2, y: cy - h / 2, w, h };
  }, [project]);
  const { width: viewWidth, height: viewHeight, path } = POLAND_OUTLINE;
  const padding = 8;

  return (
    <svg
      role="img"
      aria-label="Project location in Poland"
      width={width}
      height={(width * (viewHeight + 2 * padding)) / (viewWidth + 2 * padding)}
      viewBox={`${-padding} ${-padding} ${viewWidth + 2 * padding} ${viewHeight + 2 * padding}`}
      className={`pointer-events-none shrink-0 select-none ${className ?? ""}`}
    >
      <path
        d={path}
        fill="var(--color-surface-muted)"
        stroke="var(--color-subtle)"
        strokeWidth={1}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={footprint.cx}
        cy={footprint.cy}
        r={HALO_RADIUS_KM}
        fill="var(--color-brand)"
        fillOpacity={0.18}
        stroke="var(--color-brand-ink)"
        strokeOpacity={0.55}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <rect
        x={footprint.x}
        y={footprint.y}
        width={footprint.w}
        height={footprint.h}
        fill="var(--color-brand-ink)"
        stroke="var(--color-surface)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
