import { useState } from "react";
import { Alert, Badge, Progress, Skeleton, Typography } from "antd";
import { DownOutlined, HourglassOutlined } from "@ant-design/icons";
import { palette } from "../../theme";
import type { ProjectProgress, QueuePosition, StageProgress } from "../../api";
import { describeStatus, overallPercent } from "./progressStatus";

const DOWNLOADED_COLOR = palette.primaryMuted;
const ANALYSED_COLOR = palette.primary;

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

function StageRow({ label, stage, color }: { label: string; stage: StageProgress; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink">{label}</span>
        <span className="tabular-nums text-muted">
          {stage.completed} / {stage.total}
        </span>
      </div>
      <Progress percent={percentOf(stage)} strokeColor={color} size="small" />
    </div>
  );
}

function QueueBanner({ queue }: { queue: QueuePosition }) {
  if (queue.nextPosition === null || queue.queued === 0) return null;
  const ahead = queue.nextPosition - 1;
  const sheets = (count: number) => `${count} sheet${count === 1 ? "" : "s"}`;
  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-app-border bg-brand-soft px-4 py-3"
    >
      <HourglassOutlined className="text-lg text-brand-ink" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold tracking-[0.08em] text-brand-ink uppercase">
          {ahead === 0 ? "Next in analysis queue" : "Analysis queue position"}
        </div>
        <div className="text-xs text-secondary">
          {ahead === 0 ? "Nothing ahead" : `${sheets(ahead)} ahead`} · {sheets(queue.queued)} of this project queued
          {queue.lastPosition !== null && queue.lastPosition !== queue.nextPosition && <>, last at #{queue.lastPosition}</>}
        </div>
      </div>
      <div className="text-right leading-none">
        <div className="text-2xl font-semibold tabular-nums text-brand-ink">#{queue.nextPosition}</div>
        <div className="mt-1 text-xs tabular-nums text-muted">of {queue.total}</div>
      </div>
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
      <section className="app-card p-4">
        <Skeleton active title={false} paragraph={{ rows: 2 }} />
      </section>
    );
  }

  if (!progress) {
    return <Alert type="error" showIcon title="Could not load the project progress." />;
  }

  const { featureDownloads, recognitionJobs } = progress;
  const status = describeStatus(progress);
  const percent = overallPercent(progress);
  const waitingForDownload = featureDownloads.total - featureDownloads.completed;
  const waitingForAnalysis = featureDownloads.completed - recognitionJobs.completed;

  return (
    <section className="app-card overflow-hidden">
      {featureDownloads.total === 0 && <Alert
        type={progress.discovery?.status === "FAILED" ? "error" : "info"} showIcon title={status.label}
        description={progress.discovery?.status === "SUCCEEDED" ? "Discovery completed without finding source sheets in this area."
          : progress.discovery?.status === "FAILED" ? "Feature discovery failed. An editor can retry it for this project."
          : "Waiting for discovery information. Processing status refreshes automatically."}
      />}
      {progress.queue && <QueueBanner queue={progress.queue} />}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="block w-full cursor-pointer px-4 pt-3 pb-2 text-left hover:bg-surface-muted"
      >
        <div className="flex items-center justify-between gap-3">
          <Badge status={status.badge} text={<span className="font-medium">{status.label}</span>} />
          <span className="flex items-center gap-2 text-sm tabular-nums text-secondary">
            {percent}%
            <DownOutlined
              className={`text-xs transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </span>
        </div>
        <Progress
          percent={percentOf(featureDownloads)}
          success={{
            percent: percentOf(recognitionJobs),
            strokeColor: ANALYSED_COLOR,
          }}
          strokeColor={DOWNLOADED_COLOR}
          showInfo={false}
          size="small"
          className="!mb-0"
        />
        <div className="flex gap-4 text-xs text-muted">
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
        <div className="flex flex-col gap-2 border-t border-app-border px-4 py-3">
          <StageRow label="Sheets downloaded" stage={featureDownloads} color={DOWNLOADED_COLOR} />
          <StageRow label="Sheets analysed" stage={recognitionJobs} color={ANALYSED_COLOR} />
          {progress.discovery && <Typography.Text type="secondary">Discovery: {progress.discovery.status.toLowerCase()} · {progress.discovery.attempts} attempt(s)</Typography.Text>}
          {progress.jobStates && <Typography.Text>{progress.jobStates.pending} pending · {progress.jobStates.running} running · {progress.jobStates.failed} failed</Typography.Text>}
          <dl className="m-0 grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted">Waiting for download</dt>
              <dd className="m-0 tabular-nums">{waitingForDownload}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Waiting for analysis</dt>
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
