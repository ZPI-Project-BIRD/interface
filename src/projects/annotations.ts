import type { DetectionState, FeatureDetections } from "../api";

export function mergeAnnotation(groups: FeatureDetections[], state: DetectionState): FeatureDetections[] {
  const next = groups.map((group) => ({ ...group, detections: group.detections.filter(({ id }) => id !== state.id) }));
  if (!state.deleted) {
    const detection = { id: state.id, recognitionJobId: state.recognitionJobId, bounds: state.bounds,
      version: state.version, source: state.sourceDetectionId === null ? "MANUAL" as const : "MODEL" as const,
      verifiedBy: state.verifiedBy, verifiedAt: state.verifiedAt };
    const group = next.find(({ featureId }) => featureId === state.featureId);
    if (group) group.detections.push(detection);
    else next.push({ featureId: state.featureId, detections: [detection] });
  }
  return next.filter(({ detections }) => detections.length > 0);
}
