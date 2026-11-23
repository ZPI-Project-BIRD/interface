import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Select } from "antd";
import { AimOutlined, BorderOutlined, ColumnWidthOutlined, ShrinkOutlined } from "@ant-design/icons";
import * as L from "leaflet";
import {
  centroid, closestOnRing, closestOnSegment, containsPoint, formatDistance, groundArea, groundDistance, groundPerimeter,
  nearestOutlines, sides, toLatLng, toPlanar, type PlanarOutline,
} from "../geo/measure";
import { formatArea } from "../geo/area";
import { MapToolButton, RulerIcon } from "./MapToolButton";

export type RulerTool = "off" | "point" | "distance" | "area";
type Anchor = "nearest" | "centroid" | number;

const NEIGHBOUR_COUNT = 3;
const NEIGHBOUR_RANGE_M = 250;
const RULER_COLOR = "#0ea5e9";
const SIDE_COLOR = "#e11d48";
const PANE = "ruler";

function label(map: L.Map, at: L.LatLng, text: string) {
  return L.tooltip({ permanent: true, direction: "center", className: "ruler-label", interactive: false, pane: "tooltipPane" })
    .setLatLng(at).setContent(text).addTo(map);
}

function midpoint(a: L.Point, b: L.Point) {
  return toLatLng(L.point((a.x + b.x) / 2, (a.y + b.y) / 2));
}

function vertexIcon() {
  return L.divIcon({ className: "ruler-vertex", iconSize: [12, 12], iconAnchor: [6, 6] });
}

function measureFrom(ring: L.Point[], anchor: Anchor, target: L.Point) {
  if (anchor === "centroid") return centroid(ring);
  if (anchor === "nearest") return containsPoint(ring, target) ? target : closestOnRing(target, ring);
  const side = sides(ring)[anchor];
  return side ? closestOnSegment(target, side[0], side[1]) : closestOnRing(target, ring);
}

