import { useMemo, useState } from "react";
import { Alert, Button, Empty, Input, Select, Skeleton, Typography } from "antd";
import { useQuery } from "react-query";
import { Link } from "react-router";
import { api, type Organization, type Project } from "../../api";
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
  const projectCount = groups.reduce((total, group) => total + group.projects.length, 0);
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
      <section className="mb-4 flex flex-col gap-4 border border-[#c9d0d5] bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Typography.Title level={3} className="!mb-0 !text-xl">
            My projects
          </Typography.Title>
          <Typography.Text type="secondary" className="!text-sm">
            {projectsQuery.isLoading
              ? "Loading projects…"
              : `${projectCount} ${projectCount === 1 ? "project" : "projects"} in ${groups.length} ${groups.length === 1 ? "organization" : "organizations"}`}
          </Typography.Text>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
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
        </div>
      </section>

      <section className="min-h-[520px] border border-[#c9d0d5] bg-white p-5 sm:p-6">
        {projectsQuery.isLoading && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="border border-neutral-200 p-6">
                <Skeleton active paragraph={{ rows: 3 }} />
              </div>
            ))}
          </div>
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
          <div className="space-y-6">
            {visibleGroups.map(({ organization, projects }) => (
              <section key={organization.id} className="border border-[#c9d0d5]">
                <header className="flex items-center justify-between gap-4 border-b border-[#c9d0d5] bg-[#eef2f4] px-5 py-3">
                  <Typography.Title level={4} className="!m-0 !text-base">
                    {organization.name}
                  </Typography.Title>
                  <Typography.Text type="secondary" className="!text-sm">
                    {projects.length} {projects.length === 1 ? "project" : "projects"}
                  </Typography.Text>
                </header>

                <div className="p-4">
                  {projects.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="No projects in this organization."
                    />
                  ) : (
                    <div>
                      {projects.map((project) => (
                        <article
                          key={project.id}
                          className="flex flex-col gap-4 border-b border-[#d9dee2]  py-3 transition-colors duration-150 last:border-b-0 hover:bg-white md:grid md:grid-cols-[minmax(220px,1fr)_120px_minmax(230px,280px)_120px] md:items-center md:gap-5"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="grid size-9 shrink-0 place-items-center bg-[#123f5d] text-sm font-semibold text-white">
                              {project.name.charAt(0).toLocaleUpperCase()}
                            </div>
                            <Typography.Text strong className="min-w-0 truncate !text-base">
                              {project.name}
                            </Typography.Text>
                          </div>
                          <div className="text-sm text-neutral-800">
                            <span className="mr-2 text-neutral-500 md:hidden">Area</span>
                            {calculateAreaKm2(project).toFixed(2)} km²
                          </div>
                          <div className="text-sm text-neutral-800">
                            <span className="mr-2 text-neutral-500 md:hidden">North-west</span>
                            {formatCoordinate(project.topLeft.latitude)},{" "}
                            {formatCoordinate(project.topLeft.longitude)}
                          </div>
                          <Link to={`/projects/${project.id}`}>
                            <Button className="w-full">Open</Button>
                          </Link>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

        {projectsQuery.isSuccess && groups.length > 0 && visibleGroups.length === 0 && (
          <Empty description="No organizations or projects match your filter." />
        )}
      </section>
    </CrudPageLayout>
  );
}

export default ProjectsPage;
