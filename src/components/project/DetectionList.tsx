import { useState } from "react";
import { Alert, Empty, Skeleton } from "antd";
import { AimOutlined, DownOutlined } from "@ant-design/icons";

export interface SheetDetections {
  featureId: string;
  buildingCount: number;
  footprintAreaM2: number;
}

interface DetectionListProps {
  sheets?: SheetDetections[];
  isLoading: boolean;
  isError: boolean;
  selectedFeatureId: string | null;
  onSelect: (featureId: string | null) => void;
}

const numberFormat = new Intl.NumberFormat();

function formatArea(areaM2: number) {
  return areaM2 >= 10_000
    ? `${(areaM2 / 10_000).toFixed(2)} ha`
    : `${numberFormat.format(Math.round(areaM2))} m²`;
}

function Statistic({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-muted px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function DetectionList({
  sheets,
  isLoading,
  isError,
  selectedFeatureId,
  onSelect,
}: DetectionListProps) {
  const [expanded, setExpanded] = useState(true);
  const buildingCount = sheets?.reduce((sum, sheet) => sum + sheet.buildingCount, 0) ?? 0;
  const footprintAreaM2 = sheets?.reduce((sum, sheet) => sum + sheet.footprintAreaM2, 0) ?? 0;

  return (
    <section className="app-card overflow-hidden">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left hover:bg-surface-muted"
      >
        <span className="font-medium">
          Detections
          {sheets && (
            <span className="ml-2 text-sm font-normal text-muted tabular-nums">
              {numberFormat.format(buildingCount)}
            </span>
          )}
        </span>
        <DownOutlined className={`text-xs transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-app-border p-4">
          {isError && (
            <Alert
              type="error"
              showIcon
              title={sheets ? "Refresh failed, showing the last known detections." : "Could not load detections."}
            />
          )}

          {isLoading && !sheets && <Skeleton active title={false} paragraph={{ rows: 4 }} />}

          {sheets && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Statistic label="Buildings" value={numberFormat.format(buildingCount)} />
                <Statistic label="Sheets with detections" value={numberFormat.format(sheets.length)} />
                <Statistic label="Footprint area" value={formatArea(footprintAreaM2)} />
                <Statistic
                  label="Average footprint"
                  value={buildingCount === 0 ? "–" : formatArea(footprintAreaM2 / buildingCount)}
                />
              </div>

              {sheets.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No detections yet" />
              ) : (
                <ul className="m-0 flex list-none flex-col p-0">
                  {sheets.map((sheet) => {
                    const selected = sheet.featureId === selectedFeatureId;

                    return (
                      <li key={sheet.featureId}>
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => onSelect(selected ? null : sheet.featureId)}
                          className={`flex w-full cursor-pointer items-center gap-3 border-l-2 px-3 py-2 text-left ${
                            selected
                              ? "border-brand bg-brand-soft"
                              : "border-transparent hover:bg-surface-muted"
                          }`}
                        >
                          <AimOutlined className={selected ? "text-brand-ink" : "text-subtle"} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium" title={sheet.featureId}>
                              {sheet.featureId}
                            </span>
                            <span className="block text-xs text-muted tabular-nums">
                              {numberFormat.format(sheet.buildingCount)} buildings ·{" "}
                              {formatArea(sheet.footprintAreaM2)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
