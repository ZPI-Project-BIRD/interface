import { Button, Space } from "antd";
import { useMutation, useQueryClient } from "react-query";
import { api, type ProjectProgress } from "../../api";
import { useOrganizationCapabilities } from "../../hooks/useOrganizationCapabilities";
import { privateQueryKey } from "../../queryClient";
import { isCurrentSession, useAuthStore, withSession } from "../../stores/authStore";
import { MutationFeedback } from "../MutationFeedback";

export function ProcessingRecovery({ organizationId, projectId, progress }: { organizationId: string; projectId: string; progress?: ProjectProgress }) {
  const access = useOrganizationCapabilities(organizationId);
  const sessionId = useAuthStore((state) => state.sessionId);
  const client = useQueryClient();
  const retry = useMutation((kind: "discovery" | "detections") => withSession(sessionId, async () => {
    if (!access.canRetryProcessing) throw new Error("You cannot retry processing in this organization.");
    return kind === "discovery" ? await api.projects.retryDiscovery(organizationId, projectId) : await api.projects.retryDetections(organizationId, projectId);
  }), {
    mutationKey: privateQueryKey(sessionId, "retry-processing", organizationId, projectId), retry: false,
    onSettled: () => {
      if (!isCurrentSession(sessionId)) return;
      for (const key of ["project-progress", "project-features", "project-detections"]) void client.invalidateQueries(privateQueryKey(sessionId, key, organizationId, projectId));
    },
    onError: (error) => access.reportError(error),
  });
  if (!access.canRetryProcessing || !progress) return null;
  const discovery = progress.discovery;
  const observedAt = client.getQueryState(privateQueryKey(sessionId, "project-progress", organizationId, projectId))?.dataUpdatedAt ?? 0;
  const expired = discovery?.status === "RUNNING" && discovery.lockedUntil && new Date(discovery.lockedUntil).getTime() <= observedAt;
  const canDiscover = discovery && (["UNKNOWN", "PENDING", "FAILED"].includes(discovery.status) || expired);
  const failed = (progress.jobStates?.failed ?? 0) > 0;
  if (!canDiscover && !failed && !retry.error && !retry.data) return null;
  return <section className="border border-[#c9d0d5] bg-white p-4">
    <Space wrap>
      {canDiscover && <Button loading={retry.isLoading && retry.variables === "discovery"} disabled={retry.isLoading}
        onClick={() => retry.mutate("discovery")}>{discovery?.status === "UNKNOWN" ? "Start feature discovery" : "Retry feature discovery"}</Button>}
      {failed && <Button loading={retry.isLoading && retry.variables === "detections"} disabled={retry.isLoading}
        onClick={() => retry.mutate("detections")}>Retry failed analysis</Button>}
    </Space>
    {retry.isSuccess && retry.data && "requeuedJobs" in retry.data && <p className="mb-0 text-sm">{retry.data.requeuedJobs} job(s) queued for analysis.</p>}
    <MutationFeedback error={retry.error} conflict="Discovery is already running or has completed. Refresh progress to see its current state." />
  </section>;
}
