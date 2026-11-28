import { useCallback, useMemo, useState } from "react";
import { ArrowLeftOutlined, CloseOutlined, SelectOutlined } from "@ant-design/icons";
import { Alert, Button, InputNumber, Modal, Popconfirm, Select, Space, Tag, Typography } from "antd";
import * as L from "leaflet";
import { useMutation, useQueryClient } from "react-query";
import { api, ApiError, type Detection, type FeatureDetections, type Project, type SourceFeature } from "../../api";
import { useOrganizationCapabilities } from "../../hooks/useOrganizationCapabilities";
import { privateQueryKey } from "../../queryClient";
import { isCurrentSession, useAuthStore, withSession } from "../../stores/authStore";
import { planarToLatLng } from "../../geo/projections";
import { detectionLayers } from "../../geo/detectionLayers";
import { detectionDetails } from "../../geo/detectionDetails";
import { canEditDetection, removeDetectionShapes, detectionCount, detectionGeometry, detectionPoints, detectionShapePoints, DETECTION_STYLES, DETECTION_TYPES } from "../../projects/detections";
import type { DetectionType } from "../../api";
import { annotationCrs, projectVertex, removeOutlineVertex, replaceOutline } from "../../geo/annotationCoordinates";
import { annotationDraftKey, annotationBounds, editableGeometry, removeDraftShapes, type AnnotationDraft, type DraftUpdate } from "../../projects/annotationDrafts";
import { AnnotationNavigationGuard } from "./AnnotationNavigationGuard";
import { mergeAnnotation } from "../../projects/annotations";
import { Map } from "../Map";
import { MapToolButton } from "../MapToolButton";
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
  const [selection, setSelection] = useState<{ id: string; outline: number; scope?: "result" } | undefined>(() =>
    draft ? { id: draft.id ?? "new", outline: 0 } : undefined);
  const [drawing, setDrawing] = useState(false);
  const [corner, setCorner] = useState(0);
  const [ringIndex, setRingIndex] = useState(0);
  const selectedVertex = useMemo(() => ({ ringIndex, index: corner }), [ringIndex, corner]);
  const selectVertex = useCallback((ring: number, vertex: number) => { setRingIndex(ring); setCorner(vertex); }, []);
  const [history, setHistory] = useState<"all" | "selected">();
  const [visibleTypes, setVisibleTypes] = useState<ReadonlySet<DetectionType>>(() => new Set(DETECTION_TYPES));
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const [modal, modalContext] = Modal.useModal();
  const records = useMemo(() => groups?.flatMap((group) => group.detections.map((detection) => ({ featureId: group.featureId, detection }))) ?? [], [groups]);
  const selected = records.find(({ detection }) => detection.id === selection?.id);
  const outlineIndex = selection?.outline ?? 0;
  const editingRoad = draft?.geometryType === "road";
  const detectionKey = privateQueryKey(sessionId, "project-detections", organizationId, project.id);
  const change = useMutation((change: Change) => withSession(sessionId, async () => {
    if (!access.canAnnotate) throw new Error("You cannot change results in this organization.");
    if (change.kind === "save") {
      const value = change.draft;
      return value.id ? api.projects.updateDetection(organizationId, project.id, value.id, value.expectedVersion, annotationBounds(value))
        : api.projects.createDetection(organizationId, project.id, value.featureId, annotationBounds(value));
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
        setSelection((current) => (current?.id === result.id ? current : { id: result.id, outline: 0 }));
      }
      setDraft(undefined); setDrawing(false); setRingIndex(0); setCorner(0);
      void client.invalidateQueries(detectionKey);
      void client.invalidateQueries(privateQueryKey(sessionId, "annotation-history", organizationId, project.id));
    },
    onError: (error) => access.reportError(error),
  });

  const removal = useMutation((outlines: string[]) => withSession(sessionId, async () => {
    if (!access.canAnnotate) throw new Error("You cannot change results in this organization.");
    const byDetection = new globalThis.Map<string, Set<number>>();
    for (const outline of outlines) {
      const [detectionId, position] = outline.split(":");
      byDetection.set(detectionId, (byDetection.get(detectionId) ?? new Set()).add(Number(position)));
    }
    const failed = new Set<string>();
    let firstError: unknown;
    for (const [detectionId, positions] of byDetection) {
      const detection = records.find((record) => record.detection.id === detectionId)?.detection;
      if (!detection || !canEditDetection(detection.bounds)) continue;
      const remaining = removeDetectionShapes(detection.bounds, positions);
      try {
        if (detectionCount(remaining)) await api.projects.updateDetection(organizationId, project.id, detection.id, detection.version, remaining);
        else await api.projects.deleteDetection(organizationId, project.id, detection.id, detection.version);
      } catch (error) {
        failed.add(detectionId);
        firstError ??= error;
      }
    }
    return { failed, firstError, remaining: outlines.filter((outline) => failed.has(outline.split(":")[0])) };
  }), {
    mutationKey: privateQueryKey(sessionId, "annotation-removal", organizationId, project.id), retry: false,
    onSuccess: async ({ firstError, remaining }) => {
      if (firstError) access.reportError(firstError);
      await client.invalidateQueries(detectionKey);
      void client.invalidateQueries(privateQueryKey(sessionId, "annotation-history", organizationId, project.id));
      if (!isCurrentSession(sessionId)) return;
      setSelection(undefined);
      setPicked((current) => current && new Set(remaining));
    },
    onError: (error) => access.reportError(error),
  });

  const choose = useCallback((id: string) => {
    const [detectionId, position] = id.split(":");
    const select = () => { setDraft(undefined); setDrawing(false); setSelection({ id: detectionId, outline: Number(position ?? 0) }); setRingIndex(0); setCorner(0); change.reset(); removal.reset(); };
    if (draft) modal.confirm({ title: "Discard unsaved outline changes?", onOk: select });
    else select();
  }, [draft, modal, change, removal, setDraft]);
  const layers = useMemo(() => records.flatMap(({ featureId, detection }, resultIndex) => {
    const geometry = detectionGeometry(detection.bounds);
    if (draft?.id === detection.id || !visibleTypes.has(geometry.type)) return [];
    return [detectionLayers(detection.bounds, detection.id, {
      highlighted: (index) => picked ? picked.has(`${detection.id}:${index}`)
        : selection?.id === detection.id && (selection.scope === "result" || selection.outline === index) || featureId === selectedFeatureId,
      title: `${DETECTION_STYLES[geometry.type].singular} result ${resultIndex + 1}`,
      rows: [
        { label: "Source", value: detection.source === "MANUAL" ? "Manual" : "Automatic" },
        { label: "Status", value: detection.verifiedBy ? `Verified by ${detection.verifiedBy}` : "Unreviewed" },
        { label: "Sheet", value: featureId },
      ],
    })];
  }), [records, draft?.id, selection, selectedFeatureId, picked, visibleTypes]);
  const polygons = useMemo(() => layers.flatMap(({ polygons }) => polygons), [layers]);
  const lines = useMemo(() => layers.flatMap(({ lines }) => lines), [layers]);
  const editableIds = useMemo(() => new Set(records.filter(({ detection }) => canEditDetection(detection.bounds))
    .map(({ detection }) => detection.id)), [records]);
  const toggleOutline = useCallback((id: string) => setPicked((current) => {
    if (!current || !editableIds.has(id.split(":")[0])) return current;
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  }), [editableIds]);
  const selectArea = useCallback((bounds: L.LatLngBounds) => setPicked((current) => {
    if (!current) return current;
    const shapes = [...polygons.map(({ id, rings }) => ({ id, points: rings[0] })), ...lines];
    const inside = shapes.filter(({ id, points }) => editableIds.has(id.split(":")[0]) && points?.length && points.every((point) => bounds.contains(point)));
    return new Set([...current, ...inside.map(({ id }) => id)]);
  }), [polygons, lines, editableIds]);
  const pickedIds = picked ? [...polygons, ...lines].filter(({ id }) => picked.has(id)).map(({ id }) => id) : [];
  const pickedResults = new Set(pickedIds.map((id) => id.split(":")[0]));
  const partiallyPicked = records.filter(({ detection }) => pickedResults.has(detection.id)
    && detectionGeometry(detection.bounds).coordinates.some((_, index) => !picked?.has(`${detection.id}:${index}`)));
  const draftLayers = useMemo(() => {
    if (!draft) return { polygons: [], lines: [] };
    const layers = detectionLayers(annotationBounds(draft), "draft", { highlighted: () => true, title: "Draft" });
    return { polygons: layers.polygons.filter(({ id }) => !access.canAnnotate || id !== `draft:${outlineIndex}`),
      lines: layers.lines.filter(({ id }) => !access.canAnnotate || id !== `draft:${outlineIndex}`) };
  }, [draft, outlineIndex, access.canAnnotate]);
  const editableRings = useMemo(() => draft?.bounds[outlineIndex]?.map((ring) => ring.map(planarToLatLng).filter((point) => point !== null)), [draft, outlineIndex]);
  const updateRings = useCallback((rings: L.LatLng[][]) => {
    setDraft((value) => value && ({ ...value, bounds: replaceOutline(value.bounds, outlineIndex, rings, value.crs) }));
  }, [outlineIndex, setDraft]);
  const finishDrawing = useCallback((ring: L.LatLng[]) => {
    setDraft((value) => value && ({ ...value, bounds: [...value.bounds, [ring.map((point) => projectVertex(point, value.crs))]],
      roadWidths: value.geometryType === "road" ? [...value.roadWidths ?? [], null] : undefined }));
    setSelection((value) => ({ id: value?.id ?? "new", outline: draft?.bounds.length ?? 0 }));
    setDrawing(false); setRingIndex(0); setCorner(0);
  }, [draft?.bounds.length, setDraft]);
  const cancelDrawing = useCallback(() => setDrawing(false), []);
  const focus = useMemo(() => {
    const points = (selected ? selection?.scope === "result" ? detectionPoints(selected.detection.bounds)
      : detectionShapePoints(selected.detection.bounds, selection?.outline ?? 0)
      : records.filter(({ featureId }) => featureId === selectedFeatureId).flatMap(({ detection }) => detectionPoints(detection.bounds)))
      .map(planarToLatLng).filter((point) => point !== null);
    return points.length ? L.latLngBounds(points) : null;
  }, [selection?.scope, selection?.outline, selected, selectedFeatureId, records]);
  const mapPolygons = useMemo(() => [...polygons, ...draftLayers.polygons], [polygons, draftLayers]);
  const mapLines = useMemo(() => [...lines, ...draftLayers.lines], [lines, draftLayers]);
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
    if (!selected || !canEditDetection(selected.detection.bounds)) return;
    change.reset();
    setSelection({ id: selected.detection.id, outline: Math.min(outlineIndex, detectionCount(selected.detection.bounds) - 1) });
    try {
      const geometry = editableGeometry(selected.detection.bounds);
      setDraft({ id: selected.detection.id, featureId: selected.featureId, expectedVersion: selected.detection.version,
        ...geometry, crs: annotationCrs(geometry.bounds) });
    }
    catch (error) { modal.error({ title: "Cannot edit this result", content: error instanceof Error ? error.message : "Unsupported geometry" }); }
  };
  const outlineCount = selected ? detectionCount(selected.detection.bounds) : 0;
  const selectedGeometry = selected ? detectionGeometry(selected.detection.bounds) : undefined;
  const selectedEditable = selected ? canEditDetection(selected.detection.bounds) : false;
  const selectedDetails = selected && outlineIndex < outlineCount ? detectionDetails(selected.detection.bounds, outlineIndex) : undefined;
  const closeSelection = () => { setSelection(undefined); change.reset(); removal.reset(); };
  const point = editableRings?.[ringIndex]?.[corner];
  const setCoordinate = (coordinate: "lat" | "lng", value: number | null) => {
    if (value === null || !editableRings) return;
    const rings = editableRings.map((ring) => ring.map((point) => L.latLng(point.lat, point.lng)));
    rings[ringIndex][corner][coordinate] = value;
    if (!editingRoad && corner === 0) rings[ringIndex][rings[ringIndex].length - 1] = rings[ringIndex][0];
    updateRings(rings);
  };
  const removeVertex = useCallback((ringIndex: number, vertexIndex: number) => {
    if (blocked || drawing) return;
    setDraft((value) => {
      if (!value) return value;
      const bounds = removeOutlineVertex(value.bounds, outlineIndex, ringIndex, vertexIndex, value.geometryType !== "road");
      return bounds === value.bounds ? value : { ...value, bounds };
    });
    setRingIndex(ringIndex); setCorner(0);
  }, [blocked, drawing, outlineIndex, setDraft]);
  return <div className="flex h-full min-h-[500px] flex-col">
    {modalContext}
    <AnnotationNavigationGuard hasDraft={Boolean(draft)} pending={change.isLoading} onDiscard={discard} />
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-app-border bg-surface px-4 py-3">
      <Typography.Text strong>Project results</Typography.Text>
      <Space wrap>
        {access.canReviewHistory && <Button onClick={() => setHistory("all")}>Annotation history</Button>}
        {access.canAnnotate && <Button type="primary" disabled={Boolean(picked) || Boolean(draft) || blocked || !features?.length} onClick={() => {
          change.reset(); setDraft({ featureId: selectedFeatureId ?? features![0].id, expectedVersion: 0, bounds: [], crs: "EPSG:2180" });
          setSelection({ id: "new", outline: 0 }); setDrawing(true);
        }}>Add detection</Button>}
      </Space>
    </div>
    <div className="flex flex-wrap gap-2 border-b border-app-border bg-surface px-4 py-2" aria-label="Detection layers">
      {DETECTION_TYPES.map((type) => <Button key={type} size="small" aria-pressed={visibleTypes.has(type)}
        disabled={Boolean(draft) || drawing || removal.isLoading}
        onClick={() => {
          setVisibleTypes((current) => { const next = new Set(current); if (!next.delete(type)) next.add(type); return next; });
          setPicked(null); setSelection(undefined);
        }}>
        <span aria-hidden style={{ backgroundColor: DETECTION_STYLES[type].color, opacity: visibleTypes.has(type) ? 1 : 0.25 }} className="inline-block h-2.5 w-2.5 rounded-full" />
        {DETECTION_STYLES[type].label}
      </Button>)}
    </div>
    <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
      <div className="relative min-h-[400px] flex-1">
        <Map mode="browse" rectangle={rectangle}
          polygons={mapPolygons} lines={mapLines} closedGeometry={!editingRoad} focusBounds={focus} measurable
          tools={access.canAnnotate && <MapToolButton label={picked ? "Done selecting shapes" : "Select shapes to remove"} icon={<SelectOutlined />}
            active={Boolean(picked)} disabled={Boolean(draft) || drawing || removal.isLoading}
            onClick={() => { removal.reset(); setPicked(picked ? null : new Set()); }} />}
          onPolygonSelect={picked ? (removal.isLoading ? undefined : toggleOutline) : draft || drawing ? undefined : choose}
          onAreaSelect={picked && !removal.isLoading ? selectArea : undefined}
          editableRings={draft && access.canAnnotate && !drawing && !change.isLoading ? editableRings : undefined}
          onRingsChange={updateRings} drawingPolygon={drawing && access.canAnnotate && !change.isLoading}
          onVertexRemove={!blocked && !drawing ? removeVertex : undefined}
          onVertexSelect={selectVertex} selectedVertex={selectedVertex}
          onPolygonDraw={finishDrawing} onPolygonDrawCancel={cancelDrawing} />
        {picked && <div className="app-card absolute top-3 left-14 z-[500] max-w-sm p-3 shadow-sm">Drag across the map to select shapes fully inside the box. Click a shape to add or remove it.</div>}
        {drawing && <div className="app-card absolute top-3 left-14 z-[500] max-w-sm p-3 shadow-sm">{editingRoad ? "Click each road node, then press Enter or double-click to finish." : "Click each corner, then click the first corner or press Enter to finish."} Escape cancels drawing.</div>}
      </div>
      <aside className="max-h-[45dvh] overflow-y-auto border-app-border bg-surface p-4 max-xl:border-t xl:max-h-none xl:w-80 xl:border-l">
        {picked ? <>
          <Typography.Title level={4} className="!mt-0">Select shapes</Typography.Title>
          <p className="text-sm">{pickedIds.length} shape(s) selected across {pickedResults.size} result(s).</p>
          {partiallyPicked.length > 0 && <p className="text-sm text-muted">Removing only some outlines of a result saves its remaining outlines as a correction, which clears that result's verification.</p>}
          {removal.data && removal.data.failed.size > 0 && <Alert className="my-3" type="error" title={`${removal.data.failed.size} result(s) could not be changed`}
            description="Their outlines are still selected. They may have changed since loading; check the map and try again." />}
          <Space wrap>
            <Popconfirm title={`Remove ${pickedIds.length} shape(s)?`} okButtonProps={{ danger: true }} disabled={!pickedIds.length}
              onConfirm={() => removal.mutateAsync(pickedIds)}>
              <Button danger disabled={!pickedIds.length} loading={removal.isLoading}>Remove selected</Button>
            </Popconfirm>
            <Button disabled={!pickedIds.length || removal.isLoading} onClick={() => setPicked(new Set())}>Clear selection</Button>
          </Space>
        </> : <>
        {draft && <Typography.Title level={4} className="!mt-0">{editingRoad ? "Edit roads" : `Edit ${DETECTION_STYLES[draft.geometryType ?? "building"].singular.toLowerCase()} outlines`}</Typography.Title>}
        {!draft && records.length > 0 && <div className="mb-4 grid gap-2">
          <label htmlFor="detection-result" className="text-sm">Detection result</label>
          <Select virtual={false} id="detection-result" aria-label="Detection result" placeholder="Choose a detection result" value={selected?.detection.id}
            disabled={removal.isLoading} showSearch optionFilterProp="label" onChange={(id) => choose(`${id}:0`)}
            options={records.flatMap(({ detection }, index) => {
              const geometry = detectionGeometry(detection.bounds);
              return visibleTypes.has(geometry.type) && geometry.coordinates.length ? [{ value: detection.id,
                label: `${DETECTION_STYLES[geometry.type].singular} result ${index + 1} (${geometry.coordinates.length} shapes)` }] : [];
            })} />
          {selected && outlineCount > 1 && <Select virtual={false} aria-label="Detected shape" value={outlineIndex} disabled={removal.isLoading}
            onChange={(index) => choose(`${selected.detection.id}:${index}`)}
            options={Array.from({ length: outlineCount }, (_, index) => ({ value: index,
              label: `${selectedGeometry?.type === "road" ? "Road" : "Outline"} ${index + 1} of ${outlineCount}` }))} />}
        </div>}
        {!draft && !selected && <>
          <Typography.Title level={4} className="!mt-0">Outlines</Typography.Title>
          <p className="text-sm text-muted">Click a building, forest, water polygon or road on the map to see its details.</p>
        </>}
        {selected && !draft && selection?.scope !== "result" && <>
          <div className="flex items-start justify-between gap-2">
            <Typography.Title level={4} className="!mt-0">{selectedGeometry?.type === "road" ? "Road" : "Outline"} {outlineIndex + 1} of {outlineCount}</Typography.Title>
            <Button type="text" size="small" aria-label="Close outline" icon={<CloseOutlined />} onClick={closeSelection} />
          </div>
          {selectedDetails && <dl className="my-3 divide-y divide-app-border text-sm">
            {[...selectedDetails.rows,
              { label: "Source", value: selected.detection.source === "MANUAL" ? "Manual" : "Automatic" },
              { label: "Status", value: selected.detection.verifiedBy ? `Verified by ${selected.detection.verifiedBy}` : "Unreviewed" },
              { label: "Sheet", value: selected.featureId }].map(({ label, value }) => <div key={label} className="flex justify-between gap-3 py-1.5">
              <dt className="text-muted">{label}</dt><dd className="m-0 break-all text-right tabular-nums">{value}</dd>
            </div>)}
          </dl>}
          {access.canAnnotate && selectedEditable && <Space wrap>
            <Button disabled={blocked || removal.isLoading} onClick={startEditing}>{selectedGeometry?.type === "road" ? "Edit road" : "Edit outline"}</Button>
            <Popconfirm title={selectedGeometry?.type === "road" ? "Remove this road?" : "Remove this outline?"} okButtonProps={{ danger: true }}
              description={outlineCount === 1 ? "It is the only shape in its result, so the result is deleted."
                : `The other ${outlineCount - 1} shape(s) in its result are kept${selected.detection.verifiedBy ? ", but the result's verification is cleared" : ""}.`}
              onConfirm={() => removal.mutateAsync([`${selected.detection.id}:${outlineIndex}`])}>
              <Button danger disabled={blocked} loading={removal.isLoading}>{selectedGeometry?.type === "road" ? "Remove road" : "Remove outline"}</Button>
            </Popconfirm>
          </Space>}

          {removal.data && removal.data.failed.size > 0 && <Alert className="my-3" type="error" title="The outline could not be removed"
            description="Its result may have changed since loading. Check the map and try again." />}
          <div className="mt-6 border-t border-app-border pt-3">
            <Button type="link" size="small" className="!px-0" onClick={() => setSelection({ ...selection!, scope: "result" })}>
              Manage the whole result ({outlineCount} {selectedGeometry?.type === "road" ? "road" : "outline"}{outlineCount === 1 ? "" : "s"})</Button>
          </div>
        </>}
        {selected && !draft && selection?.scope === "result" && <>
          <div className="flex items-start justify-between gap-2">
            <Typography.Title level={4} className="!mt-0">Whole result</Typography.Title>
            <Button type="text" size="small" aria-label="Close result" icon={<CloseOutlined />} onClick={closeSelection} />
          </div>
          <Button type="link" size="small" className="!mb-2 !px-0" icon={<ArrowLeftOutlined />} onClick={() => setSelection({ id: selected.detection.id, outline: outlineIndex })}>
            Back to {selectedGeometry?.type === "road" ? "road" : "outline"} {outlineIndex + 1}</Button>
          <p className="break-all text-sm">Source sheet: {selected.featureId}</p>
          <Space wrap><Tag>{selected.detection.source === "MANUAL" ? "Manual" : "Automatic"}</Tag><Tag color={selected.detection.verifiedBy ? "green" : "default"}>{selected.detection.verifiedBy ? "Verified" : "Unreviewed"}</Tag></Space>
          <p className="text-sm">{outlineCount} {selectedGeometry?.type === "road" ? "road(s)" : "outline(s)"} in this result. Actions apply to all of them.</p>
          {selected.detection.verifiedBy && <p className="text-sm">Reviewed by {selected.detection.verifiedBy}{selected.detection.verifiedAt ? ` · ${new Date(selected.detection.verifiedAt).toLocaleString()}` : ""}</p>}

          {access.canAnnotate && <Space direction="vertical" className="w-full">
            <Button disabled={blocked || !selectedEditable || !outlineCount} onClick={startEditing}>{selectedGeometry?.type === "road" ? "Edit roads" : "Edit outlines"}</Button>
            <Button disabled={blocked || !selectedEditable} onClick={() => change.mutate({ kind: "verify", ...selected })}>{selected.detection.verifiedBy ? "Clear verification" : "Mark verified"}</Button>
            <Popconfirm title={`Delete all ${outlineCount} shapes in this result?`} okButtonProps={{ danger: true }}
              description="This removes every shape in this result."
              onConfirm={() => change.mutateAsync({ kind: "delete", ...selected })}>
              <Button danger disabled={blocked}>Delete result</Button>
            </Popconfirm>
          </Space>}
          {access.canReviewHistory && <Button className="mt-3" onClick={() => setHistory("selected")}>Review this result's history</Button>}
        </>}
        {draft && <>
          {!access.canAnnotate && <Alert type="warning" title="Editing permissions unavailable" description="Your draft is kept. Refresh access or cancel editing." />}
          {!draft.id && <><label htmlFor="manual-source">Source sheet</label><Select virtual={false} id="manual-source" className="mb-3 w-full" value={draft.featureId} disabled={blocked}
            onChange={(featureId) => setDraft({ ...draft, featureId })} options={features?.map(({ id }) => ({ value: id, label: id }))} /></>}
          {draft.bounds.length > 0 && <Select virtual={false} aria-label="Editing shape" className="mb-3 w-full" value={outlineIndex} disabled={blocked || drawing} onChange={(outline) => { setSelection({ id: draft.id ?? "new", outline }); setRingIndex(0); setCorner(0); }}
            options={draft.bounds.map((_, index) => ({ value: index, label: `${editingRoad ? "Road" : "Outline"} ${index + 1} of ${draft.bounds.length}` }))} />}
          <p className="text-sm">Drag the white handles to move nodes. Right-click a handle to delete it, or select a node below and delete it. {editingRoad ? "Roads must keep at least two nodes." : "Each ring must keep at least three corners."} Saving geometry clears its previous verification.</p>
          {!editingRoad && (editableRings?.length ?? 0) > 1 && <Select virtual={false} aria-label="Polygon ring" className="mb-3 w-full"
            value={ringIndex} disabled={blocked || drawing} onChange={(index) => { setRingIndex(index); setCorner(0); }}
            options={editableRings?.map((_, index) => ({ value: index, label: index === 0 ? "Exterior ring" : `Hole ${index}` }))} />}
          {point && !drawing && <div className="mb-3 grid gap-2">
            <Select virtual={false} aria-label={editingRoad ? "Road node" : "Corner"} value={corner} onChange={setCorner} disabled={blocked} options={(editingRoad ? editableRings?.[ringIndex] : editableRings?.[ringIndex].slice(0, -1))?.map((_, index) => ({ value: index, label: `${editingRoad ? "Node" : "Corner"} ${index + 1}` }))} />
            <label className="text-sm">Latitude<InputNumber aria-label="Corner latitude" className="!w-full" value={point.lat} min={-90} max={90} precision={7} step={0.000001} disabled={blocked} onChange={(value) => setCoordinate("lat", value)} /></label>
            <label className="text-sm">Longitude<InputNumber aria-label="Corner longitude" className="!w-full" value={point.lng} min={-180} max={180} precision={7} step={0.000001} disabled={blocked} onChange={(value) => setCoordinate("lng", value)} /></label>
            <Button danger disabled={blocked || (editableRings?.[ringIndex]?.length ?? 0) <= (editingRoad ? 2 : 4)} onClick={() => removeVertex(ringIndex, corner)}>Delete selected {editingRoad ? "node" : "corner"}</Button>
          </div>}
          {editingRoad && <label className="mb-3 block text-sm">Road width (m)
            <InputNumber aria-label="Road width in metres" className="!w-full" min={0.01} precision={2} value={draft.roadWidths?.[outlineIndex] ?? null}
              placeholder="Unknown" disabled={blocked || drawing} onChange={(width: number | null) => setDraft((value) => value && ({ ...value,
                roadWidths: value.bounds.map((_, index) => index === outlineIndex ? width : value.roadWidths?.[index] ?? null) }))} />
          </label>}
          <Space wrap>
            <Button disabled={drawing || blocked} onClick={() => setDrawing(true)}>Draw another {editingRoad ? "road" : "outline"}</Button>
            {draft.bounds.length > 1 && <Button danger disabled={drawing || blocked} onClick={() => {
              setDraft(removeDraftShapes(draft, new Set([outlineIndex]))); setSelection({ id: draft.id ?? "new", outline: 0 }); setRingIndex(0); setCorner(0);
            }}>Remove selected {editingRoad ? "road" : "outline"}</Button>}
            {drawing && <Button onClick={cancelDrawing}>Stop drawing</Button>}
            <Button type="primary" disabled={!draft.featureId || !draft.bounds.length || drawing || conflict || uncertain || !access.canAnnotate}
              loading={change.isLoading} onClick={() => change.mutate({ kind: "save", draft })}>Save {editingRoad ? "roads" : "outlines"}</Button>
            <Popconfirm title="Discard unsaved changes?" onConfirm={discard}><Button disabled={change.isLoading}>Cancel editing</Button></Popconfirm>
          </Space>
        </>}
        <MutationFeedback error={change.error} conflict="This result changed while you were editing. Your draft is kept. Discard it and reload before making another change." />
        {uncertain && <Alert className="my-3" type="warning" title="The request may have completed" description="Reload results and check the saved data before trying again." />}
        {(conflict || uncertain) && <Popconfirm title="Discard the draft and reload saved results?" onConfirm={loadLatest}><Button>Reload saved results</Button></Popconfirm>}
        </>}
      </aside>
    </div>
    {history && access.canReviewHistory && <AnnotationHistory key={history === "selected" ? selection?.id : "all"} project={project}
      detectionId={history === "selected" ? selection?.id : undefined} onClose={() => setHistory(undefined)} />}
  </div>;
}
