import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { CRS_2180 } from "../geo/projections";

const HIGH_RESOLUTION_ERROR_TILE_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='512' height='512'%3E%3Crect width='100%25' height='100%25' fill='%23ef4444' fill-opacity='.35'/%3E%3C/svg%3E";

const POLAND_BOUNDS_BUFFER_METERS = 50_000;
const POLAND_SOUTH_WEST = L.latLng(49.0019, 14.1228);
const POLAND_NORTH_EAST = L.latLng(54.8358, 24.1459);
const POLAND_BOUNDS = L.latLngBounds(
  POLAND_SOUTH_WEST.toBounds(POLAND_BOUNDS_BUFFER_METERS * 2).getSouthWest(),
  POLAND_NORTH_EAST.toBounds(POLAND_BOUNDS_BUFFER_METERS * 2).getNorthEast(),
);
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

// G2_MOBILE_500 is Geoportal's OSM-like base map. Its tile grid matches the map CRS
// exactly, but it stops at zoom 15, so zoom 16 upscales those tiles.
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
  /** Outer ring first, then holes. */
  rings: L.LatLng[][];
  highlighted?: boolean;
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
  focusBounds?: L.LatLngBounds | null;
  onRectangleDraw?: (rectangle: RectangleBounds) => void;
  onDrawingChange?: (drawing: boolean) => void;
  onPolygonSelect?: (id: string) => void;
  editableRings?: L.LatLng[][];
  onRingsChange?: (rings: L.LatLng[][]) => void;
  drawingPolygon?: boolean;
  onPolygonDraw?: (ring: L.LatLng[]) => void;
  onPolygonDrawCancel?: () => void;
}

export function Map({
  mode,
  rectangle,
  interactive = true,
  layer,
  polygons,
  focusBounds,
  onRectangleDraw,
  onDrawingChange,
  onPolygonSelect,
  editableRings,
  onRingsChange,
  drawingPolygon = false,
  onPolygonDraw,
  onPolygonDrawCancel,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
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
      color: "#4ab72b",
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

    if (!map || !polygons?.length) {
      return;
    }

    const renderer = L.canvas({ padding: 0.5 });
    const layer = L.layerGroup(
      polygons.map(({ id, rings, highlighted }) => {
        const polygon = L.polygon(rings, {
          renderer,
          interactive: Boolean(onPolygonSelect),
          color: highlighted ? "#22d3ee" : "#f59e0b",
          fillOpacity: highlighted ? 0.45 : 0.25,
          weight: highlighted ? 2 : 1.5,
        });
        if (onPolygonSelect) polygon.on("click", () => onPolygonSelect(id));
        return polygon;
      }),
    ).addTo(map);

    return () => {
      layer.remove();
      renderer.remove();
    };
  }, [polygons, onPolygonSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !editableRings || !onRingsChange) return;
    const rings = editableRings.map((ring) => ring.map((point) => L.latLng(point.lat, point.lng)));
    const outline = L.polygon(rings, { color: "#22d3ee", fillOpacity: 0.3, interactive: false }).addTo(map);
    const handles: L.Marker[] = [];
    rings.forEach((ring, ringIndex) => {
      // The final point repeats the first point; dragging the first updates both.
      ring.slice(0, -1).forEach((point, index) => {
        const handle = L.marker(point, { draggable: true, keyboard: true,
          title: `Outline ${ringIndex + 1}, corner ${index + 1}`,
          icon: L.divIcon({ className: "annotation-vertex", html: '<span style="display:block;width:14px;height:14px;border:2px solid #123f5d;background:white;border-radius:50%"></span>', iconSize: [14, 14], iconAnchor: [7, 7] }),
        }).addTo(map);
        handle.on("drag", () => {
          rings[ringIndex][index] = handle.getLatLng();
          if (index === 0) rings[ringIndex][ring.length - 1] = handle.getLatLng();
          outline.setLatLngs(rings);
        });
        handle.on("dragend", () => onRingsChange(rings));
        handles.push(handle);
      });
    });
    return () => { outline.remove(); handles.forEach((handle) => handle.remove()); };
  }, [editableRings, onRingsChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !drawingPolygon || !onPolygonDraw) return;
    const points: L.LatLng[] = [];
    const drawing = L.polyline([], { color: "#22d3ee", interactive: false }).addTo(map);
    const corners: L.CircleMarker[] = [];
    const cursor = map.getContainer().style.cursor;
    const doubleClickZoom = map.doubleClickZoom.enabled();
    map.getContainer().style.cursor = "crosshair";
    map.doubleClickZoom.disable();
    const finish = () => { if (points.length >= 3) onPolygonDraw([...points, points[0]]); };
    const click = (event: L.LeafletMouseEvent) => {
      const previous = points.at(-1);
      if (previous && map.latLngToContainerPoint(previous).distanceTo(event.containerPoint) < 3) return;
      points.push(event.latlng);
      drawing.setLatLngs(points);
      const corner = L.circleMarker(event.latlng, { radius: 5, color: "#123f5d", fillColor: "white", fillOpacity: 1, bubblingMouseEvents: false }).addTo(map);
      if (points.length === 1) corner.on("click", finish);
      corners.push(corner);
    };
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (event.key === "Enter") { event.preventDefault(); finish(); }
      if (event.key === "Escape") onPolygonDrawCancel?.();
    };
    map.on("click", click);
    map.on("dblclick", finish);
    document.addEventListener("keydown", key);
    return () => {
      map.off("click", click); map.off("dblclick", finish); document.removeEventListener("keydown", key);
      drawing.remove(); corners.forEach((corner) => corner.remove());
      map.getContainer().style.cursor = cursor;
      if (doubleClickZoom) map.doubleClickZoom.enable();
    };
  }, [drawingPolygon, onPolygonDraw, onPolygonDrawCancel]);

  useEffect(() => {
    const map = mapRef.current;

    if (map && focusBounds?.isValid() && !lastFocusRef.current?.equals(focusBounds)) {
      map.fitBounds(focusBounds, { maxZoom: 16, padding: [40, 40] });
      lastFocusRef.current = focusBounds;
    }
  }, [focusBounds]);

  // Kept in refs so a new callback identity does not reset a selection in progress.
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

      // Dragging pans the map; a click anchors the first corner and a second click the opposite
      // one. Leaflet does not fire "click" after a drag, so panning never places a corner.
      const container = map.getContainer();
      const previousCursor = container.style.cursor;
      const wasDoubleClickZoomEnabled = map.doubleClickZoom.enabled();
      let startPoint: L.LatLng | null = null;
      let draftLayer: L.Rectangle | null = null;

      container.style.cursor = "crosshair";
      // Two quick clicks are a selection, not a zoom request.
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
            color: "#4ab72b",
            dashArray: "6 4",
            fillOpacity: 0.15,
            interactive: false,
            weight: 2,
          }).addTo(map);
          return;
        }

        const startContainerPoint = map.latLngToContainerPoint(startPoint);

        // A second click on (almost) the same spot would make an empty rectangle; keep drawing.
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

  return <div ref={containerRef} className="h-full w-full" />;
}
