import type { ReactNode } from "react";
import { Typography } from "antd";

function CrudPageHeader({ actions, title }: { actions: ReactNode; title: ReactNode }) {
  return (
    <section className="mb-4 flex flex-col gap-4 app-card p-5">
      <div className="min-w-0">
        <Typography.Title level={2} className="mb-1! text-2xl!">
          {title}
        </Typography.Title>
      </div>

      {actions && <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">{actions}</div>}
    </section>
  );
}

export default CrudPageHeader;
