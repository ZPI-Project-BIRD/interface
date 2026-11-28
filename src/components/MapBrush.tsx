import { useEffect, useRef } from "react";
import * as L from "leaflet";
import { palette } from "../theme";
import type { BrushTool } from "../geo/brush";

export function MapBrush({ map, tool, diameterM, onStroke, onDrawingChange, onCancel }: {
  map: L.Map; tool: BrushTool; diameterM: number;
  onStroke: (points: L.LatLng[]) => void;
  onDrawingChange?: (drawing: boolean) => void;
  onCancel?: () => void;
}) {
  const callbacks = useRef({ onStroke, onDrawingChange, onCancel });
  useEffect(() => { callbacks.current = { onStroke, onDrawingChange, onCancel }; });

  useEffect(() => {
    const container = map.getContainer();
    const color = tool === "paint" ? palette.primary : "#ef4444";
    const cursor = L.circle(map.getCenter(), { radius: diameterM / 2, color, weight: 1.5, fillOpacity: 0.15, interactive: false });
    const preview = L.polyline([], { color, opacity: 0.45, interactive: false, lineCap: "round", lineJoin: "round" });
    const oldCursor = container.style.cursor, oldTouchAction = container.style.touchAction;
    const handlers = [map.dragging, map.boxZoom, map.doubleClickZoom, map.touchZoom, map.scrollWheelZoom];
    const enabled = handlers.map((handler) => handler.enabled());
    handlers.forEach((handler) => handler.disable());
    container.style.cursor = "crosshair";
    container.style.touchAction = "none";
    let points: L.LatLng[] = [];
    let pointer: number | null = null;
    const isControl = (event: Event) => (event.target as HTMLElement)?.closest(".leaflet-control,button,input,select,textarea");
    const pixelDiameter = (at: L.LatLng) => {
      const crs = map.options.crs!;
      const projected = crs.project(at);
      const edge = crs.unproject(L.point(projected.x + diameterM, projected.y));
      return Math.max(2, map.latLngToContainerPoint(at).distanceTo(map.latLngToContainerPoint(edge)));
    };
    const updateCursor = (point: L.LatLng) => {
      cursor.setLatLng(point);
      if (!map.hasLayer(cursor)) cursor.addTo(map);
      preview.setStyle({ weight: pixelDiameter(point) });
    };
    const reset = () => {
      const captured = pointer;
      pointer = null;
      points = [];
      preview.remove();
      if (captured !== null && container.hasPointerCapture(captured)) container.releasePointerCapture(captured);
      callbacks.current.onDrawingChange?.(false);
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || !event.isPrimary || isControl(event) || pointer !== null) return;
      event.preventDefault(); event.stopPropagation();
      pointer = event.pointerId;
      container.setPointerCapture(pointer);
      const point = map.mouseEventToLatLng(event);
      points = [point];
      updateCursor(point);
      preview.setLatLngs(points).addTo(map);
      callbacks.current.onDrawingChange?.(true);
    };
    const move = (event: PointerEvent) => {
      if (isControl(event) && pointer === null) { cursor.remove(); return; }
      const point = map.mouseEventToLatLng(event);
      updateCursor(point);
      if (pointer !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const last = points[points.length - 1];
      if (map.latLngToContainerPoint(last).distanceTo(map.latLngToContainerPoint(point)) >= Math.max(2, pixelDiameter(point) * 0.1)) {
        points.push(point);
        preview.setLatLngs(points);
      }
    };
    const up = (event: PointerEvent) => {
      if (pointer !== event.pointerId) return;
      event.preventDefault(); event.stopPropagation();
      const end = map.mouseEventToLatLng(event);
      if (!points[points.length - 1].equals(end)) points.push(end);
      const stroke = points;
      reset();
      callbacks.current.onStroke(stroke);
    };
    const cancel = (event: PointerEvent) => { if (pointer === event.pointerId) reset(); };
    const leave = () => { if (pointer === null) cursor.remove(); };
    const blockClick = (event: Event) => {
      if (isControl(event)) return;
      event.preventDefault(); event.stopPropagation();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || (event.target as HTMLElement)?.closest("input,textarea,select")) return;
      event.preventDefault();
      if (pointer !== null) reset(); else callbacks.current.onCancel?.();
    };
    container.addEventListener("pointerdown", down, true);
    container.addEventListener("pointermove", move, true);
    container.addEventListener("pointerup", up, true);
    container.addEventListener("pointercancel", cancel, true);
    container.addEventListener("lostpointercapture", cancel);
    container.addEventListener("pointerleave", leave);
    for (const event of ["click", "dblclick", "contextmenu"]) container.addEventListener(event, blockClick, true);
    document.addEventListener("keydown", key);
    return () => {
      container.removeEventListener("pointerdown", down, true);
      container.removeEventListener("pointermove", move, true);
      container.removeEventListener("pointerup", up, true);
      container.removeEventListener("pointercancel", cancel, true);
      container.removeEventListener("lostpointercapture", cancel);
      container.removeEventListener("pointerleave", leave);
      for (const event of ["click", "dblclick", "contextmenu"]) container.removeEventListener(event, blockClick, true);
      document.removeEventListener("keydown", key);
      reset(); cursor.remove();
      container.style.cursor = oldCursor;
      container.style.touchAction = oldTouchAction;
      handlers.forEach((handler, index) => { if (enabled[index]) handler.enable(); });
    };
  }, [map, tool, diameterM]);
  return null;
}
