import { useState } from "react";
import { Button, Empty, Input, Typography } from "antd";
import type { SourceFeature } from "../../api";

export function SourceFeatures({ features, loading, error, onRetry }: {
  features?: SourceFeature[]; loading: boolean; error: unknown; onRetry: () => void;
}) {
  const [search, setSearch] = useState("");
  return <section className="app-card p-4">
    <Typography.Title level={4} className="!mt-0">Source sheets</Typography.Title>
    <Input.Search placeholder="Filter source sheets" allowClear onChange={(event) => setSearch(event.target.value)} />
    {loading && <p>Loading source sheets…</p>}
    {Boolean(error) && <p>Could not load source sheets. <Button size="small" onClick={onRetry}>Retry</Button></p>}
    {features?.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No source sheets discovered" />}
    <ul className="m-0 max-h-72 list-none divide-y divide-app-border overflow-y-auto p-0">
      {features?.filter(({ id }) => id.toLowerCase().includes(search.toLowerCase())).map((feature) => <li key={feature.id} className="py-3 text-sm">
        <Typography.Text strong className="break-all">{feature.id}</Typography.Text>
        <div>{feature.colorSpace} · {feature.pixelSize} m / pixel</div>
        <div>{feature.objectName ? "Stored imagery available" : "Imagery not stored yet"}{feature.fileSize !== null ? ` · ${(feature.fileSize / 1024 / 1024).toFixed(1)} MB` : ""}</div>
        {/^https?:\/\//i.test(feature.sourceUrl) && <a href={feature.sourceUrl} target="_blank" rel="noopener noreferrer">Open source imagery</a>}
      </li>)}
    </ul>
  </section>;
}
