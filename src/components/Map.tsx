import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import "proj4leaflet";

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

export type MapMode = "browse" | "draw-rectangle";

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
  onRectangleDraw?: (rectangle: RectangleBounds) => void;
}

export function Map({ mode, rectangle, interactive = true, onRectangleDraw }: MapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const scaleDen = [
      30238155.714285716, 15119077.857142858, 7559538.928571429, 3779769.4642857146,
      1889884.7321428573, 944942.3660714286, 472471.1830357143, 236235.59151785716,
      94494.23660714286, 47247.11830357143, 23623.559151785714, 9449.423660714287,
      4724.711830357143, 1889.8847321428573, 944.9423660714286, 472.4711830357143,
      236.23559151785716,
    ];

    const resolutions = scaleDen.map((s) => s * 0.00028);

    const crs2180 = new L.Proj.CRS(
      "EPSG:2180",
      "+proj=tmerc +lat_0=0 +lon_0=19 +k=0.9993 +x_0=500000 +y_0=-5300000 +ellps=GRS80 +units=m +no_defs",
      { resolutions: resolutions, origin: [100000, 850000] },
    );

    const map = L.map(container, {
      crs: crs2180,
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

    if (interactive && navigator.geolocation) {
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

    L.tileLayer(
      "https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution" +
        "?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
        "&LAYER=ORTOFOTOMAPA&STYLE=default&FORMAT=image/jpeg" +
        "&TILEMATRIXSET=EPSG:2180&TILEMATRIX=EPSG:2180:{z}" +
        "&TILEROW={y}&TILECOL={x}",
      {
        pane: "standardTiles",
        tileSize: 512,
        minZoom: 5,
        maxZoom: 16,
        attribution: '&copy; <a href="https://www.geoportal.gov.pl">GUGiK / Geoportal.gov.pl</a>',
      },
    ).addTo(map);

    const highResolutionLayer = L.tileLayer(
      "https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/HighResolution" +
        "?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
        "&LAYER=ORTOFOTOMAPA&STYLE=default&FORMAT=image/jpeg" +
        "&TILEMATRIXSET=EPSG:2180&TILEMATRIX=EPSG:2180:{z}" +
        "&TILEROW={y}&TILECOL={x}",
      {
        pane: "highResolutionTiles",
        opacity: 1,
        tileSize: 512,
        minZoom: 5,
        maxZoom: 16,
        errorTileUrl: HIGH_RESOLUTION_ERROR_TILE_URL,
      },
    );

    highResolutionLayer.on("tileerror", ({ tile }: L.TileErrorEvent) => {
      tile.style.backgroundColor = "rgb(239 68 68 / 35%)";
    });

    highResolutionLayer.addTo(map);

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
  }, [interactive]);

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

    if (!interactive) {
      map.fitBounds(bounds, { animate: false, maxZoom: 16, padding: [40, 40] });
    }

    return () => {
      layer.remove();
    };
  }, [interactive, rectangle]);

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
