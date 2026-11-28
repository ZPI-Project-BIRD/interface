import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CRS_2180 } from "../geo/projections";
import { palette } from "../theme";
import { toPlanar, type PlanarOutline } from "../geo/measure";
import { MapRuler, type RulerTool } from "./MapRuler";
import { MapSearch } from "./MapSearch";
import { MapBrush } from "./MapBrush";
import type { BrushTool } from "../geo/brush";
import type { GeoBounds } from "../geo/search/types";

const HIGH_RESOLUTION_ERROR_TILE_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512'%3E%3Crect width='100%25' height='100%25' fill='%23ef4444' fill-opacity='.35'/%3E%3C/svg%3E";

const POLAND_BOUNDS_BUFFER_METERS = 50_000;
const POLAND_SOUTH_WEST = L.latLng(49.0019, 14.1228);
const POLAND_NORTH_EAST = L.latLng(54.8358, 24.1459);
const POLAND_BOUNDS = L.latLngBounds(
  POLAND_SOUTH_WEST.toBounds(POLAND_BOUNDS_BUFFER_METERS * 2).getSouthWest(),
  POLAND_NORTH_EAST.toBounds(POLAND_BOUNDS_BUFFER_METERS * 2).getNorthEast(),
);
const POLAND_SEARCH_BOUNDS: GeoBounds = {
  north: POLAND_BOUNDS.getNorth(),
  east: POLAND_BOUNDS.getEast(),
  south: POLAND_BOUNDS.getSouth(),
  west: POLAND_BOUNDS.getWest(),
};
const PWR_B4_CENTER = L.latLng(51.108316, 17.065122);
const INITIAL_ZOOM = 10;

const TILE_OPTIONS = { tileSize: 512, minZoom: 5, maxZoom: 16 } satisfies L.TileLayerOptions;
const GEOPORTAL_ATTRIBUTION =
  '&copy; <a href="https://www.geoportal.gov.pl">GUGiK / Geoportal.gov.pl</a>';

function orthophotoUrl(resolution: "StandardResolution" | "HighResolution") {
  return (
    `https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/${resolution}` +
    "?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
    "&LAYER=ORTOFOTOMAPA&STYLE=default&FORMAT=image/jpeg" +
    "&TILEMATRIXSET=EPSG:2180&TILEMATRIX=EPSG:2180:{z}" +
    "&TILEROW={y}&TILECOL={x}"
  );
}

function createSatelliteLayer() {
  const standardResolutionLayer = L.tileLayer(orthophotoUrl("StandardResolution"), {
    ...TILE_OPTIONS,
    pane: "standardTiles",
    attribution: GEOPORTAL_ATTRIBUTION,
  });

  const highResolutionLayer = L.tileLayer(orthophotoUrl("HighResolution"), {
    ...TILE_OPTIONS,
    pane: "highResolutionTiles",
    errorTileUrl: HIGH_RESOLUTION_ERROR_TILE_URL,
  });

  highResolutionLayer.on("tileerror", ({ tile }: L.TileErrorEvent) => {
    tile.style.backgroundColor = "rgb(239 68 68 / 35%)";
  });

  return L.layerGroup([standardResolutionLayer, highResolutionLayer]);
}

function createAdministrativeLayer() {
  return L.tileLayer(
    "https://mapy.geoportal.gov.pl/wss/service/WMTS/guest/wmts/G2_MOBILE_500" +
      "?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
      "&LAYER=G2_MOBILE_500&STYLE=default&FORMAT=image/png" +
      "&TILEMATRIXSET=EPSG:2180&TILEMATRIX=EPSG:2180:{z}" +
      "&TILEROW={y}&TILECOL={x}",
    {
      ...TILE_OPTIONS,
      pane: "standardTiles",
      maxNativeZoom: 15,
      attribution: GEOPORTAL_ATTRIBUTION,
    },
  );
}

const MAP_LAYERS = {
  satellite: { label: "Satellite", create: createSatelliteLayer },
  administrative: { label: "Administrative", create: createAdministrativeLayer },
} satisfies Record<string, { label: string; create: () => L.Layer }>;

