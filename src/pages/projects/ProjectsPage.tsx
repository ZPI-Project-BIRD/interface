import { useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Empty,
  Input,
  Select,
  Table,
  Typography,
  type TableColumnsType,
} from "antd";
import { useQuery, useQueryClient } from "react-query";
import { Link, useSearchParams } from "react-router";
import { api, type Organization, type Project } from "../../api";
import type { ProjectGroup } from "../../projects/projectCache";
import CrudPageHeader from "../../components/CrudPageHeader";
import CrudPageLayout from "../../components/ProjectsPageLayout";
import { useAuthStore } from "../../stores/authStore";
import { privateQueryKey } from "../../queryClient";
import { ProjectStatus } from "../../components/project/ProjectStatus";
import { AccessFeedback } from "../../components/AccessFeedback";
import { reportOrganizationDenial, useOrganizationCapabilities } from "../../hooks/useOrganizationCapabilities";
import { PolandMiniMap } from "../../components/project/PolandMiniMap";

const projectColumns: TableColumnsType<Project> = [
  {
    title: "Project",
    dataIndex: "name",
    key: "name",
    render: (name: string, project) => (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar shape="square" size={28} className="shrink-0 !bg-[#123f5d] !text-xs">
          {name.charAt(0).toLocaleUpperCase()}
        </Avatar>
        <div className="flex min-w-0 flex-col">
          <Typography.Text className="min-w-0 truncate font-medium">{name}</Typography.Text>
          <ProjectStatus project={project} />
        </div>
      </div>
    ),
  },
  {
    title: "Location",
    key: "location",
    width: 96,
    render: (_, project) => <PolandMiniMap project={project} />,
  },
  {
    title: "Actions",
    key: "actions",
    align: "right",
    width: 120,
    render: (_, project) => (
      <Link to={`/projects/${project.organizationId}/${project.id}`}>
        <Button type="link">Open</Button>
      </Link>
    ),
  },
];

const organizationColumns: TableColumnsType<ProjectGroup> = [
  {
    title: "Organization",
    key: "organization",
    render: (_, group) => <Typography.Text strong>{group.organization.name}</Typography.Text>,
  },
];

async function getProjects(organizations: Organization[], load: (organizationId: string) => Promise<Project[]>): Promise<ProjectGroup[]> {
  const groups = await Promise.all(
    organizations.map(async (organization) => ({
      organization,
      projects: await load(organization.id),
    })),
  );

  return groups.toSorted((left, right) =>
    left.organization.name.localeCompare(right.organization.name),
  );
}

