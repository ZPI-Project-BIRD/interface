import type { ReactNode } from "react";
import { Typography } from "antd";

function CrudPageHeader({ actions, title }: { actions: ReactNode; title: ReactNode }) {
  return (
    <section className="mb-4 flex flex-col gap-4 border border-[#c9d0d5] bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Typography.Title level={2} className="mb-1! text-2xl!">
          {title}
        </Typography.Title>
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end grow max-w-150">
        {actions}
      </div>
    </section>
  );
}

export default CrudPageHeader;