export function MapRuler({ map, outlines, hoveredId, tool, available, onToolChange }: {
  map: L.Map;
  outlines: PlanarOutline[];
  hoveredId: string | null;
  tool: RulerTool;
  available: boolean;
  onToolChange: (tool: RulerTool) => void;
}) {
  const [open, setOpen] = useState(false);
  const [neighbours, setNeighbours] = useState(true);
  const showGaps = open && available && neighbours;
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<Anchor>("nearest");
  const [target, setTarget] = useState<L.LatLng | null>(null);
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const activeTool = available ? tool : "off";
  const anchorOutline = outlines.find(({ id }) => id === anchorId);
  const anchorSides = useMemo(() => (anchorOutline ? sides(anchorOutline.ring) : []), [anchorOutline]);

  useEffect(() => {
    if (!map.getPane(PANE)) map.createPane(PANE).style.zIndex = "450";
  }, [map]);

  const clear = () => { setAnchorId(null); setAnchor("nearest"); setTarget(null); setPoints([]); };
  const switchTool = (next: RulerTool) => { clear(); onToolChange(next === tool ? "off" : next); };
  const toggleOpen = () => { clear(); onToolChange("off"); setOpen(!open); };

  useEffect(() => {
    const hovered = outlines.find(({ id }) => id === hoveredId);
    if (!showGaps || !hovered) return;
    const layers: L.Layer[] = nearestOutlines(hovered, outlines, NEIGHBOUR_COUNT, NEIGHBOUR_RANGE_M).flatMap((gap) => [
      L.polyline([toLatLng(gap.from), toLatLng(gap.to)], { pane: PANE, color: RULER_COLOR, weight: 2, dashArray: "4 4", interactive: false }).addTo(map),
      label(map, midpoint(gap.from, gap.to), formatDistance(gap.distance)),
    ]);
    return () => layers.forEach((layer) => layer.remove());
  }, [map, outlines, hoveredId, showGaps]);

  useEffect(() => {
    if (activeTool === "off") return;
    const container = map.getContainer();
    const cursor = container.style.cursor;
    const doubleClickZoom = map.doubleClickZoom.enabled();
    container.style.cursor = "crosshair";
    map.doubleClickZoom.disable();
    const click = ({ latlng }: L.LeafletMouseEvent) => {
      if (activeTool === "point") {
        if (anchorId) { setTarget(latlng); return; }
        const planar = toPlanar(latlng);
        const hit = outlines.find(({ ring }) => containsPoint(ring, planar));
        if (hit) setAnchorId(hit.id);
        return;
      }
      if (activeTool === "distance") setPoints((current) => (current.length >= 2 ? [latlng] : [...current, latlng]));
      else setPoints((current) => [...current, latlng]);
    };
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (event.key === "Escape") clear();
      if (event.key === "Backspace" && activeTool === "area") setPoints((current) => current.slice(0, -1));
    };
    map.on("click", click);
    document.addEventListener("keydown", key);
    return () => {
      map.off("click", click);
      document.removeEventListener("keydown", key);
      container.style.cursor = cursor;
      if (doubleClickZoom) map.doubleClickZoom.enable();
    };
  }, [map, activeTool, anchorId, outlines]);

  useEffect(() => {
    if (activeTool !== "point" || !anchorOutline) return;
    const layers: L.Layer[] = [L.polygon(anchorOutline.ring.map(toLatLng), { pane: PANE, color: RULER_COLOR, weight: 2, fill: false, interactive: false }).addTo(map)];
    anchorSides.forEach(([a, b], index) => {
      const chosen = anchor === index;
      const side = L.polyline([toLatLng(a), toLatLng(b)], { pane: PANE, color: chosen ? SIDE_COLOR : RULER_COLOR, weight: chosen ? 5 : 3, opacity: chosen ? 1 : 0.5, bubblingMouseEvents: false })
        .addTo(map);
      side.bindTooltip(`Side ${index + 1} · ${formatDistance(groundDistance(a, b))}`, { sticky: true });
      side.on("click", () => setAnchor(index));
      const hit = L.polyline([toLatLng(a), toLatLng(b)], { pane: PANE, opacity: 0, weight: 14, bubblingMouseEvents: false }).addTo(map);
      hit.on("click", () => setAnchor(index));
      hit.on("mouseover", () => side.setStyle({ opacity: 1 }));
      hit.on("mouseout", () => side.setStyle({ opacity: chosen ? 1 : 0.5 }));
      layers.push(side, hit);
    });
    if (anchor === "centroid") {
      layers.push(L.circleMarker(toLatLng(centroid(anchorOutline.ring)), { pane: PANE, radius: 4, color: SIDE_COLOR, fillOpacity: 1, interactive: false }).addTo(map));
    }
    if (target) {
      const line = L.polyline([], { pane: PANE, color: SIDE_COLOR, weight: 2, interactive: false }).addTo(map);
      const distance = label(map, target, "");
      const update = (end: L.LatLng) => {
        const to = toPlanar(end);
        const from = measureFrom(anchorOutline.ring, anchor, to);
        line.setLatLngs([toLatLng(from), end]);
        distance.setLatLng(midpoint(from, to)).setContent(formatDistance(groundDistance(from, to)));
      };
      const marker = L.marker(target, { draggable: true, icon: vertexIcon(), pane: "markerPane" }).addTo(map);
      marker.on("drag", () => update(marker.getLatLng()));
      marker.on("dragend", () => setTarget(marker.getLatLng()));
      update(target);
      layers.push(line, distance, marker);
    }
    return () => layers.forEach((layer) => layer.remove());
  }, [map, activeTool, anchorOutline, anchorSides, anchor, target]);

  useEffect(() => {
    if ((activeTool !== "distance" && activeTool !== "area") || !points.length) return;
    const current = [...points];
    const shape = activeTool === "area"
      ? L.polygon(current, { pane: PANE, color: RULER_COLOR, weight: 2, fillOpacity: 0.15, interactive: false })
      : L.polyline(current, { pane: PANE, color: RULER_COLOR, weight: 3, interactive: false });
    shape.addTo(map);
    const readout = label(map, current[0], "");
    const update = () => {
      shape.setLatLngs(current);
      const planar = current.map(toPlanar);
      if (activeTool === "distance") {
        readout.setLatLng(current.length > 1 ? midpoint(planar[0], planar[1]) : current[0])
          .setContent(current.length > 1 ? formatDistance(groundDistance(planar[0], planar[1])) : "Click a second point");
      } else {
        readout.setLatLng(current.length > 2 ? toLatLng(centroid(planar)) : current[current.length - 1])
          .setContent(current.length > 2 ? `${formatArea(groundArea(planar))} · perimeter ${formatDistance(groundPerimeter(planar))}` : "Keep clicking to add corners");
      }
    };
    const markers = current.map((point, index) => {
      const marker = L.marker(point, { draggable: true, icon: vertexIcon() }).addTo(map);
      marker.on("drag", () => { current[index] = marker.getLatLng(); update(); });
      marker.on("dragend", () => setPoints([...current]));
      return marker;
    });
    update();
    return () => { shape.remove(); readout.remove(); markers.forEach((marker) => marker.remove()); };
  }, [map, activeTool, points]);

  const instructions = {
    off: null,
    point: !anchorId ? "Click an outline to measure from." : !target ? "Click the map to place a point. Click a side of the outline to measure from it." : "Drag the point or click elsewhere to move it.",
    distance: points.length < 2 ? "Click two points to measure the distance between them." : "Drag either end to adjust. Click again to start over.",
    area: points.length < 3 ? "Click the map to add corners of the area." : "Drag corners to adjust. Backspace removes the last corner.",
  }[activeTool];

  const tools = [
    { value: "point", label: "Measure from an outline to a point", icon: <AimOutlined /> },
    { value: "distance", label: "Measure distance", icon: <ColumnWidthOutlined /> },
    { value: "area", label: "Measure area", icon: <BorderOutlined /> },
  ] satisfies { value: RulerTool; label: string; icon: ReactNode }[];

  return (
    <div className="flex items-start gap-2">
      <MapToolButton label={open ? "Close ruler" : "Ruler"} icon={<RulerIcon crossed={open} />} active={open && available}
        disabled={!available} onClick={toggleOpen} />
      {open && available && <div className="app-card flex max-w-[min(22rem,calc(100vw-5rem))] flex-col gap-2 p-1.5 shadow-sm">
        <div className="flex gap-1">
          <MapToolButton label={neighbours ? "Hide gaps to nearest outlines on hover" : "Show gaps to nearest outlines on hover"}
            icon={<ShrinkOutlined />} active={neighbours} tooltipPlacement="bottom" onClick={() => setNeighbours(!neighbours)} />
          <span className="mx-0.5 w-px self-stretch bg-app-border" />
          {tools.map(({ value, label, icon }) => <MapToolButton key={value} label={label} icon={icon} active={activeTool === value}
            tooltipPlacement="bottom" onClick={() => switchTool(value)} />)}
        </div>
        {activeTool === "point" && anchorOutline && <div className="flex flex-wrap items-center gap-2 px-1 text-sm">
          <span>Measure from</span>
          <Select size="small" className="min-w-36" value={anchor} onChange={setAnchor} options={[
            { value: "nearest", label: "Nearest edge" }, { value: "centroid", label: "Centre" },
            ...anchorSides.map(([a, b], index) => ({ value: index, label: `Side ${index + 1} (${formatDistance(groundDistance(a, b))})` })),
          ]} />
          <Button size="small" onClick={() => { setAnchorId(null); setAnchor("nearest"); }}>Change outline</Button>
        </div>}
        <div className="flex flex-wrap items-center gap-x-2 px-1 text-xs text-muted">
          <span>{instructions ?? (neighbours ? "Hover an outline to see the gaps to its nearest neighbours, or pick a tool." : "Pick a measuring tool.")}</span>
          {instructions && <Button size="small" type="link" className="!px-0" onClick={clear}>Clear</Button>}
        </div>
      </div>}
    </div>
  );
}
