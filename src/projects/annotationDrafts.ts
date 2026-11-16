import type { PolygonCoordinates, Project } from "../api";
import type { AnnotationCrs } from "../geo/annotationCoordinates";

export interface AnnotationDraft {
  id?: string;
  featureId: string;
  expectedVersion: number;
  bounds: PolygonCoordinates[];
  crs: AnnotationCrs;
}

export type DraftUpdate = AnnotationDraft | undefined | ((previous: AnnotationDraft | undefined) => AnnotationDraft | undefined);

export function annotationDraftKey(project: Pick<Project, "organizationId" | "id">) {
  return `${project.organizationId}/${project.id}`;
}
