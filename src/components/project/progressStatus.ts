import type { ProjectProgress } from "../../api";

export type ProjectStatusBadge = "processing" | "success";

export function describeStatus({ featureDownloads, recognitionJobs }: ProjectProgress): {
  label: string;
  badge: ProjectStatusBadge;
} {
  if (featureDownloads.total === 0) {
    return { label: "Discovering sheets", badge: "processing" };
  }
  if (recognitionJobs.completed === recognitionJobs.total) {
    return { label: "Completed", badge: "success" };
  }
  if (featureDownloads.completed < featureDownloads.total) {
    return { label: "Downloading sheets", badge: "processing" };
  }
  return { label: "Analysing sheets", badge: "processing" };
}

/** Combined completion of both stages, 0–100. */
export function overallPercent({ featureDownloads, recognitionJobs }: ProjectProgress) {
  return featureDownloads.total === 0
    ? 0
    : Math.round(
        ((featureDownloads.completed + recognitionJobs.completed) /
          (featureDownloads.total + recognitionJobs.total)) *
          100,
      );
}
