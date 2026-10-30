import { useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Empty,
  Input,
  Select,
  Table,
  Typography,
  type TableColumnsType,
} from "antd";
import { useQuery } from "react-query";
import { Link } from "react-router";
import { api, type Organization, type Project } from "../../api";
import CrudPageHeader from "../../components/CrudPageHeader";
import CrudPageLayout from "../../components/ProjectsPageLayout";

interface ProjectGroup {
  organization: Organization;
  projects: Project[];
}

function formatCoordinate(value: number) {
  return value.toFixed(5);
}

function calculateAreaKm2(project: Project) {
  const earthRadiusKm = 6_371.0088;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const longitudeSpan = toRadians(project.bottomRight.longitude - project.topLeft.longitude);
  const latitudeBand =
    Math.sin(toRadians(project.topLeft.latitude)) -
    Math.sin(toRadians(project.bottomRight.latitude));

  return earthRadiusKm ** 2 * longitudeSpan * latitudeBand;
}

const projectColumns: TableColumnsType<Project> = [
  {
    title: "Project",
    dataIndex: "name",
    key: "name",
    render: (name: string) => (
      <div className="flex min-w-0 items-center gap-3">
        <Avatar shape="square" size={28} className="shrink-0 !bg-[#123f5d] !text-xs">
          {name.charAt(0).toLocaleUpperCase()}
        </Avatar>
        <Typography.Text className="min-w-0 truncate font-medium">{name}</Typography.Text>
      </div>
    ),
  },
  {
    title: "Area",
    key: "area",
    width: 140,
    render: (_, project) => `${calculateAreaKm2(project).toFixed(2)} km²`,
  },
  {
    title: "North-west",
    key: "northWest",
    width: 260,
    render: (_, project) =>
      `${formatCoordinate(project.topLeft.latitude)}, ${formatCoordinate(project.topLeft.longitude)}`,
  },
  {
    title: "Actions",
    key: "actions",
    align: "right",
    width: 120,
    render: (_, project) => (
      <Link to={`/projects/${project.id}`}>
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

async function getProjects(): Promise<ProjectGroup[]> {
  const memberships = await api.organizations.getMy();
  const organizations = Array.from(
    new Map(memberships.map(({ organization }) => [organization.id, organization])).values(),
  );
  const groups = await Promise.all(
    organizations.map(async (organization) => ({
      organization,
      projects: await api.projects.getAll(organization.id),
    })),
  );

  return groups.toSorted((left, right) =>
    left.organization.name.localeCompare(right.organization.name),
  );
}

function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"ascending" | "descending">("ascending");
  const projectsQuery = useQuery(["projects"], getProjects);
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
  const createButton = (
    <Link to="/projects/create">
      <Button type="primary">New project</Button>
    </Link>
  );

  return (
    <CrudPageLayout>
      <CrudPageHeader
        title="My projects"
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
            {createButton}
          </>
        }
      />

      <section>
        {projectsQuery.isLoading && (
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

        {projectsQuery.isError && (
          <Alert
            type="error"
            showIcon
            message="Could not load projects"
            description={
              projectsQuery.error instanceof Error
                ? projectsQuery.error.message
                : "Please try again."
            }
            action={
              <Button size="small" onClick={() => void projectsQuery.refetch()}>
                Retry
              </Button>
            }
          />
        )}

        {projectsQuery.isSuccess && groups.length === 0 && (
          <div className="border border-neutral-200 p-8">
            <Empty description="You do not have access to any organizations yet.">
              {createButton}
            </Empty>
          </div>
        )}

        {projectsQuery.isSuccess && groups.length > 0 && visibleGroups.length > 0 && (
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

        {projectsQuery.isSuccess && groups.length > 0 && visibleGroups.length === 0 && (
          <Empty description="No organizations or projects match your filter." />
        )}
      </section>
    </CrudPageLayout>
  );
}

export default ProjectsPage;
