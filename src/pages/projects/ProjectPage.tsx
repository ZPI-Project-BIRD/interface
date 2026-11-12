import { useMemo, useState, type ReactNode } from "react";
import { Button, Flex, Spin, Typography, message } from "antd";
import * as L from "leaflet";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Link, useNavigate, useParams } from "react-router";
import { api, type FeatureDetections } from "../../api";
import CrudPageLayout from "../../components/ProjectsPageLayout";
import { Map, type MapPolygon, type RectangleBounds } from "../../components/Map";
import { ProjectProgressCard } from "../../components/project/ProjectProgressCard";
import { ProjectDangerZone } from "../../components/project/ProjectDangerZone";
import { DetectionList, type SheetDetections } from "../../components/project/DetectionList";
import { calculateAreaKm2 } from "../../geo/area";
import { planarToLatLng, polygonAreaM2 } from "../../geo/projections";
import { isCurrentSession, useAuthStore, withSession } from "../../stores/authStore";
import { privateQueryKey } from "../../queryClient";
import { useOrganizationCapabilities } from "../../hooks/useOrganizationCapabilities";
import { AccessFeedback } from "../../components/AccessFeedback";
import { isPermissionDenied } from "../../permissions/organizationCapabilities";

const PROGRESS_REFRESH_SECONDS = 10;
const DETECTIONS_REFRESH_SECONDS = 30;

interface SheetGeometry extends SheetDetections {
  /** Building polygons as Leaflet rings (outer ring first). */
  polygons: L.LatLng[][][];
}

function toSheetGeometry({ featureId, detections }: FeatureDetections): SheetGeometry {
  const polygons = detections.flatMap((detection) => detection.bounds ?? []);

  return {
    featureId,
    buildingCount: polygons.length,
    footprintAreaM2: polygons.reduce((sum, polygon) => sum + polygonAreaM2(polygon), 0),
    polygons: polygons.map((rings) =>
      rings.map((ring) => ring.map(planarToLatLng).filter((point) => point !== null)),
    ),
  };
}

function formatPoint(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="m-0 text-right tabular-nums">{children}</dd>
    </div>
  );
}

