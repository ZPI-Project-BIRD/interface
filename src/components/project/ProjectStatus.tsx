import { Badge, Skeleton } from "antd";
import { useQuery } from "react-query";
import { api, type Project } from "../../api";
import { privateQueryKey } from "../../queryClient";
import { useAuthStore } from "../../stores/authStore";
import { describeStatus, overallPercent } from "./progressStatus";

const REFRESH_SECONDS = 10;

export function ProjectStatus({ project }: { project: Pick<Project, "id" | "organizationId"> }) {
  const sessionId = useAuthStore((state) => state.sessionId);
  // Same key as the project page, so both views share one cached progress entry.
  const progressQuery = useQuery(
    privateQueryKey(sessionId, "project-progress", project.organizationId, project.id),
    ({ signal }) => api.projects.getProgress(project.organizationId, project.id, { signal }),
    {
      refetchInterval: (progress) =>
        progress && describeStatus(progress).badge === "success" ? false : REFRESH_SECONDS * 1000,
    },
  );
  const progress = progressQuery.data;

  if (!progress) {
    return progressQuery.isError ? (
      <Badge
        status="error"
        text={<span className="text-xs text-neutral-500">Status unavailable</span>}
      />
    ) : (
      <Skeleton.Input active size="small" className="!h-4 !min-w-0 !w-28" />
    );
  }

  const status = describeStatus(progress);

  return (
    <Badge
      status={status.badge}
      text={
        <span className="text-xs text-neutral-500">
          {status.label}
          {status.badge !== "success" && (
            <span className="tabular-nums"> · {overallPercent(progress)}%</span>
          )}
        </span>
      }
    />
  );
}
