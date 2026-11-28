import type { DetectionBounds, DetectionType, PolygonCoordinates, Project } from "../api";
import type { AnnotationCrs } from "../geo/annotationCoordinates";
import { detectionGeometry } from "./detections";

export interface AnnotationDraft {
  id?: string;
  featureId: string;
  expectedVersion: number;
  bounds: PolygonCoordinates[];
  geometryType?: DetectionType;
  roadWidths?: (number | null)[];
  crs: AnnotationCrs;
}

export function editableGeometry(bounds: DetectionBounds): Pick<AnnotationDraft, "bounds" | "geometryType" | "roadWidths"> {
  const geometry = detectionGeometry(bounds);
  return {
    bounds: structuredClone(geometry.type === "road" ? geometry.coordinates.map((line) => [line]) : geometry.coordinates),
    geometryType: Array.isArray(bounds) ? undefined : geometry.type,
    roadWidths: geometry.type === "road" ? geometry.coordinates.map((_, index) => geometry.width_m?.[index] ?? null) : undefined,
  };
}

export function annotationBounds(draft: Pick<AnnotationDraft, "bounds" | "geometryType" | "roadWidths">): Exclude<DetectionBounds, null> {
  if (draft.geometryType === "road") return { type: "road", coordinates: draft.bounds.map((rings) => rings[0]),
    width_m: draft.bounds.map((_, index) => draft.roadWidths?.[index] ?? null) };
  return draft.geometryType ? { type: draft.geometryType, coordinates: draft.bounds } : draft.bounds;
}

export function removeDraftShapes(draft: AnnotationDraft, removed: ReadonlySet<number>): AnnotationDraft {
  return { ...draft, bounds: draft.bounds.filter((_, index) => !removed.has(index)),
    roadWidths: draft.roadWidths?.filter((_, index) => !removed.has(index)) };
}

export type DraftUpdate = AnnotationDraft | undefined | ((previous: AnnotationDraft | undefined) => AnnotationDraft | undefined);

export function annotationDraftKey(project: Pick<Project, "organizationId" | "id">) {
  return `${project.organizationId}/${project.id}`;
}