export type MapLayer = keyof typeof MAP_LAYERS;
const DEFAULT_MAP_LAYER: MapLayer = "satellite";

export type MapMode = "browse" | "draw-rectangle";

export interface MapPolygon {
  id: string;
  rings: L.LatLng[][];
  highlighted?: boolean;
  details?: MapPolygonDetails;
  color?: string;
}

export interface MapLine {
  id: string;
  points: L.LatLng[];
  color?: string;
  highlighted?: boolean;
  details?: MapPolygonDetails;
}

export interface MapPolygonDetails {
  title: string;
  rows: { label: string; value: string }[];
}

function createDetailsTooltip({ title, rows }: MapPolygonDetails) {
  const content = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;
  heading.style.display = "block";
  heading.style.marginBottom = "2px";
  content.append(heading);
  for (const { label, value } of rows) {
    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.justifyContent = "space-between";
    row.style.gap = "12px";
    const labelElement = document.createElement("span");
    labelElement.textContent = label;
    labelElement.style.opacity = "0.7";
    const valueElement = document.createElement("span");
    valueElement.textContent = value;
    valueElement.style.fontVariantNumeric = "tabular-nums";
    row.append(labelElement, valueElement);
    content.append(row);
  }
  return content;
}

export interface RectangleBounds {
  north: number;
  east: number;
  south: number;
  west: number;
}

interface MapProps {
  mode: MapMode;
  rectangle: RectangleBounds | null;
  interactive?: boolean;
  layer?: MapLayer;
  polygons?: MapPolygon[];
  lines?: MapLine[];
  focusBounds?: L.LatLngBounds | null;
  onRectangleDraw?: (rectangle: RectangleBounds) => void;
  onDrawingChange?: (drawing: boolean) => void;
  onPolygonSelect?: (id: string) => void;
  editableRings?: L.LatLng[][];
  closedGeometry?: boolean;
  onRingsChange?: (rings: L.LatLng[][]) => void;
  onVertexRemove?: (ringIndex: number, vertexIndex: number) => void;
  onVertexSelect?: (ringIndex: number, vertexIndex: number) => void;
  selectedVertex?: { ringIndex: number; index: number };
  brushTool?: BrushTool | null;
  brushDiameterM?: number;
  onBrushStroke?: (points: L.LatLng[]) => void;
  onBrushDrawingChange?: (drawing: boolean) => void;
  onBrushCancel?: () => void;
  drawingPolygon?: boolean;
  onPolygonDraw?: (ring: L.LatLng[]) => void;
  onPolygonDrawCancel?: () => void;
  onAreaSelect?: (bounds: L.LatLngBounds) => void;
  measurable?: boolean;
  searchable?: boolean;
  tools?: ReactNode;
}

