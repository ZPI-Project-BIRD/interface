import { useCallback, useMemo, useState } from "react";
import { Alert, Button, InputNumber, Modal, Popconfirm, Select, Space, Tag, Typography } from "antd";
import * as L from "leaflet";
import { useMutation, useQueryClient } from "react-query";
import { api, ApiError, type Detection, type FeatureDetections, type Project, type SourceFeature } from "../../api";
import { useOrganizationCapabilities } from "../../hooks/useOrganizationCapabilities";
import { privateQueryKey } from "../../queryClient";
import { isCurrentSession, useAuthStore, withSession } from "../../stores/authStore";
import { planarToLatLng } from "../../geo/projections";
import { annotationCrs, projectVertex, replaceOutline } from "../../geo/annotationCoordinates";
import { annotationDraftKey, type AnnotationDraft, type DraftUpdate } from "../../projects/annotationDrafts";
import { AnnotationNavigationGuard } from "./AnnotationNavigationGuard";
import { mergeAnnotation } from "../../projects/annotations";
import { Map, type MapPolygon } from "../Map";
import { AnnotationHistory } from "./AnnotationHistory";
import { MutationFeedback } from "../MutationFeedback";

type Change = { kind: "save"; draft: AnnotationDraft } | { kind: "delete" | "verify"; featureId: string; detection: Detection };

