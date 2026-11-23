import type { QueryClient } from "react-query";
import type { Organization, OrganizationMembership, Project } from "../api";
import { privateQueryKey } from "../queryClient";
import { isCurrentSession } from "../stores/authStore";

export interface ProjectGroup { organization: Organization; projects: Project[] }

function updateProjectLists(client: QueryClient, sessionId: number, organizationId: string, projects: Project[], replace: boolean) {
  if (!isCurrentSession(sessionId)) return;
  const memberships = client.getQueryData<OrganizationMembership[]>(privateQueryKey(sessionId, "organizations", "my")) ?? [];
  const previousKnown = client.getQueryData<Organization[]>(privateQueryKey(sessionId, "known-project-organizations")) ?? [];
  const allOrganizations = client.getQueryData<Organization[]>(privateQueryKey(sessionId, "organizations", "all")) ?? [];
  const organization = memberships.find(({ organization }) => organization.id === organizationId)?.organization
    ?? allOrganizations.find(({ id }) => id === organizationId)
    ?? previousKnown.find(({ id }) => id === organizationId) ?? { id: organizationId, name: organizationId };
  const prefix = privateQueryKey(sessionId, "projects");
  void client.cancelQueries({ queryKey: prefix }, { silent: true, revert: false });
  client.setQueryData<Organization[]>(privateQueryKey(sessionId, "known-project-organizations"),
    [...previousKnown.filter(({ id }) => id !== organizationId), organization]);
  const merge = (current: Project[]) => replace ? projects : [
    ...current.filter(({ id }) => !projects.some((project) => project.id === id)), ...projects,
  ];
  for (const [key, groups] of client.getQueriesData<ProjectGroup[]>(prefix)) {
    if (!groups || (Array.isArray(key) && key[3] && key[3] !== organizationId)) continue;
    const existing = groups.find((group) => group.organization.id === organizationId);
    client.setQueryData(key, existing ? groups.map((group) => group !== existing ? group : {
      organization, projects: merge(group.projects),
    }) : [...groups, { organization, projects }]);
  }
  const organizations = Array.from(new Map([...memberships.map(({ organization }) => organization), ...previousKnown, organization]
    .map((organization) => [organization.id, organization])).values());
  const listKey = privateQueryKey(sessionId, "projects", undefined, organizations.map(({ id }) => id));
  if (!client.getQueryData(listKey)) {
    const previous = client.getQueriesData<ProjectGroup[]>(prefix).find(([key]) => Array.isArray(key) && !key[3])?.[1] ?? [];
    client.setQueryData(listKey, previous.some((group) => group.organization.id === organizationId)
      ? previous : [...previous, { organization, projects }]);
  }
  void client.invalidateQueries(prefix);
}

export function cacheAcceptedProject(client: QueryClient, sessionId: number, project: Project) {
  if (!isCurrentSession(sessionId)) return;
  client.setQueryData(privateQueryKey(sessionId, "project", project.organizationId, project.id), project);
  updateProjectLists(client, sessionId, project.organizationId, [project], false);
}

export function cacheOrganizationProjects(client: QueryClient, sessionId: number, organizationId: string, projects: Project[]) {
  updateProjectLists(client, sessionId, organizationId, projects, true);
}
