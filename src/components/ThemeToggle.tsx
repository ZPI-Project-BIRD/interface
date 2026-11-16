import { Button } from "antd";
import { MoonOutlined, SunOutlined } from "@ant-design/icons";
import { useThemeStore } from "../stores/themeStore";

export function ThemeToggle() {
  const mode = useThemeStore((state) => state.mode);
  const toggle = useThemeStore((state) => state.toggle);
  return <Button shape="circle" className="!size-11 shrink-0" role="switch" aria-label="Dark mode"
    aria-checked={mode === "dark"} title={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
    icon={mode === "dark" ? <SunOutlined /> : <MoonOutlined />} onClick={toggle} />;
}
