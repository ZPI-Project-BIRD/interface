import { useState } from "react";
import { Button, Popconfirm, Typography } from "antd";
import { DownOutlined } from "@ant-design/icons";

interface ProjectDangerZoneProps {
  projectName: string;
  isDeleting: boolean;
  onDelete: () => void;
}

export function ProjectDangerZone({ projectName, isDeleting, onDelete }: ProjectDangerZoneProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="overflow-hidden rounded-2xl border border-danger-border bg-surface">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-2.5 text-left text-sm font-medium text-danger-ink hover:bg-danger-soft"
      >
        Danger zone
        <DownOutlined className={`text-xs transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="flex items-center justify-between gap-3 border-t border-danger-border px-4 py-3">
          <div className="min-w-0">
            <Typography.Text strong className="block text-sm">
              Delete this project
            </Typography.Text>
            <Typography.Text type="secondary" className="block !text-xs">
              Removes the project and all of its detections permanently.
            </Typography.Text>
          </div>
          <Popconfirm
            title="Delete project?"
            description={
              <span className="block max-w-72">
                “{projectName}” and all of its detections will be permanently deleted.
              </span>
            }
            okText="Delete"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
            placement="topRight"
            onConfirm={onDelete}
          >
            <Button danger className="shrink-0" loading={isDeleting}>
              Delete
            </Button>
          </Popconfirm>
        </div>
      )}
    </section>
  );
}
