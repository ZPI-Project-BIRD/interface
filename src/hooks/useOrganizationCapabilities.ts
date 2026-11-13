import { useQuery, useQueryClient, type QueryClient } from "react-query";
import { api } from "../api";
import { privateQueryKey } from "../queryClient";
import { isCurrentSession, useAuthStore } from "../stores/authStore";
import { isAdministrator, isPermissionDenied, organizationCapabilities } from "../permissions/organizationCapabilities";

export function useOrganizations() {
  const user = useAuthStore((state) => state.user);
  const sessionId = useAuthStore((state) => state.sessionId);
  const loggingOut = useAuthStore((state) => state.loggingOut);
  const administrator = isAdministrator(user);
  const allQuery = useQuery(
    privateQueryKey(sessionId, "organizations", "all"),
    ({ signal }) => api.organizations.getAll({ signal }),
    { enabled: administrator && !loggingOut, staleTime: 60_000 },
  );
  const query = useQuery(
    privateQueryKey(sessionId, "organizations", "my"),
    ({ signal }) => api.organizations.getMy({ signal }),
    { enabled: Boolean(user) && !loggingOut, staleTime: 60_000 },
  );
  // Refetching or a failed background check must not leave stale privileges usable.
  const ready = query.isSuccess && !query.isFetching && !loggingOut;
  const memberships = ready ? query.data : [];
  return {
    query, allQuery, administrator, memberships,
    available: administrator ? allQuery.data ?? [] : memberships.map(({ organization }) => organization),
    editable: memberships.filter((membership) => organizationCapabilities(user, membership).canCreateProject),
    manageable: memberships.filter((membership) => organizationCapabilities(user, membership).canManageUsers),
  };
}

export function reportOrganizationDenial(client: QueryClient, sessionId: number, organizationId: string, error: unknown) {
  if (!isCurrentSession(sessionId) || !isPermissionDenied(error)) return;
  // Latch denial until an explicit retry, even if a membership refresh still returns the old role.
  client.setQueryData(privateQueryKey(sessionId, "organization-denied", organizationId), true);
  void client.invalidateQueries(privateQueryKey(sessionId, "organizations"));
}

export function useOrganizationCapabilities(organizationId?: string) {
  const organizations = useOrganizations();
  const user = useAuthStore((state) => state.user);
  const sessionId = useAuthStore((state) => state.sessionId);
  const client = useQueryClient();
  const denial = useQuery<boolean>(privateQueryKey(sessionId, "organization-denied", organizationId), {
    enabled: false, initialData: false, staleTime: Infinity,
  });
  const membership = organizations.query.data?.find(({ organization }) => organization.id === organizationId);
  const state: "loading" | "error" | "denied" | "ready" = denial.data ? "denied"
    : organizations.administrator ? "ready"
    : organizations.query.isError ? isPermissionDenied(organizations.query.error) ? "denied" : "error"
    : !organizations.query.isSuccess || organizations.query.isFetching ? "loading"
    : organizationId && !membership ? "denied" : "ready";
  const capabilities = organizationCapabilities(state === "ready" ? user : null, membership);
  return {
    ...organizations,
    ...capabilities,
    administrator: organizations.administrator,
    state,
    organization: membership?.organization ?? organizations.allQuery.data?.find(({ id }) => id === organizationId)
      ?? (organizationId ? { id: organizationId, name: organizationId } : undefined),
    reportError: (error: unknown, id = organizationId) => {
      if (id) reportOrganizationDenial(client, sessionId, id, error);
    },
    retry: async () => {
      const result = await organizations.query.refetch();
      if (!isCurrentSession(sessionId)) return;
      if (organizations.administrator || result.isSuccess) {
        client.setQueryData(privateQueryKey(sessionId, "organization-denied", organizationId), false);
      }
    },
  };
}
