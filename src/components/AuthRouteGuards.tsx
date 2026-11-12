import { Flex, Spin, Typography } from "antd";
import { Navigate, Outlet, useParams, useSearchParams } from "react-router";
import { useAuthStore } from "../stores/authStore";
import { useOrganizationCapabilities } from "../hooks/useOrganizationCapabilities";
import { isAdministrator } from "../permissions/organizationCapabilities";
import { AccessFeedback } from "./AccessFeedback";
import CrudPageLayout from "./ProjectsPageLayout";

export function RequireAuth() {
  const user = useAuthStore((state) => state.user);
  const loggingOut = useAuthStore((state) => state.loggingOut);

  if (loggingOut) {
    return (
      <CrudPageLayout>
        <Flex vertical align="center" gap="middle">
          <Spin />
          <Typography.Text>Signing out…</Typography.Text>
        </Flex>
      </CrudPageLayout>
    );
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export function RequireGuest() {
  const user = useAuthStore((state) => state.user);

  return user ? <Navigate to="/projects" replace /> : <Outlet />;
}

export function RequireAdministrator() {
  const user = useAuthStore((state) => state.user);
  return isAdministrator(user) ? <Outlet /> : (
    <CrudPageLayout><AccessFeedback state="denied" onRetry={() => window.location.reload()} /></CrudPageLayout>
  );
}

export function RequireOrganizationOwner() {
  const { organizationId } = useParams();
  const access = useOrganizationCapabilities(organizationId);
  if (access.state !== "ready") {
    return <CrudPageLayout><AccessFeedback state={access.state} error={access.query.error} onRetry={() => void access.retry()} /></CrudPageLayout>;
  }
  return access.administrator || (organizationId ? access.canManageUsers : access.manageable.length > 0)
    ? <Outlet />
    : <CrudPageLayout><AccessFeedback state="denied" onRetry={() => void access.retry()} /></CrudPageLayout>;
}

export function RequireProjectCreator() {
  const [searchParams] = useSearchParams();
  const organizationId = searchParams.get("organizationId") || undefined;
  const access = useOrganizationCapabilities(organizationId);
  if (access.state !== "ready") {
    return <CrudPageLayout><AccessFeedback state={access.state} error={access.query.error} onRetry={() => void access.retry()} /></CrudPageLayout>;
  }
  const allowed = organizationId ? access.canCreateProject : access.administrator || access.editable.length > 0;
  return allowed ? <Outlet /> : <CrudPageLayout><AccessFeedback state="denied" onRetry={() => void access.retry()} /></CrudPageLayout>;
}