export function Map({
  mode,
  rectangle,
  interactive = true,
  layer,
  polygons,
  lines,
  focusBounds,
  onRectangleDraw,
  onDrawingChange,
  onPolygonSelect,
  editableRings,
  closedGeometry = true,
  onRingsChange,
  onVertexRemove,
  onVertexSelect,
  selectedVertex,
  brushTool,
  brushDiameterM = 10,
  onBrushStroke,
  onBrushDrawingChange,
  onBrushCancel,
  drawingPolygon = false,
  onPolygonDraw,
  onPolygonDrawCancel,
  onAreaSelect,
  measurable = false,
  searchable = interactive && mode === "draw-rectangle",
  tools,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const vertexHandlesRef = useRef<{ marker: L.Marker; ringIndex: number; index: number }[]>([]);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [rulerTool, setRulerTool] = useState<RulerTool>("off");
  const rulerAvailable =
    measurable && mode === "browse" && !drawingPolygon && !onAreaSelect && !editableRings && !brushTool;
  const activeRulerTool = rulerAvailable ? rulerTool : "off";
  const activeRulerToolRef = useRef(activeRulerTool);
  useEffect(() => {
    activeRulerToolRef.current = activeRulerTool;
  });
  const planarOutlines = useMemo<PlanarOutline[]>(
    () =>
      (measurable ? (polygons ?? []) : []).flatMap(({ id, rings }) => {
        const ring = rings[0]?.map(toPlanar) ?? [];
        return ring.length >= 3 ? [{ id, ring, bounds: L.bounds(ring) }] : [];
      }),
    [measurable, polygons],
  );
  const lastFocusRef = useRef<L.LatLngBounds | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const map = L.map(container, {
      crs: CRS_2180,
      minZoom: 5,
      maxZoom: 16,
      maxBounds: POLAND_BOUNDS,
      maxBoundsViscosity: 1,
      boxZoom: interactive,
      doubleClickZoom: interactive,
      dragging: interactive,
      keyboard: interactive,
      scrollWheelZoom: interactive,
      touchZoom: interactive,
      zoomControl: interactive,
    }).setView(PWR_B4_CENTER, INITIAL_ZOOM);
    mapRef.current = map;
    setMapInstance(map);

    let isMounted = true;

    if (interactive && mode === "draw-rectangle" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          if (isMounted) {
            map.setView([coords.latitude, coords.longitude], INITIAL_ZOOM);
          }
        },
        () => {
          if (isMounted) {
            map.setView(PWR_B4_CENTER, INITIAL_ZOOM);
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 300_000,
          timeout: 10_000,
        },
      );
    }

    const standardTilesPane = map.createPane("standardTiles");
    standardTilesPane.style.zIndex = "200";

    const highResolutionTilesPane = map.createPane("highResolutionTiles");
    highResolutionTilesPane.style.zIndex = "250";

    const layerKeys = Object.keys(MAP_LAYERS) as MapLayer[];
    const baseLayers = layerKeys.map((key) => [key, MAP_LAYERS[key].create()] as const);

    baseLayers.find(([key]) => key === (layer ?? DEFAULT_MAP_LAYER))?.[1].addTo(map);

    if (layer === undefined) {
      L.control
        .layers(
          Object.fromEntries(
            baseLayers.map(([key, baseLayer]) => [MAP_LAYERS[key].label, baseLayer]),
          ),
        )
        .addTo(map);
    }

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize({ animate: false, pan: false });
    });

    resizeObserver.observe(container);
    const animationFrame = requestAnimationFrame(() => {
      map.invalidateSize({ animate: false, pan: false });
    });

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
      lastFocusRef.current = null;
    };
  }, [interactive, layer, mode]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !rectangle) {
      return;
    }

    const bounds = L.latLngBounds(
      [rectangle.south, rectangle.west],
      [rectangle.north, rectangle.east],
    );
    const layer = L.rectangle(bounds, {
      color: palette.primary,
      fillOpacity: 0.15,
      interactive: false,
      weight: 2,
    }).addTo(map);

    if (!interactive || mode === "browse") {
      map.fitBounds(bounds, { animate: false, maxZoom: 16, padding: [40, 40] });
    }

    return () => {
      layer.remove();
    };
  }, [interactive, mode, rectangle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || (!polygons?.length && !lines?.length)) return;

    // One canvas lets Leaflet hit-test polygons and roads together. Separate
    // canvases let the top canvas intercept clicks even between its shapes.
    const renderer = L.canvas({ padding: 0.5 });
    const polygonLayers = (polygons ?? []).map(({ id, rings, highlighted, details, color }) => {
      const style = {
        fillOpacity: highlighted ? 0.45 : 0.25,
        weight: highlighted ? 2 : 1.5,
      };
      const polygon = L.polygon(rings, {
        ...style,
        renderer,
        interactive: Boolean(onPolygonSelect || details || measurable),
        color: highlighted ? palette.primary : color ?? "#f59e0b",
      });
      if (onPolygonSelect) polygon.on("click", () => {
        if (activeRulerToolRef.current === "off") onPolygonSelect(id);
      });
      if (details) polygon.bindTooltip(createDetailsTooltip(details), { sticky: true, direction: "top", offset: [0, -8] });
      polygon.on("mouseover", () => {
        polygon.setStyle({ fillOpacity: style.fillOpacity + 0.15, weight: style.weight + 1 });
        setHoveredId(id);
      });
      polygon.on("mouseout", () => {
        polygon.setStyle(style);
        setHoveredId((current) => (current === id ? null : current));
      });
      return polygon;
    });
    const lineOutlines: L.Polyline[] = [];
    const lineLayers = (lines ?? []).map(({ id, points, color, highlighted, details }) => {
      const weight = highlighted ? 6 : 4;
      const outline = L.polyline(points, { renderer, color: "#94a3b8", opacity: 0.9, weight: weight + 2, interactive: false });
      lineOutlines.push(outline);
      const line = L.polyline(points, { renderer, color: highlighted ? palette.primary : color ?? "#475569", weight,
        interactive: Boolean(onPolygonSelect || details) });
      if (onPolygonSelect) line.on("click", () => {
        if (activeRulerToolRef.current === "off") onPolygonSelect(id);
      });
      if (details) line.bindTooltip(createDetailsTooltip(details), { sticky: true, direction: "top", offset: [0, -8] });
      line.on("mouseover", () => {
        line.setStyle({ weight: weight + 2 });
        outline.setStyle({ weight: weight + 4 });
      });
      line.on("mouseout", () => {
        line.setStyle({ weight });
        outline.setStyle({ weight: weight + 2 });
      });
      return line;
    });
    const layer = L.layerGroup([...polygonLayers, ...lineOutlines, ...lineLayers]).addTo(map);
    return () => { layer.remove(); renderer.remove(); };
  }, [polygons, lines, onPolygonSelect, measurable]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !editableRings || !onRingsChange) return;
    const rings = editableRings.map((ring) => ring.map((point) => L.latLng(point.lat, point.lng)));
    const style = {
      color: palette.primary,
      fillOpacity: closedGeometry ? 0.3 : 0,
      interactive: false,
    };
    const outline = (closedGeometry ? L.polygon(rings, style) : L.polyline(rings, style)).addTo(map);
    const handles: L.Marker[] = [];
    rings.forEach((ring, ringIndex) => {
      (closedGeometry ? ring.slice(0, -1) : ring).forEach((point, index) => {
        const handle = L.marker(point, {
          draggable: true,
          keyboard: true,
          title: `Outline ${ringIndex + 1}, corner ${index + 1}`,
          icon: L.divIcon({
            className: "annotation-vertex",
            html: `<span style="display:block;width:14px;height:14px;border:2px solid ${palette.primaryInk};background:${palette.surface};border-radius:50%"></span>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          }),
        }).addTo(map);
        handle.on("click", () => onVertexSelect?.(ringIndex, index));
        handle.on("dragstart", () => onVertexSelect?.(ringIndex, index));
        handle.on("drag", () => {
          rings[ringIndex][index] = handle.getLatLng();
          if (closedGeometry && index === 0) rings[ringIndex][ring.length - 1] = handle.getLatLng();
          outline.setLatLngs(rings);
        });
        handle.on("dragend", () => onRingsChange(rings));
        if (onVertexRemove) {
          const removable = ring.length > (closedGeometry ? 4 : 2);
          handle.bindTooltip(removable ? "Drag to move · Right-click to delete" : closedGeometry ? "At least three corners required" : "At least two road nodes required");
          handle.on("contextmenu", (event: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(event.originalEvent);
            if (removable) onVertexRemove(ringIndex, index);
          });
        }
        handles.push(handle);
        vertexHandlesRef.current.push({ marker: handle, ringIndex, index });
      });
    });
    return () => {
      outline.remove();
      handles.forEach((handle) => handle.remove());
      vertexHandlesRef.current = [];
    };
  }, [editableRings, onRingsChange, onVertexRemove, onVertexSelect, closedGeometry]);

  useEffect(() => {
    for (const { marker, ringIndex, index } of vertexHandlesRef.current) {
      const active = selectedVertex?.ringIndex === ringIndex && selectedVertex.index === index;
      const element = marker.getElement();
      element?.setAttribute("aria-pressed", String(active));
      const dot = element?.querySelector("span");
      if (dot) {
        dot.style.backgroundColor = active ? palette.primary : palette.surface;
        dot.style.boxShadow = active ? `0 0 0 3px ${palette.primary}` : "none";
      }
    }
  }, [selectedVertex, editableRings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !drawingPolygon || !onPolygonDraw) return;
    const points: L.LatLng[] = [];
    const drawing = L.polyline([], { color: palette.primary, interactive: false }).addTo(map);
    const corners: L.CircleMarker[] = [];
    const cursor = map.getContainer().style.cursor;
    const doubleClickZoom = map.doubleClickZoom.enabled();
    map.getContainer().style.cursor = "crosshair";
    map.doubleClickZoom.disable();
    const finish = () => {
      if (points.length >= (closedGeometry ? 3 : 2)) onPolygonDraw(closedGeometry ? [...points, points[0]] : points);
    };
    const click = (event: L.LeafletMouseEvent) => {
      const previous = points.at(-1);
      if (previous && map.latLngToContainerPoint(previous).distanceTo(event.containerPoint) < 3)
        return;
      points.push(event.latlng);
      drawing.setLatLngs(points);
      const corner = L.circleMarker(event.latlng, {
        radius: 5,
        color: palette.primaryInk,
        fillColor: palette.surface,
        fillOpacity: 1,
        bubblingMouseEvents: false,
      }).addTo(map);
      if (points.length === 1) corner.on("click", finish);
      corners.push(corner);
    };
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (event.key === "Enter") {
        event.preventDefault();
        finish();
      }
      if (event.key === "Escape") onPolygonDrawCancel?.();
    };
    map.on("click", click);
    map.on("dblclick", finish);
    document.addEventListener("keydown", key);
    return () => {
      map.off("click", click);
      map.off("dblclick", finish);
      document.removeEventListener("keydown", key);
      drawing.remove();
      corners.forEach((corner) => corner.remove());
      map.getContainer().style.cursor = cursor;
      if (doubleClickZoom) map.doubleClickZoom.enable();
    };
  }, [drawingPolygon, onPolygonDraw, onPolygonDrawCancel, closedGeometry]);

  const onAreaSelectRef = useRef(onAreaSelect);
  useEffect(() => {
    onAreaSelectRef.current = onAreaSelect;
  });
  const selectingArea = Boolean(onAreaSelect);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectingArea) return;
    const container = map.getContainer();
    const previousCursor = container.style.cursor;
    const wasDragging = map.dragging.enabled();
    const wasBoxZoom = map.boxZoom.enabled();
    let start: L.Point | null = null;
    let box: L.Rectangle | null = null;
    let suppressClick = false;
    container.style.cursor = "crosshair";
    map.dragging.disable();
    map.boxZoom.disable();
    const boundsTo = (end: L.Point) =>
      L.latLngBounds(map.containerPointToLatLng(start!), map.containerPointToLatLng(end));
    const reset = () => {
      box?.remove();
      box = null;
      start = null;
    };
    const down = (event: MouseEvent) => {
      if (event.button !== 0) return;
      start = map.mouseEventToContainerPoint(event);
      suppressClick = false;
    };
    const move = (event: MouseEvent) => {
      if (!start) return;
      const point = map.mouseEventToContainerPoint(event);
      if (!box && point.distanceTo(start) < 4) return;
      box ??= L.rectangle(boundsTo(point), {
        color: palette.primary,
        dashArray: "6 4",
        fillOpacity: 0.1,
        interactive: false,
        weight: 2,
      }).addTo(map);
      box.setBounds(boundsTo(point));
    };
    const up = (event: MouseEvent) => {
      if (!start) return;
      if (box) {
        suppressClick = true;
        onAreaSelectRef.current?.(boundsTo(map.mouseEventToContainerPoint(event)));
      }
      reset();
    };
    const click = (event: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.stopPropagation();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") reset();
    };
    container.addEventListener("mousedown", down);
    container.addEventListener("click", click, true);
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
    document.addEventListener("keydown", key);
    return () => {
      container.removeEventListener("mousedown", down);
      container.removeEventListener("click", click, true);
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      document.removeEventListener("keydown", key);
      reset();
      container.style.cursor = previousCursor;
      if (wasDragging) map.dragging.enable();
      if (wasBoxZoom) map.boxZoom.enable();
    };
  }, [selectingArea]);

  useEffect(() => {
    const map = mapRef.current;

    if (map && focusBounds?.isValid() && !lastFocusRef.current?.equals(focusBounds)) {
      map.fitBounds(focusBounds, { maxZoom: 16, padding: [40, 40] });
      lastFocusRef.current = focusBounds;
    }
  }, [focusBounds]);

  const onRectangleDrawRef = useRef(onRectangleDraw);
  const onDrawingChangeRef = useRef(onDrawingChange);

  useEffect(() => {
    onRectangleDrawRef.current = onRectangleDraw;
    onDrawingChangeRef.current = onDrawingChange;
  });

  useEffect(
    function drawRectangleEffect() {
      const map = mapRef.current;

      if (!map || !interactive || mode !== "draw-rectangle") {
        return;
      }

      const container = map.getContainer();
      const previousCursor = container.style.cursor;
      const wasDoubleClickZoomEnabled = map.doubleClickZoom.enabled();
      let startPoint: L.LatLng | null = null;
      let draftLayer: L.Rectangle | null = null;

      container.style.cursor = "crosshair";
      map.doubleClickZoom.disable();

      const setStart = (point: L.LatLng | null) => {
        startPoint = point;
        onDrawingChangeRef.current?.(point !== null);
      };

      const cancel = () => {
        draftLayer?.remove();
        draftLayer = null;

        if (startPoint) {
          setStart(null);
        }
      };

      const handleClick = (event: L.LeafletMouseEvent) => {
        if (!startPoint) {
          setStart(event.latlng);
          draftLayer = L.rectangle(L.latLngBounds(event.latlng, event.latlng), {
            color: palette.primary,
            dashArray: "6 4",
            fillOpacity: 0.15,
            interactive: false,
            weight: 2,
          }).addTo(map);
          return;
        }

        const startContainerPoint = map.latLngToContainerPoint(startPoint);

        if (startContainerPoint.distanceTo(event.containerPoint) < 3) {
          return;
        }

        const bounds = L.latLngBounds(startPoint, event.latlng);
        cancel();
        onRectangleDrawRef.current?.({
          north: bounds.getNorth(),
          east: bounds.getEast(),
          south: bounds.getSouth(),
          west: bounds.getWest(),
        });
      };

      const handleMouseMove = (event: L.LeafletMouseEvent) => {
        if (startPoint && draftLayer) {
          draftLayer.setBounds(L.latLngBounds(startPoint, event.latlng));
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if ((event.target as HTMLElement)?.closest("input,textarea,select")) return;
        if (event.key === "Escape") {
          cancel();
        }
      };

      const handleContextMenu = (event: L.LeafletMouseEvent) => {
        if (startPoint) {
          L.DomEvent.preventDefault(event.originalEvent);
          cancel();
        }
      };

      map.on("click", handleClick);
      map.on("mousemove", handleMouseMove);
      map.on("contextmenu", handleContextMenu);
      document.addEventListener("keydown", handleKeyDown);

      return () => {
        map.off("click", handleClick);
        map.off("mousemove", handleMouseMove);
        map.off("contextmenu", handleContextMenu);
        document.removeEventListener("keydown", handleKeyDown);
        cancel();
        container.style.cursor = previousCursor;

        if (wasDoubleClickZoomEnabled) {
          map.doubleClickZoom.enable();
        }
      };
    },
    [interactive, mode],
  );

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {mapInstance && brushTool && onBrushStroke && <MapBrush map={mapInstance} tool={brushTool} diameterM={brushDiameterM}
        onStroke={onBrushStroke} onDrawingChange={onBrushDrawingChange} onCancel={onBrushCancel} />}
      {searchable && mapInstance && (
        <div className="absolute top-2.5 left-13.5 z-600 w-[min(340px,calc(100%-116px))]">
          <MapSearch map={mapInstance} bounds={POLAND_SEARCH_BOUNDS} />
        </div>
      )}
      {(tools || measurable) && (
        <div className="absolute top-[84px] left-[10px] z-[500] flex flex-col items-start gap-2">
          {tools}
          {measurable && mapInstance && (
            <MapRuler
              map={mapInstance}
              outlines={planarOutlines}
              hoveredId={hoveredId}
              tool={activeRulerTool}
              available={rulerAvailable}
              onToolChange={setRulerTool}
            />
          )}
        </div>
      )}
    </div>
  );
}
