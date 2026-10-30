import { Button, Flex, Result, Spin } from "antd";
import { useQuery } from "react-query";
import { Navigate, Outlet } from "react-router";
import { api } from "../api";
import { useAuthStore } from "../stores/authStore";

export function RequireAuth() {
  const user = useAuthStore((state) => state.user);

  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export function RequireGuest() {
  const user = useAuthStore((state) => state.user);

  return user ? <Navigate to="/projects" replace /> : <Outlet />;
}

export function RequireOrganizationOwner() {
  const username = useAuthStore((state) => state.user?.username);
  const ownedOrganizationsQuery = useQuery(
    ["organizations", "owned", username],
    () => api.organizations.getOwned(),
    { enabled: Boolean(username), staleTime: 60_000 },
  );

  if (ownedOrganizationsQuery.isLoading) {
    return (
      <Flex align="center" justify="center" className="min-h-dvh">
        <Spin size="large" />
      </Flex>
    );
  }

  if (ownedOrganizationsQuery.isError) {
    return (
      <Flex align="center" justify="center" className="min-h-dvh">
        <Result
          status="error"
          title="Unable to verify organization ownership"
          subTitle={
            ownedOrganizationsQuery.error instanceof Error
              ? ownedOrganizationsQuery.error.message
              : "Please try again."
          }
          extra={
            <Button type="primary" onClick={() => void ownedOrganizationsQuery.refetch()}>
              Retry
            </Button>
          }
        />
      </Flex>
    );
  }

  return ownedOrganizationsQuery.data?.length ? (
    <Outlet />
  ) : (
    <Navigate to="/projects" replace />
  );
}
