import { useCallback, useEffect, useState } from "react";
import { Button, message, Typography } from "antd";
import { Map, type RectangleBounds } from "../components/Map";
import { api } from "../api";
import CrudPageLayout from "../components/ProjectsPageLayout";

const EARTH_RADIUS_METERS = 6_371_008.8;
const MAX_RECTANGLE_AREA_KM2 = 20;

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function calculateRectangleAreaKm2(rectangle: RectangleBounds) {
  const north = degreesToRadians(rectangle.north);
  const south = degreesToRadians(rectangle.south);
  const longitudeSpan = degreesToRadians(Math.abs(rectangle.east - rectangle.west));

  const areaMetersSquared =
    EARTH_RADIUS_METERS ** 2 * Math.abs(Math.sin(north) - Math.sin(south)) * longitudeSpan;

  return areaMetersSquared / 1_000_000;
}

const MapSelectionPage = () => {
  const [rectangle, setRectangle] = useState<RectangleBounds | null>(null);
  const [messageApi, messageContextHolder] = message.useMessage();

  const handleRectangleDraw = useCallback(
    (nextRectangle: RectangleBounds) => {
      const areaKm2 = calculateRectangleAreaKm2(nextRectangle);

      if (areaKm2 > MAX_RECTANGLE_AREA_KM2) {
        messageApi.error({
          content: `Selected area is ${areaKm2.toFixed(2)} km². The maximum allowed area is ${MAX_RECTANGLE_AREA_KM2} km².`,
          key: "rectangle-area-limit",
        });
        return;
      }

      setRectangle(nextRectangle);
    },
    [messageApi],
  );

  useEffect(() => {
    const controller = new AbortController();
    void api.organizations.getMy({ signal: controller.signal })
      .then((organizations) => console.log(organizations))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        messageApi.error(error instanceof Error ? error.message : "Unable to load organizations.");
      });
    return () => controller.abort();
  }, [messageApi]);

  return (
    <CrudPageLayout fullBleed>
      {messageContextHolder}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-app-border bg-surface px-4 py-3 sm:px-7">
        <Typography.Text strong>Select an area</Typography.Text>
        <Button disabled={!rectangle} onClick={() => setRectangle(null)}>
          Clear rectangle
        </Button>
      </div>
      <section className="min-h-0 flex-1">
        <Map mode="draw-rectangle" rectangle={rectangle} onRectangleDraw={handleRectangleDraw} />
      </section>
      <footer className="border-t border-app-border bg-surface px-4 py-3 text-sm text-secondary sm:px-7">
        {rectangle
          ? `N ${rectangle.north.toFixed(6)}, E ${rectangle.east.toFixed(6)}, S ${rectangle.south.toFixed(6)}, W ${rectangle.west.toFixed(6)}`
          : "No rectangle selected"}
      </footer>
    </CrudPageLayout>
  );
};

export default MapSelectionPage;