function ProjectPage() {
  const { organizationId, projectId } = useParams<{ organizationId: string; projectId: string }>();
  const sessionId = useAuthStore((state) => state.sessionId);
  const username = useAuthStore((state) => state.user?.username);
  const access = useOrganizationCapabilities(organizationId);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [messageApi, messageContextHolder] = message.useMessage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const enabled = Boolean(organizationId && projectId && username);
  const projectQuery = useQuery(
    privateQueryKey(sessionId, "project", organizationId, projectId),
    ({ signal }) => api.projects.findById(organizationId!, projectId!, { signal }),
    { enabled, onError: access.reportError },
  );
  const projectLoaded = enabled && projectQuery.isSuccess && access.state !== "denied";
  const progressQuery = useQuery(
    privateQueryKey(sessionId, "project-progress", organizationId, projectId),
    ({ signal }) => api.projects.getProgress(organizationId!, projectId!, { signal }),
    { enabled: projectLoaded, refetchInterval: PROGRESS_REFRESH_SECONDS * 1000, onError: access.reportError },
  );
  const detectionsQuery = useQuery(
    privateQueryKey(sessionId, "project-detections", organizationId, projectId),
    ({ signal }) => api.projects.getDetections(organizationId!, projectId!, { signal }),
    { enabled: projectLoaded, refetchInterval: DETECTIONS_REFRESH_SECONDS * 1000, onError: access.reportError },
  );

  const deleteProjectMutation = useMutation(
    () => withSession(sessionId, () => api.projects.delete(organizationId!, projectId!)),
    {
      mutationKey: privateQueryKey(sessionId, "delete-project", organizationId, projectId),
      onSuccess: () => {
        if (!isCurrentSession(sessionId)) return;
        // Stop the polling queries before leaving so they do not refetch a deleted project.
        for (const key of ["project", "project-progress", "project-detections"]) {
          queryClient.removeQueries(privateQueryKey(sessionId, key, organizationId, projectId));
        }
        void queryClient.invalidateQueries(privateQueryKey(sessionId, "projects"));
        navigate("/projects", { replace: true });
      },
      onError: (error) => {
        if (!isCurrentSession(sessionId)) return;
        access.reportError(error);
        messageApi.error(error instanceof Error ? error.message : "Unable to delete the project.");
      },
    },
  );

  const project = projectQuery.data;
  const rectangle = useMemo<RectangleBounds | null>(
    () =>
      project
        ? {
            north: project.topLeft.latitude,
            east: project.bottomRight.longitude,
            south: project.bottomRight.latitude,
            west: project.topLeft.longitude,
          }
        : null,
    [project],
  );
  const sheets = useMemo(
    () =>
      detectionsQuery.data
        ?.map(toSheetGeometry)
        .filter((sheet) => sheet.buildingCount > 0)
        .toSorted((left, right) => right.buildingCount - left.buildingCount),
    [detectionsQuery.data],
  );
  const mapPolygons = useMemo<MapPolygon[]>(
    () =>
      sheets?.flatMap((sheet) =>
        sheet.polygons.map((rings, index) => ({
          id: `${sheet.featureId}:${index}`,
          rings,
          highlighted: sheet.featureId === selectedFeatureId,
        })),
      ) ?? [],
    [sheets, selectedFeatureId],
  );
  const selectedSheet = sheets?.find((sheet) => sheet.featureId === selectedFeatureId);
  const focusBounds = useMemo(
    () =>
      selectedSheet ? L.latLngBounds(selectedSheet.polygons.flatMap(([outer]) => outer)) : null,
    [selectedSheet],
  );

  const backButton = (
    <Link to="/projects">
      <Button>Back to projects</Button>
    </Link>
  );

  if (projectQuery.isLoading || !organizationId || !projectId) {
    return (
      <CrudPageLayout headerAction={backButton}>
        <Flex align="center" justify="center" className="min-h-[520px] border border-[#c9d0d5] bg-white">
          <Spin size="large" />
        </Flex>
      </CrudPageLayout>
    );
  }

  if (projectQuery.isError || !projectQuery.data || access.state === "denied") {
    return (
      <CrudPageLayout headerAction={backButton}>
        <AccessFeedback
          state={access.state === "denied" || isPermissionDenied(projectQuery.error) ? "denied" : "error"}
          error={projectQuery.error}
          onRetry={() => { void access.retry().then(() => projectQuery.refetch()); }}
        />
      </CrudPageLayout>
    );
  }

  const organization = access.organization!;
  const canDelete = access.canDeleteProject;
  const { topLeft, bottomRight } = projectQuery.data;
  return (
    <CrudPageLayout headerAction={backButton} fullBleed>
      {messageContextHolder}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex shrink-0 flex-col gap-3 overflow-y-auto border-[#c9d0d5] bg-[#f4f5f6] p-4 max-lg:max-h-[50dvh] max-lg:border-b lg:w-96 lg:border-r">
          <header>
            <Typography.Text className="!text-xs !font-semibold !tracking-[0.1em] !text-[#376f31] uppercase">
              {organization.name}
            </Typography.Text>
            <Typography.Title level={2} className="!mt-1 !mb-0 !text-2xl">
              {projectQuery.data.name}
            </Typography.Title>
          </header>

          <ProjectProgressCard
            progress={progressQuery.data}
            isLoading={progressQuery.isLoading}
            isError={progressQuery.isError}
            updatedAt={progressQuery.dataUpdatedAt || undefined}
            refreshSeconds={PROGRESS_REFRESH_SECONDS}
          />

          <section className="border border-[#c9d0d5] bg-white px-4 py-2">
            <dl className="m-0 divide-y divide-[#e3e7ea]">
              <InfoRow label="Area">{calculateAreaKm2(projectQuery.data).toFixed(2)} km²</InfoRow>
              <InfoRow label="North-west corner">
                {formatPoint(topLeft.latitude, topLeft.longitude)}
              </InfoRow>
              <InfoRow label="South-east corner">
                {formatPoint(bottomRight.latitude, bottomRight.longitude)}
              </InfoRow>
            </dl>
          </section>

          <DetectionList
            sheets={sheets}
            isLoading={detectionsQuery.isLoading}
            isError={detectionsQuery.isError}
            selectedFeatureId={selectedFeatureId}
            onSelect={setSelectedFeatureId}
          />

          {access.state === "error" && <AccessFeedback state="error" error={access.query.error} onRetry={() => void access.retry()} />}
          {canDelete && (
            <ProjectDangerZone
              projectName={projectQuery.data.name}
              isDeleting={deleteProjectMutation.isLoading}
              onDelete={() => { if (access.canDeleteProject) deleteProjectMutation.mutate(); }}
            />
          )}
        </aside>

        <section className="min-h-[360px] flex-1 bg-neutral-200">
          <Map mode="browse" rectangle={rectangle} polygons={mapPolygons} focusBounds={focusBounds} />
        </section>
      </div>
    </CrudPageLayout>
  );
}

export default ProjectPage;
