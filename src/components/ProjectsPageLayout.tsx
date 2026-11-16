import { useState, type ReactNode } from "react";
import { Link, NavLink, useParams, useSearchParams } from "react-router";
import logo from "../assets/logo.png";
import { useAuthStore } from "../stores/authStore";
import { Alert, Button, Drawer, Modal } from "antd";
import { LogoutOutlined, MenuOutlined } from "@ant-design/icons";
import { useOrganizationCapabilities } from "../hooks/useOrganizationCapabilities";

interface CrudPageLayoutProps {
  children: ReactNode;
  headerAction?: ReactNode;
  /** Fill the rest of the viewport edge to edge instead of using a padded, centered column. */
  fullBleed?: boolean;
}

function CrudPageLayout({ children, headerAction, fullBleed = false }: CrudPageLayoutProps) {
  const logout = useAuthStore((state) => state.logout);
  const loggingOut = useAuthStore((state) => state.loggingOut);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const hasDrafts = useAuthStore((state) => Object.keys(state.annotationDrafts).length > 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, modalContext] = Modal.useModal();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const organizationId = params.organizationId ?? searchParams.get("organizationId") ?? undefined;
  const access = useOrganizationCapabilities(organizationId);
  const canManageOrganizations = access.state === "ready" &&
    (organizationId ? access.canManageUsers : access.administrator || access.manageable.length > 0);
  const navigationItems = [
    { to: "/projects", label: "Projects" },
    ...(canManageOrganizations ? [{ to: organizationId ? `/organizations/${encodeURIComponent(organizationId)}` : "/organizations", label: "Organizations" }] : []),
    ...(access.administrator ? [{ to: "/admin", label: "Administration" }] : []),
    { to: "/account", label: "Account" },
  ];
  const signOut = () => {
    if (hasDrafts) {
      modal.confirm({ title: "Log out and discard unsaved outlines?",
        content: "Your unsaved annotation drafts will be cleared when you sign out.",
        okText: "Discard drafts and log out", cancelText: "Stay signed in", okButtonProps: { danger: true },
        onOk: () => logout(),
      });
    } else void logout().catch(() => {});
  };

  return (
    <div className={fullBleed ? "flex h-dvh flex-col bg-[#f4f5f6]" : "min-h-dvh bg-[#f4f5f6]"}>
      {modalContext}
      <header className="border-b-4 border-[#4a8b3a] bg-[#123f5d] text-white">
        <div className="mx-auto flex min-h-16 max-w-360 items-center justify-between gap-3 px-4 py-2 sm:px-7">
          <Link to="/projects" className="flex min-w-0 items-center gap-3 text-white! no-underline">
            <img src={logo} alt="BIRD" className="size-10 shrink-0 invert object-contain -mr-1" />
            <div className="min-w-0">
              <div className="text-base font-semibold tracking-wide">BIRD</div>
              <div className="hidden truncate text-xs text-white/70 2xl:block">
                Building Irregularity Recognition and Detection
              </div>
            </div>
          </Link>

          <Button ghost className="xl:!hidden" icon={<MenuOutlined />} aria-label="Open navigation"
            aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(true)}>Menu</Button>
          <div className="hidden min-h-12 shrink-0 self-stretch xl:flex">
            <nav className="flex" aria-label="Primary navigation">
              {navigationItems.map(({ to, label }) => <NavLink key={to} to={to}
                className={({ isActive }) => `flex items-center border-b-2 px-3 text-sm font-medium !text-white no-underline ${isActive ? "border-white bg-white/10" : "border-transparent hover:bg-white/5"}`}>{label}</NavLink>)}
            </nav>

            <div className="ml-3 flex items-center gap-3 border-l border-white/20 pl-3">
              {headerAction}
              <Button
                ghost
                icon={<LogoutOutlined />}
                loading={loggingOut}
                onClick={signOut}
              >
                Log out
              </Button>
            </div>
          </div>
        </div>
      </header>
      <Drawer title="Navigation" open={menuOpen} onClose={() => setMenuOpen(false)} size={320} destroyOnHidden>
        <nav id="mobile-navigation" aria-label="Mobile navigation" className="flex flex-col gap-2">
          {navigationItems.map(({ to, label }) => <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}
            className={({ isActive }) => `rounded px-4 py-3 text-base no-underline ${isActive ? "bg-[#eaf3e8] !font-semibold !text-[#376f31]" : "!text-[#123f5d] hover:bg-neutral-100"}`}>{label}</NavLink>)}
        </nav>
        <div className="mt-5 flex flex-col items-start gap-3 border-t border-neutral-200 pt-5">
          {headerAction}
          <Button icon={<LogoutOutlined />} loading={loggingOut} onClick={signOut}>Log out</Button>
        </div>
      </Drawer>

      <main
        className={fullBleed ? "flex min-h-0 flex-1 flex-col" : "mx-auto max-w-360 p-4 sm:p-6"}
      >
        {error && (
          <Alert
            type="error"
            showIcon
            title="Logout failed"
            description={error}
            closable
            onClose={clearError}
          />
        )}
        {children}
      </main>
    </div>
  );
}

export default CrudPageLayout;
