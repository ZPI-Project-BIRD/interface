import { useState } from "react";
import { Button, Drawer, Empty, Modal, Space, Tag, Typography } from "antd";
import { useQuery } from "react-query";
import { api, type AnnotationHistoryEntry, type Project } from "../../api";
import { privateQueryKey } from "../../queryClient";
import { useAuthStore } from "../../stores/authStore";
import { useOrganizationCapabilities } from "../../hooks/useOrganizationCapabilities";
import { AccessFeedback } from "../AccessFeedback";
import { Map, type MapPolygon } from "../Map";
import { planarToLatLng } from "../../geo/projections";

export function AnnotationHistory({ project, detectionId, onClose }: { project: Project; detectionId?: string; onClose: () => void }) {
  const access = useOrganizationCapabilities(project.organizationId);
  const sessionId = useAuthStore((state) => state.sessionId);
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<AnnotationHistoryEntry>();
  const history = useQuery(privateQueryKey(sessionId, "annotation-history", project.organizationId, project.id, detectionId, page),
    ({ signal }) => api.projects.getAnnotationHistory(project.organizationId, project.id, { detectionId, limit: 26, offset: page * 25 }, { signal }),
    { enabled: access.canReviewHistory, onError: access.reportError });
  const previewPolygons: MapPolygon[] = preview ? [preview.before, preview.after].flatMap((state, stage) =>
    state?.bounds?.map((rings, index) => ({ id: `${stage}:${index}`, highlighted: stage === 1,
      rings: rings.map((ring) => ring.map(planarToLatLng).filter((point) => point !== null)),
    })) ?? []) : [];
  return <>
    <Drawer title={detectionId ? "Result review history" : "Project annotation history"} open={access.canReviewHistory} onClose={onClose} size={520}>
      {history.isError ? <AccessFeedback error={history.error} onRetry={() => void history.refetch()} />
        : history.isLoading ? <p>Loading history…</p> : <>
          {history.data?.length === 0 && <Empty description="No annotation changes yet" />}
          <ol className="m-0 list-none divide-y divide-app-border p-0">
            {history.data?.slice(0, 25).map((entry) => <li key={entry.id} className="py-4">
              <Space wrap><Tag>{entry.action.toLowerCase()}</Tag><Typography.Text strong>{entry.actor}</Typography.Text></Space>
              <p className="my-2 text-sm text-muted">{new Date(entry.occurredAt).toLocaleString()}</p>
              <p className="my-2 text-sm">{entry.before?.bounds?.length ?? 0} → {entry.after.deleted ? 0 : entry.after.bounds?.length ?? 0} outlines · Version {entry.after.version}</p>
              <Typography.Text type="secondary" copyable className="!text-xs">{entry.detectionId}</Typography.Text>
              <div className="mt-2"><Button size="small" onClick={() => setPreview(entry)}>Compare outlines</Button></div>
            </li>)}
          </ol>
          <Space><Button disabled={page === 0 || history.isFetching} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page + 1}</span>
            <Button disabled={!history.data || history.data.length <= 25 || history.isFetching} onClick={() => setPage(page + 1)}>Next</Button></Space>
        </>}
    </Drawer>
    <Modal title="Annotation change" open={Boolean(preview)} onCancel={() => setPreview(undefined)} footer={null} width={900} destroyOnHidden>
      <p>Amber: previous outline · Cyan: saved outline{preview?.after.deleted ? " (deleted)" : ""}</p>
      <div className="h-[480px]">{preview && <Map mode="browse" rectangle={{ north: project.topLeft.latitude, west: project.topLeft.longitude,
        south: project.bottomRight.latitude, east: project.bottomRight.longitude }} polygons={previewPolygons} />}</div>
    </Modal>
  </>;
}
