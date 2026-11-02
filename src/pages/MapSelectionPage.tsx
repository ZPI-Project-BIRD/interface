import { useCallback, useEffect, useState } from "react";
import { Button, Layout, message, Space } from "antd";
import { Footer, Content, Header } from "antd/es/layout/layout";
import { Map, type RectangleBounds } from "../components/Map";
import { api } from "../api";

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
    <Layout className="h-screen">
      {messageContextHolder}
      <Header className="flex items-center">
        <Space>
          <Button disabled={!rectangle} onClick={() => setRectangle(null)}>
            Clear rectangle
          </Button>
        </Space>
      </Header>
      <Content className="min-h-0 grow">
        <Map mode="draw-rectangle" rectangle={rectangle} onRectangleDraw={handleRectangleDraw} />
      </Content>
      <Footer>
        {rectangle
          ? `N ${rectangle.north.toFixed(6)}, E ${rectangle.east.toFixed(6)}, S ${rectangle.south.toFixed(6)}, W ${rectangle.west.toFixed(6)}`
          : "No rectangle selected"}
      </Footer>
    </Layout>
  );
};

export default MapSelectionPage;
