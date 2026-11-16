import { Button, Popconfirm, Space } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { useMutation, useQueryClient } from "react-query";
import { api, type ProjectProgress } from "../../api";
import { useOrganizationCapabilities } from "../../hooks/useOrganizationCapabilities";
import { privateQueryKey } from "../../queryClient";
import { isCurrentSession, useAuthStore, withSession } from "../../stores/authStore";
import { MutationFeedback } from "../MutationFeedback";
import { annotationDraftKey } from "../../projects/annotationDrafts";

export function ProcessingRecovery({ organizationId, projectId, progress }: { organizationId: string; projectId: string; progress?: ProjectProgress }) {
  const access = useOrganizationCapabilities(organizationId);
  const sessionId = useAuthStore((state) => state.sessionId);
  const hasDraft = useAuthStore((state) => Boolean(state.annotationDrafts[annotationDraftKey({ organizationId, id: projectId })]));
  const client = useQueryClient();
  const retry = useMutation((kind: "discovery" | "detections" | "rerun") => withSession(sessionId, async () => {
    if (!access.canRetryProcessing) throw new Error("You cannot retry processing in this organization.");
    if (kind === "rerun") {
      if (hasDraft) throw new Error("Save or discard your annotation draft before running detection again.");
      return await api.projects.rerunDetections(organizationId, projectId);
    }
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
  const jobs = progress.jobStates;
  const canRerun = jobs && jobs.finished + jobs.failed > 0 && jobs.pending === 0 && jobs.running === 0
    && discovery?.status !== "RUNNING" && discovery?.status !== "PENDING"
    && progress.featureDownloads.completed === progress.featureDownloads.total;
  return <section className="border border-[#c9d0d5] bg-white p-4">
    <Space wrap>
      <Popconfirm title="Run detection again?" okText="Run again" cancelText="Cancel" disabled={!canRerun || hasDraft || retry.isLoading}
        description={<span className="block max-w-64">Automatic detections will be regenerated. Saved annotations and history will remain.</span>}
        onConfirm={() => retry.mutate("rerun")}>
        <Button icon={<ReloadOutlined />} loading={retry.isLoading && retry.variables === "rerun"}
          disabled={!canRerun || hasDraft || retry.isLoading}>Run detection again</Button>
      </Popconfirm>
      {canDiscover && <Button loading={retry.isLoading && retry.variables === "discovery"} disabled={retry.isLoading}
        onClick={() => retry.mutate("discovery")}>{discovery?.status === "UNKNOWN" ? "Start feature discovery" : "Retry feature discovery"}</Button>}
      {failed && <Button loading={retry.isLoading && retry.variables === "detections"} disabled={retry.isLoading}
        onClick={() => retry.mutate("detections")}>Retry failed analysis</Button>}
    </Space>
    {hasDraft ? <p className="mb-0 text-sm text-neutral-500">Save or discard your annotation draft before running detection again.</p>
      : !canRerun && <p className="mb-0 text-sm text-neutral-500">Available after source downloads and detection finish.</p>}
    {retry.isSuccess && retry.data && "requeuedJobs" in retry.data && <p className="mb-0 text-sm">{retry.data.requeuedJobs} job(s) queued for analysis.</p>}
    <MutationFeedback error={retry.error} conflict={retry.variables === "rerun"
      ? "Detection cannot be restarted in its current state. Refresh progress and try again."
      : "Discovery is already running or has completed. Refresh progress to see its current state."} />
  </section>;
}
