import { useState, type ReactNode } from "react";
import { Link, NavLink, useParams, useSearchParams } from "react-router";
import logo from "../assets/logo.png";
import { useAuthStore } from "../stores/authStore";
import { Alert, Button, Drawer, Modal } from "antd";
import { LogoutOutlined, MenuOutlined } from "@ant-design/icons";
import { useOrganizationCapabilities } from "../hooks/useOrganizationCapabilities";
import { ThemeToggle } from "./ThemeToggle";

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
    <div className={fullBleed ? "flex h-dvh flex-col bg-page" : "min-h-dvh bg-page"}>
      {modalContext}
      <header className="border-b border-app-border bg-surface text-ink">
        <div className="mx-auto flex min-h-20 max-w-360 items-center justify-between gap-3 px-4 py-3 sm:px-7">
          <Link to="/projects" className="flex min-w-0 items-center gap-3 !text-ink no-underline">
            <img src={logo} alt="BIRD" className="brand-logo size-10 shrink-0 object-contain" />
            <div className="min-w-0">
              <div className="text-base font-semibold tracking-wide">BIRD</div>
              <div className="hidden truncate text-xs text-muted 2xl:block">
                Building Irregularity Recognition and Detection
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2 xl:hidden">
            <ThemeToggle />
            <Button icon={<MenuOutlined />} aria-label="Open navigation"
              aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(true)}>Menu</Button>
          </div>
          <div className="hidden min-h-12 shrink-0 self-stretch xl:flex">
            <nav className="flex items-center gap-1" aria-label="Primary navigation">
              {navigationItems.map(({ to, label }) => <NavLink key={to} to={to}
                className={({ isActive }) => `flex min-h-11 items-center rounded-lg px-4 text-sm font-medium no-underline ${isActive ? "bg-brand-soft !text-brand-ink" : "!text-secondary hover:bg-surface-muted hover:!text-ink"}`}>{label}</NavLink>)}
            </nav>

            <div className="ml-4 flex items-center gap-3 border-l border-app-border pl-4">
              <ThemeToggle />
              {headerAction}
              <Button
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
            className={({ isActive }) => `rounded-lg px-4 py-3 text-base no-underline ${isActive ? "bg-brand-soft !font-semibold !text-brand-ink" : "!text-secondary hover:bg-surface-muted"}`}>{label}</NavLink>)}
        </nav>
        <div className="mt-5 flex flex-col items-start gap-3 border-t border-app-border pt-5">
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
