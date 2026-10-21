import { Layout, Menu, Space, Typography, theme as antdTheme } from "antd";
import type { MenuProps } from "antd";

const navigationItems: MenuProps["items"] = [
  {
    key: "1",
    label: "Area Selector",
    children: [
      { key: "group-1", label: "Group 1" },
      { key: "group-2", label: "Group 2" },
      { key: "group-3", label: "Group 3" },
    ],
  },
  { key: "2", label: "Navigation Two" },
  { key: "3", label: "Navigation Three" },
];

const Navbar = () => {
  const { token } = antdTheme.useToken();

  return (
    <Layout.Header
      className="flex !h-auto min-h-24 items-center justify-between gap-6 !px-10 !leading-normal max-[900px]:flex-col max-[900px]:items-stretch max-[900px]:gap-0 max-[900px]:!px-5 max-[900px]:!pt-4"
      style={{
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: token.boxShadowTertiary,
      }}
    >
      <Space className="min-w-0 text-inherit" size="middle">
        {/* TODO: Add logo */}

        <Typography.Title
          level={2}
          className="!m-0 whitespace-nowrap !text-[clamp(20px,2vw,32px)] max-[900px]:whitespace-normal max-[900px]:!text-lg"
        >
          Building Irregularity Recognition and Detection
        </Typography.Title>
      </Space>

      <Menu
        className="min-w-[430px] justify-end self-stretch !border-b-0 !bg-transparent !leading-[96px] max-[900px]:min-w-0 max-[900px]:justify-start max-[900px]:!leading-[52px]"
        mode="horizontal"
        items={navigationItems}
        defaultSelectedKeys={["1"]}
      />
    </Layout.Header>
  );
};

export default Navbar;
