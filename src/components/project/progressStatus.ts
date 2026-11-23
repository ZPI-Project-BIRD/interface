import type { ProjectProgress } from "../../api";

export type ProjectStatusBadge = "processing" | "success" | "error" | "warning";

export function describeStatus({ featureDownloads, recognitionJobs, discovery, jobStates }: ProjectProgress): {
  label: string;
  badge: ProjectStatusBadge;
} {
  if (discovery?.status === "FAILED") return { label: "Discovery failed", badge: "error" };
  if (discovery?.status === "RUNNING") return { label: "Discovering source sheets", badge: "processing" };
  if (discovery?.status === "PENDING") return { label: "Discovery pending", badge: "processing" };
  if (jobStates && jobStates.failed > 0) return { label: `${jobStates.failed} analysis job${jobStates.failed === 1 ? "" : "s"} failed`, badge: "error" };
  if (featureDownloads.total === 0) {
    if (discovery?.status === "SUCCEEDED") return { label: "No source sheets found", badge: "warning" };
    return { label: "No sheets available", badge: "processing" };
  }
  if (recognitionJobs.completed === recognitionJobs.total) {
    return { label: "Completed", badge: "success" };
  }
  if (featureDownloads.completed < featureDownloads.total) {
    return { label: "Downloading sheets", badge: "processing" };
  }
  return { label: "Analysing sheets", badge: "processing" };
}

export function overallPercent({ featureDownloads, recognitionJobs }: ProjectProgress) {
  return featureDownloads.total === 0
    ? 0
    : Math.round(
        ((featureDownloads.completed + recognitionJobs.completed) /
          (featureDownloads.total + recognitionJobs.total)) *
          100,
      );
}
