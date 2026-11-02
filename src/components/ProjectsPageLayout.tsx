import type { ReactNode } from "react";
import { useQuery } from "react-query";
import { Link, NavLink } from "react-router";
import { api } from "../api";
import logo from "../assets/logo.png";
import { useAuthStore } from "../stores/authStore";
import { Alert, Button } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import { privateQueryKey } from "../queryClient";

interface CrudPageLayoutProps {
  children: ReactNode;
  headerAction?: ReactNode;
}

function CrudPageLayout({ children, headerAction }: CrudPageLayoutProps) {
  const username = useAuthStore((state) => state.user?.username);
  const sessionId = useAuthStore((state) => state.sessionId);
  const logout = useAuthStore((state) => state.logout);
  const loggingOut = useAuthStore((state) => state.loggingOut);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);
  const ownedOrganizationsQuery = useQuery(
    privateQueryKey(sessionId, "organizations", "owned"),
    ({ signal }) => api.organizations.getOwned({ signal }),
    { enabled: Boolean(username) && !loggingOut, staleTime: 60_000 },
  );
  const canManageOrganizations = (ownedOrganizationsQuery.data?.length ?? 0) > 0;
  const navigationClassName = ({ isActive }: { isActive: boolean }) =>
    `flex items-center border-b-2 px-3 text-sm font-medium !text-white no-underline ${
      isActive
        ? "border-white bg-white/10"
        : "border-transparent text-white/75 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <div className="min-h-dvh bg-[#f4f5f6]">
      <header className="border-b-4 border-[#4a8b3a] bg-[#123f5d] text-white">
        <div className="mx-auto flex min-h-16 max-w-360 items-center justify-between gap-4 px-5 py-2 sm:px-7">
          <Link to="/projects" className="flex min-w-0 items-center gap-3 text-white! no-underline">
            <img src={logo} alt="BIRD" className="size-10 shrink-0 invert object-contain -mr-1" />
            <div className="min-w-0">
              <div className="text-base font-semibold tracking-wide">BIRD</div>
              <div className="hidden truncate text-xs text-white/70 sm:block">
                Building Irregularity Recognition and Detection
              </div>
            </div>
          </Link>

          <div className="flex min-h-12 self-stretch">
            <nav className="flex" aria-label="Primary navigation">
              <NavLink to="/projects" className={navigationClassName}>
                Projects
              </NavLink>
              {canManageOrganizations && (
                <NavLink to="/organizations" className={navigationClassName}>
                  Organizations
                </NavLink>
              )}
              <NavLink to="/account" className={navigationClassName}>
                Account
              </NavLink>
            </nav>

            <div className="ml-3 flex items-center gap-3 border-l border-white/20 pl-3">
              {headerAction}
              <Button
                ghost
                icon={<LogoutOutlined />}
                loading={loggingOut}
                onClick={() => { void logout().catch(() => {}); }}
              >
                Log out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-360 p-4 sm:p-6">
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