function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"ascending" | "descending">("ascending");
  const sessionId = useAuthStore((state) => state.sessionId);
  const [searchParams] = useSearchParams();
  const selectedOrganizationId = searchParams.get("organizationId") || undefined;
  const access = useOrganizationCapabilities(selectedOrganizationId);
  const queryClient = useQueryClient();
  const knownOrganizations = useQuery<Organization[]>(privateQueryKey(sessionId, "known-project-organizations"), { enabled: false, initialData: [], cacheTime: Infinity });
  const organizations = Array.from(new globalThis.Map([
    ...(access.administrator ? access.available : []).map((organization) => [organization.id, organization] as const),
    ...(access.query.data ?? []).map(({ organization }) => [organization.id, organization] as const),
    ...(access.administrator ? (knownOrganizations.data ?? []).filter(({ id }) => !access.query.data?.some(({ organization }) => organization.id === id)) : []).map((organization) => [organization.id, organization] as const),
  ]).values());
  const projectsQuery = useQuery(
    privateQueryKey(sessionId, "projects", selectedOrganizationId, organizations.map(({ id }) => id)),
    ({ signal }) => getProjects(selectedOrganizationId
      ? [access.organization!]
      : organizations, async (organizationId) => {
      try { return await api.projects.getAll(organizationId, { signal }); }
      catch (error) { reportOrganizationDenial(queryClient, sessionId, organizationId, error); throw error; }
    }),
    { enabled: selectedOrganizationId ? access.state === "ready" && access.canRead : access.administrator ? access.allQuery.isSuccess : access.query.isSuccess },
  );
  const groups = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const visibleGroups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();

    return groups
      .map((group) => {
        const organizationMatches = group.organization.name.toLocaleLowerCase().includes(query);
        const projects = group.projects
          .filter(
            (project) =>
              !query || organizationMatches || project.name.toLocaleLowerCase().includes(query),
          )
          .toSorted((left, right) => {
            const comparison = left.name.localeCompare(right.name);
            return sort === "ascending" ? comparison : -comparison;
          });

        return { ...group, projects };
      })
      .filter(
        (group) =>
          !query ||
          group.organization.name.toLocaleLowerCase().includes(query) ||
          group.projects.length > 0,
      );
  }, [groups, search, sort]);
  const createButton = access.state === "ready" && (selectedOrganizationId ? access.canCreateProject : access.administrator || access.editable.length > 0) ? (
    <Link to={selectedOrganizationId ? `/projects/create?organizationId=${encodeURIComponent(selectedOrganizationId)}` : "/projects/create"}>
      <Button type="primary">New project</Button>
    </Link>
  ) : null;

  const listQuery = access.administrator ? access.allQuery : access.query;
  const canShowProjects = selectedOrganizationId ? access.state === "ready" : listQuery.isSuccess;
  return (
    <CrudPageLayout>
      <CrudPageHeader
        title={selectedOrganizationId ? `Projects · ${access.organization?.name ?? selectedOrganizationId}` : access.administrator ? "All projects" : "My projects"}
        actions={
          <>
            <Select
              value={sort}
              onChange={setSort}
              className="sm:w-44"
              options={[
                { value: "ascending", label: "Projects A–Z" },
                { value: "descending", label: "Projects Z–A" },
              ]}
            />
            <Input.Search
              allowClear
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter projects…"
              className="sm:w-64"
            />
            {selectedOrganizationId && access.canManageUsers && <Link to={`/organizations/${encodeURIComponent(selectedOrganizationId)}`}><Button>Manage organization</Button></Link>}
            {createButton}
          </>
        }
      />

      <section>
        {selectedOrganizationId && access.state !== "ready" && <AccessFeedback state={access.state} error={access.query.error} onRetry={() => void access.retry()} />}
        {!selectedOrganizationId && listQuery.isError && <AccessFeedback error={listQuery.error} onRetry={() => void listQuery.refetch()} />}
        {!selectedOrganizationId && listQuery.isLoading && <Typography.Paragraph>Loading organizations…</Typography.Paragraph>}
        {canShowProjects && projectsQuery.isLoading && (
          <Table<ProjectGroup>
            className="[&_.ant-table-thead>tr>th]:!bg-[#f6f8fa]"
            columns={organizationColumns}
            dataSource={[]}
            loading
            pagination={false}
            rowKey={(group) => group.organization.id}
            size="middle"
          />
        )}

        {projectsQuery.isError && <AccessFeedback error={projectsQuery.error} onRetry={() => { void access.retry().then(() => projectsQuery.refetch()); }} />}

        {canShowProjects && projectsQuery.isSuccess && groups.length === 0 && (
          <div className="border border-neutral-200 p-8">
            <Empty description={access.administrator ? "No organization memberships. Open a known organization from Administration." : "You do not have access to any organizations yet."}>
              {createButton}
            </Empty>
          </div>
        )}

        {canShowProjects && projectsQuery.isSuccess && groups.length > 0 && visibleGroups.length > 0 && (
          <Table<ProjectGroup>
            bordered
            className="[&_.ant-table-thead>tr>th]:!bg-[#f6f8fa]"
            columns={organizationColumns}
            dataSource={visibleGroups}
            expandable={{
              columnWidth: 44,
              defaultExpandAllRows: true,
              expandedRowRender: (group) => (
                <Table<Project>
                  showHeader={false}
                  bordered
                  className="rounded-none!"
                  columns={projectColumns}
                  dataSource={group.projects}
                  locale={{ emptyText: "No projects in this organization." }}
                  pagination={false}
                  rowKey="id"
                  scroll={{ x: 760 }}
                  size="middle"
                />
              ),
            }}
            pagination={false}
            rowKey={(group) => group.organization.id}
            size="middle"
          />
        )}

        {canShowProjects && projectsQuery.isSuccess && groups.length > 0 && visibleGroups.length === 0 && (
          <Empty description="No organizations or projects match your filter." />
        )}
      </section>
    </CrudPageLayout>
  );
}

export default ProjectsPage;
