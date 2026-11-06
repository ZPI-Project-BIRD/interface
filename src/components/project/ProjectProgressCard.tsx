import { useState } from "react";
import { Alert, Badge, Progress, Skeleton, Typography } from "antd";
import { DownOutlined } from "@ant-design/icons";
import type { ProjectProgress, StageProgress } from "../../api";

const DOWNLOADED_COLOR = "#7cb3d9";
const ANALYSED_COLOR = "#4a8b3a";

interface ProjectProgressCardProps {
  progress?: ProjectProgress;
  isLoading: boolean;
  isError: boolean;
  updatedAt?: number;
  refreshSeconds: number;
}

function percentOf({ completed, total }: StageProgress) {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

function describeStatus({ featureDownloads, recognitionJobs }: ProjectProgress) {
  if (featureDownloads.total === 0) {
    return { label: "Discovering sheets", badge: "processing" as const };
  }
  if (recognitionJobs.completed === recognitionJobs.total) {
    return { label: "Completed", badge: "success" as const };
  }
  if (featureDownloads.completed < featureDownloads.total) {
    return { label: "Downloading sheets", badge: "processing" as const };
  }
  return { label: "Analysing sheets", badge: "processing" as const };
}

function StageRow({ label, stage, color }: { label: string; stage: StageProgress; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-neutral-700">{label}</span>
        <span className="tabular-nums text-neutral-500">
          {stage.completed} / {stage.total}
        </span>
      </div>
      <Progress percent={percentOf(stage)} strokeColor={color} size="small" />
    </div>
  );
}

export function ProjectProgressCard({
  progress,
  isLoading,
  isError,
  updatedAt,
  refreshSeconds,
}: ProjectProgressCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading && !progress) {
    return (
      <section className="border border-[#c9d0d5] bg-white p-4">
        <Skeleton active title={false} paragraph={{ rows: 2 }} />
      </section>
    );
  }

  if (!progress) {
    return <Alert type="error" showIcon title="Could not load the project progress." />;
  }

  const { featureDownloads, recognitionJobs } = progress;
  const status = describeStatus(progress);
  const overallPercent =
    featureDownloads.total === 0
      ? 0
      : Math.round(
          ((featureDownloads.completed + recognitionJobs.completed) /
            (featureDownloads.total + recognitionJobs.total)) *
            100,
        );
  const waitingForDownload = featureDownloads.total - featureDownloads.completed;
  const waitingForAnalysis = featureDownloads.completed - recognitionJobs.completed;

  return (
    <section className="border border-[#c9d0d5] bg-white">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="block w-full cursor-pointer px-4 pt-3 pb-2 text-left hover:bg-[#f6f8fa]"
      >
        <div className="flex items-center justify-between gap-3">
          <Badge status={status.badge} text={<span className="font-medium">{status.label}</span>} />
          <span className="flex items-center gap-2 text-sm tabular-nums text-neutral-600">
            {overallPercent}%
            <DownOutlined
              className={`text-xs transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </span>
        </div>
        <Progress
          percent={percentOf(featureDownloads)}
          success={{ percent: percentOf(recognitionJobs), strokeColor: ANALYSED_COLOR }}
          strokeColor={DOWNLOADED_COLOR}
          showInfo={false}
          size="small"
          className="!mb-0"
        />
        <div className="flex gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2" style={{ background: ANALYSED_COLOR }} />
            Analysed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2" style={{ background: DOWNLOADED_COLOR }} />
            Downloaded
          </span>
        </div>
      </button>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-[#e3e7ea] px-4 py-3">
          <StageRow label="Sheets downloaded" stage={featureDownloads} color={DOWNLOADED_COLOR} />
          <StageRow label="Sheets analysed" stage={recognitionJobs} color={ANALYSED_COLOR} />
          <dl className="m-0 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-neutral-500">Waiting for download</dt>
              <dd className="m-0 tabular-nums">{waitingForDownload}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Waiting for analysis</dt>
              <dd className="m-0 tabular-nums">{waitingForAnalysis}</dd>
            </div>
          </dl>
          <Typography.Text type="secondary" className="!text-xs">
            {isError
              ? "Refresh failed, showing the last known progress."
              : updatedAt
                ? `Updated ${new Date(updatedAt).toLocaleTimeString()}`
                : null}{" "}
            · refreshes every {refreshSeconds} s
          </Typography.Text>
        </div>
      )}
    </section>
  );
}