export function AnnotationWorkspace({ project, groups, features, selectedFeatureId }: {
  project: Project; groups?: FeatureDetections[]; features?: SourceFeature[]; selectedFeatureId: string | null;
}) {
  const organizationId = project.organizationId;
  const access = useOrganizationCapabilities(organizationId);
  const sessionId = useAuthStore((state) => state.sessionId);
  const client = useQueryClient();
  const draftKey = annotationDraftKey(project);
  const draft = useAuthStore((state) => state.annotationDrafts[draftKey]);
  const updateDraft = useAuthStore((state) => state.setAnnotationDraft);
  const setDraft = useCallback((update: DraftUpdate) => updateDraft(sessionId, draftKey, update), [sessionId, draftKey, updateDraft]);
  const [selection, setSelection] = useState<{ id: string; outline: number } | undefined>(() =>
    draft ? { id: draft.id ?? "new", outline: 0 } : undefined);
  const [drawing, setDrawing] = useState(false);
  const [corner, setCorner] = useState(0);
  const [history, setHistory] = useState<"all" | "selected">();
  const [modal, modalContext] = Modal.useModal();
  const records = useMemo(() => groups?.flatMap((group) => group.detections.map((detection) => ({ featureId: group.featureId, detection }))) ?? [], [groups]);
  const selected = records.find(({ detection }) => detection.id === selection?.id);
  const outlineIndex = selection?.outline ?? 0;
  const detectionKey = privateQueryKey(sessionId, "project-detections", organizationId, project.id);
  const change = useMutation((change: Change) => withSession(sessionId, async () => {
    if (!access.canAnnotate) throw new Error("You cannot change results in this organization.");
    if (change.kind === "save") {
      const value = change.draft;
      return value.id ? api.projects.updateDetection(organizationId, project.id, value.id, value.expectedVersion, value.bounds)
        : api.projects.createDetection(organizationId, project.id, value.featureId, value.bounds);
    }
    const { detection } = change;
    if (change.kind === "verify") return api.projects.verifyDetection(organizationId, project.id, detection.id, detection.version, !detection.verifiedBy);
    await api.projects.deleteDetection(organizationId, project.id, detection.id, detection.version);
    return { deletedId: detection.id };
  }), {
    mutationKey: privateQueryKey(sessionId, "annotation-change", organizationId, project.id), retry: false,
    onSuccess: async (result) => {
      await client.cancelQueries({ queryKey: detectionKey }, { silent: true });
      if (!isCurrentSession(sessionId)) return;
      if ("deletedId" in result) {
        client.setQueryData<FeatureDetections[]>(detectionKey, (current) => (current ?? []).map((group) => ({ ...group,
          detections: group.detections.filter(({ id }) => id !== result.deletedId),
        })).filter(({ detections }) => detections.length > 0));
        setSelection(undefined);
      } else {
        client.setQueryData<FeatureDetections[]>(detectionKey, (current) => mergeAnnotation(current ?? [], result));
        setSelection({ id: result.id, outline: 0 });
      }
      setDraft(undefined); setDrawing(false); setCorner(0);
      void client.invalidateQueries(detectionKey);
      void client.invalidateQueries(privateQueryKey(sessionId, "annotation-history", organizationId, project.id));
    },
    onError: (error) => access.reportError(error),
  });

  const choose = useCallback((id: string) => {
    const [detectionId, position] = id.split(":");
    const select = () => { setDraft(undefined); setDrawing(false); setSelection({ id: detectionId, outline: Number(position ?? 0) }); setCorner(0); change.reset(); };
    if (draft) modal.confirm({ title: "Discard unsaved outline changes?", onOk: select });
    else select();
  }, [draft, modal, change, setDraft]);
  const polygons = useMemo<MapPolygon[]>(() => records.flatMap(({ featureId, detection }) => {
    if (draft?.id === detection.id) return [];
    return detection.bounds?.map((rings, index) => ({ id: `${detection.id}:${index}`,
      highlighted: selection?.id === detection.id || featureId === selectedFeatureId,
      rings: rings.map((ring) => ring.map(planarToLatLng).filter((point) => point !== null)),
    })) ?? [];
  }), [records, draft?.id, selection?.id, selectedFeatureId]);
  const draftPolygons = useMemo<MapPolygon[]>(() => draft?.bounds.flatMap((rings, index) => index === outlineIndex && access.canAnnotate ? [] : [{
    id: `draft:${index}`, highlighted: true, rings: rings.map((ring) => ring.map(planarToLatLng).filter((point) => point !== null)),
  }]) ?? [], [draft, outlineIndex, access.canAnnotate]);
  const editableRings = useMemo(() => draft?.bounds[outlineIndex]?.map((ring) => ring.map(planarToLatLng).filter((point) => point !== null)), [draft, outlineIndex]);
  const updateRings = useCallback((rings: L.LatLng[][]) => {
    setDraft((value) => value && ({ ...value, bounds: replaceOutline(value.bounds, outlineIndex, rings, value.crs) }));
  }, [outlineIndex, setDraft]);
  const finishDrawing = useCallback((ring: L.LatLng[]) => {
    setDraft((value) => value && ({ ...value, bounds: [...value.bounds, [ring.map((point) => projectVertex(point, value.crs))]] }));
    setSelection((value) => ({ id: value?.id ?? "new", outline: draft?.bounds.length ?? 0 }));
    setDrawing(false); setCorner(0);
  }, [draft?.bounds.length, setDraft]);
  const cancelDrawing = useCallback(() => setDrawing(false), []);
  const focus = useMemo(() => {
    const bounds = selected?.detection.bounds
      ?? records.filter(({ featureId }) => featureId === selectedFeatureId).flatMap(({ detection }) => detection.bounds ?? []);
    const points = bounds?.flatMap((polygon) => polygon[0]?.map(planarToLatLng).filter((point) => point !== null) ?? []) ?? [];
    return points.length ? L.latLngBounds(points) : null;
  }, [selected?.detection.bounds, selectedFeatureId, records]);
  const rectangle = useMemo(() => ({ north: project.topLeft.latitude, west: project.topLeft.longitude,
    south: project.bottomRight.latitude, east: project.bottomRight.longitude }), [project]);
  const discard = () => { setDraft(undefined); setDrawing(false); change.reset(); };
  const conflict = change.error instanceof ApiError && change.error.status === 409;
  const uncertain = change.error instanceof ApiError && (change.error.status === 0 || change.error.status >= 500);
  const blocked = change.isLoading || conflict || uncertain || !access.canAnnotate;
  const loadLatest = async () => {
    await client.refetchQueries(detectionKey, { active: true }, { throwOnError: true });
    if (!isCurrentSession(sessionId)) return;
    discard();
  };
  const startEditing = () => {
    if (!selected?.detection.bounds?.length) return;
    change.reset();
    setSelection({ id: selected.detection.id, outline: Math.min(outlineIndex, selected.detection.bounds.length - 1) });
    try { setDraft({ id: selected.detection.id, featureId: selected.featureId, expectedVersion: selected.detection.version,
      bounds: structuredClone(selected.detection.bounds), crs: annotationCrs(selected.detection.bounds) }); }
    catch (error) { modal.error({ title: "Cannot edit this result", content: error instanceof Error ? error.message : "Unsupported geometry" }); }
  };
  const point = editableRings?.[0]?.[corner];
  const setCoordinate = (coordinate: "lat" | "lng", value: number | null) => {
    if (value === null || !editableRings) return;
    const rings = editableRings.map((ring) => ring.map((point) => L.latLng(point.lat, point.lng)));
    rings[0][corner][coordinate] = value;
    if (corner === 0) rings[0][rings[0].length - 1] = rings[0][0];
    updateRings(rings);
  };
  return <div className="flex h-full min-h-[500px] flex-col">
    {modalContext}
    <AnnotationNavigationGuard hasDraft={Boolean(draft)} pending={change.isLoading} onDiscard={discard} />
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-app-border bg-surface px-4 py-3">
      <Typography.Text strong>Project results</Typography.Text>
      <Space wrap>
        {access.canReviewHistory && <Button onClick={() => setHistory("all")}>Annotation history</Button>}
        {access.canAnnotate && <Button type="primary" disabled={Boolean(draft) || blocked || !features?.length} onClick={() => {
          change.reset(); setDraft({ featureId: selectedFeatureId ?? features![0].id, expectedVersion: 0, bounds: [], crs: "EPSG:2180" });
          setSelection({ id: "new", outline: 0 }); setDrawing(true);
        }}>Add detection</Button>}
      </Space>
    </div>
    <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
      <div className="relative min-h-[400px] flex-1">
        <Map mode="browse" rectangle={rectangle}
          polygons={[...polygons, ...draftPolygons]} focusBounds={focus}
          onPolygonSelect={draft || drawing ? undefined : choose}
          editableRings={draft && access.canAnnotate && !drawing && !change.isLoading ? editableRings : undefined}
          onRingsChange={updateRings} drawingPolygon={drawing && access.canAnnotate && !change.isLoading}
          onPolygonDraw={finishDrawing} onPolygonDrawCancel={cancelDrawing} />
        {drawing && <div className="app-card absolute top-3 left-14 z-[500] max-w-sm p-3 shadow-sm">Click each corner, then click the first corner or press Enter to finish. Escape cancels drawing.</div>}
      </div>
      <aside className="max-h-[45dvh] overflow-y-auto border-app-border bg-surface p-4 max-xl:border-t xl:max-h-none xl:w-80 xl:border-l">
        <Typography.Title level={4} className="!mt-0">{draft ? "Edit outlines" : "Inspect a result"}</Typography.Title>
        {!draft && <Select className="w-full" showSearch optionFilterProp="label" placeholder="Click an outline or select a result"
          value={selected?.detection.id} onChange={(id) => choose(id)} options={records.map(({ detection, featureId }, index) => ({
            value: detection.id, label: `${index + 1}. ${featureId} · ${detection.verifiedBy ? "Verified" : "Unreviewed"}`,
          }))} />}
        {selected && !draft && <>
          <p className="break-all text-sm">Source sheet: {selected.featureId}</p>
          <Space wrap><Tag>{selected.detection.source === "MANUAL" ? "Manual" : "Automatic"}</Tag><Tag color={selected.detection.verifiedBy ? "green" : "default"}>{selected.detection.verifiedBy ? "Verified" : "Unreviewed"}</Tag></Space>
          <p className="text-sm">{selected.detection.bounds?.length ?? 0} outline(s) in this result. Verification and deletion apply to all of them.</p>
          {selected.detection.verifiedBy && <p className="text-sm">Reviewed by {selected.detection.verifiedBy}{selected.detection.verifiedAt ? ` · ${new Date(selected.detection.verifiedAt).toLocaleString()}` : ""}</p>}
          {access.canAnnotate && <Space direction="vertical" className="w-full">
            <Button disabled={blocked || !selected.detection.bounds?.length} onClick={startEditing}>Edit outlines</Button>
            <Button disabled={blocked} onClick={() => change.mutate({ kind: "verify", ...selected })}>{selected.detection.verifiedBy ? "Clear verification" : "Mark verified"}</Button>
            <Popconfirm title={`Delete all ${selected.detection.bounds?.length ?? 0} outline(s) in this result?`} okButtonProps={{ danger: true }}
              onConfirm={() => change.mutateAsync({ kind: "delete", ...selected })}>
              <Button danger disabled={blocked}>Delete result</Button>
            </Popconfirm>
          </Space>}
          {access.canReviewHistory && <Button className="mt-3" onClick={() => setHistory("selected")}>Review this result's history</Button>}
        </>}
        {draft && <>
          {!access.canAnnotate && <Alert type="warning" title="Editing permissions unavailable" description="Your draft is kept. Refresh access or cancel editing." />}
          {!draft.id && <><label htmlFor="manual-source">Source sheet</label><Select id="manual-source" className="mb-3 w-full" value={draft.featureId} disabled={blocked}
            onChange={(featureId) => setDraft({ ...draft, featureId })} options={features?.map(({ id }) => ({ value: id, label: id }))} /></>}
          {draft.bounds.length > 0 && <Select className="mb-3 w-full" value={outlineIndex} disabled={blocked || drawing} onChange={(outline) => { setSelection({ id: draft.id ?? "new", outline }); setCorner(0); }}
            options={draft.bounds.map((_, index) => ({ value: index, label: `Outline ${index + 1} of ${draft.bounds.length}` }))} />}
          <p className="text-sm">Drag the white corner handles to correct the selected outline. Saving geometry clears its previous verification.</p>
          {point && !drawing && <div className="mb-3 grid gap-2">
            <Select aria-label="Corner" value={corner} onChange={setCorner} disabled={blocked} options={editableRings?.[0].slice(0, -1).map((_, index) => ({ value: index, label: `Corner ${index + 1}` }))} />
            <label className="text-sm">Latitude<InputNumber aria-label="Corner latitude" className="!w-full" value={point.lat} min={-90} max={90} precision={7} disabled={blocked} onChange={(value) => setCoordinate("lat", value)} /></label>
            <label className="text-sm">Longitude<InputNumber aria-label="Corner longitude" className="!w-full" value={point.lng} min={-180} max={180} precision={7} disabled={blocked} onChange={(value) => setCoordinate("lng", value)} /></label>
          </div>}
          <Space wrap>
            <Button disabled={drawing || blocked} onClick={() => setDrawing(true)}>Draw another outline</Button>
            {draft.bounds.length > 1 && <Button danger disabled={drawing || blocked} onClick={() => {
              setDraft({ ...draft, bounds: draft.bounds.filter((_, index) => index !== outlineIndex) }); setSelection({ id: draft.id ?? "new", outline: 0 }); setCorner(0);
            }}>Remove selected outline</Button>}
            {drawing && <Button onClick={cancelDrawing}>Stop drawing</Button>}
            <Button type="primary" disabled={!draft.featureId || !draft.bounds.length || drawing || conflict || uncertain || !access.canAnnotate}
              loading={change.isLoading} onClick={() => change.mutate({ kind: "save", draft })}>Save outlines</Button>
            <Popconfirm title="Discard unsaved changes?" onConfirm={discard}><Button disabled={change.isLoading}>Cancel editing</Button></Popconfirm>
          </Space>
        </>}
        {!selected && !draft && <p className="text-sm text-muted">Select a detected outline on the map to inspect its review status.</p>}
        <MutationFeedback error={change.error} conflict="This result changed while you were editing. Your draft is kept. Discard it and reload before making another change." />
        {uncertain && <Alert className="my-3" type="warning" title="The request may have completed" description="Reload results and check the saved data before trying again." />}
        {(conflict || uncertain) && <Popconfirm title="Discard the draft and reload saved results?" onConfirm={loadLatest}><Button>Reload saved results</Button></Popconfirm>}
      </aside>
    </div>
    {history && access.canReviewHistory && <AnnotationHistory key={history === "selected" ? selection?.id : "all"} project={project}
      detectionId={history === "selected" ? selection?.id : undefined} onClose={() => setHistory(undefined)} />}
  </div>;
}
