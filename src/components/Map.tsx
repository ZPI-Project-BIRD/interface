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
  /** Fixed base layer. When omitted, the map starts on satellite and shows a layer switcher. */
  layer?: MapLayer;
  polygons?: MapPolygon[];
  /** The map zooms to these bounds whenever they change. */
  focusBounds?: L.LatLngBounds | null;
  onRectangleDraw?: (rectangle: RectangleBounds) => void;
}

export function Map({
  mode,
  rectangle,
  interactive = true,
  layer,
  polygons,
  focusBounds,
  onRectangleDraw,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

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
        .layers(Object.fromEntries(baseLayers.map(([key, baseLayer]) => [MAP_LAYERS[key].label, baseLayer])))
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
    const layer = L.rectangle(
      bounds,
      {
        color: "#4ab72b",
        fillOpacity: 0.15,
        interactive: false,
        weight: 2,
      },
    ).addTo(map);

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
      polygons.map(({ rings, highlighted }) =>
        L.polygon(rings, {
          renderer,
          interactive: false,
          color: highlighted ? "#22d3ee" : "#f59e0b",
          fillOpacity: highlighted ? 0.45 : 0.25,
          weight: highlighted ? 2 : 1.5,
        }),
      ),
    ).addTo(map);

    return () => {
      layer.remove();
    };
  }, [polygons]);

  useEffect(() => {
    const map = mapRef.current;

    if (map && focusBounds?.isValid()) {
      map.fitBounds(focusBounds, { maxZoom: 16, padding: [40, 40] });
    }
  }, [focusBounds]);

  useEffect(
    function drawRectangleEffect() {
      const map = mapRef.current;

      if (!map || !interactive || mode !== "draw-rectangle") {
        return;
      }

      const container = map.getContainer();
      const previousCursor = container.style.cursor;
      const wasDraggingEnabled = map.dragging.enabled();
      let startPoint: L.LatLng | null = null;
      let draftLayer: L.Rectangle | null = null;

      container.style.cursor = "crosshair";
      map.dragging.disable();

      const handleMouseDown = (event: L.LeafletMouseEvent) => {
        if (event.originalEvent.button !== 0) {
          return;
        }

        L.DomEvent.preventDefault(event.originalEvent);
        startPoint = event.latlng;
        draftLayer?.remove();
        draftLayer = L.rectangle(L.latLngBounds(startPoint, startPoint), {
          color: "#4ab72b",
          dashArray: "6 4",
          fillOpacity: 0.15,
          interactive: false,
          weight: 2,
        }).addTo(map);
      };

      const handleMouseMove = (event: L.LeafletMouseEvent) => {
        if (!startPoint || !draftLayer) {
          return;
        }

        draftLayer.setBounds(L.latLngBounds(startPoint, event.latlng));
      };

      const handleMouseUp = (event: L.LeafletMouseEvent) => {
        if (!startPoint) {
          return;
        }

        const startContainerPoint = map.latLngToContainerPoint(startPoint);
        const endContainerPoint = map.latLngToContainerPoint(event.latlng);
        const bounds = L.latLngBounds(startPoint, event.latlng);

        draftLayer?.remove();
        draftLayer = null;
        startPoint = null;

        if (startContainerPoint.distanceTo(endContainerPoint) < 3) {
          return;
        }

        onRectangleDraw?.({
          north: bounds.getNorth(),
          east: bounds.getEast(),
          south: bounds.getSouth(),
          west: bounds.getWest(),
        });
      };

      map.on("mousedown", handleMouseDown);
      map.on("mousemove", handleMouseMove);
      map.on("mouseup", handleMouseUp);

      return () => {
        map.off("mousedown", handleMouseDown);
        map.off("mousemove", handleMouseMove);
        map.off("mouseup", handleMouseUp);
        draftLayer?.remove();
        container.style.cursor = previousCursor;

        if (wasDraggingEnabled) {
          map.dragging.enable();
        }
      };
    },
    [interactive, mode, onRectangleDraw],
  );

  return <div ref={containerRef} className="h-full w-full" />;
}
