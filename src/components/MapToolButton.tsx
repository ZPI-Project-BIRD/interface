import type { ReactNode } from "react";
import { Tooltip, type TooltipProps } from "antd";

export function MapToolButton({ label, icon, active = false, disabled = false, tooltipPlacement = "right", onClick }: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  disabled?: boolean;
  tooltipPlacement?: TooltipProps["placement"];
  onClick: () => void;
}) {
  return (
    <Tooltip title={label} placement={tooltipPlacement}>
      <button type="button" aria-label={label} aria-pressed={active} disabled={disabled} onClick={onClick}
        className={`map-tool-button${active ? " map-tool-button-active" : ""}`}>
        {icon}
      </button>
    </Tooltip>
  );
}

export function RulerIcon({ crossed = false }: { crossed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 15.5 15.5 3 21 8.5 8.5 21z" />
      <path d="M6 12.5l2 2M9 9.5l1.5 1.5M12 6.5l2 2" />
      {crossed && <path d="M3 3l18 18" />}
    </svg>
  );
}
