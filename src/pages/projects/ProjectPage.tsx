import { Button, Flex, Result, Spin, Typography } from "antd";
import { useQuery } from "react-query";
import { Link, useParams } from "react-router";
import { api, type Organization, type Project } from "../../api";
import CrudPageLayout from "../../components/ProjectsPageLayout";
import { Map, type RectangleBounds } from "../../components/Map";
import { useAuthStore } from "../../stores/authStore";
import { privateQueryKey } from "../../queryClient";

interface ProjectDetails {
  organization: Organization;
  project: Project;
}

async function findProject(projectId: string, signal?: AbortSignal): Promise<ProjectDetails> {
  const memberships = await api.organizations.getMy({ signal });
  const organizations = Array.from(
    new globalThis.Map<string, Organization>(
      memberships.map(({ organization }) => [organization.id, organization]),
    ).values(),
  );
  const groups = await Promise.all(
    organizations.map(async (organization) => ({
      organization,
      projects: await api.projects.getAll(organization.id, { signal }),
    })),
  );

  for (const group of groups) {
    const project = group.projects.find((candidate) => candidate.id === projectId);

    if (project) {
      return { organization: group.organization, project };
    }
  }

  throw new Error("The project does not exist or you do not have permission to view it.");
}

function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const sessionId = useAuthStore((state) => state.sessionId);
  const username = useAuthStore((state) => state.user?.username);
  const projectQuery = useQuery(
    privateQueryKey(sessionId, "project", projectId),
    ({ signal }) => findProject(projectId!, signal),
    { enabled: Boolean(projectId && username) },
  );

  const backButton = (
    <Link to="/projects">
      <Button>Back to projects</Button>
    </Link>
  );

  if (projectQuery.isLoading || !projectId) {
    return (
      <CrudPageLayout headerAction={backButton}>
        <Flex align="center" justify="center" className="min-h-[520px] border border-[#c9d0d5] bg-white">
          <Spin size="large" />
        </Flex>
      </CrudPageLayout>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return (
      <CrudPageLayout headerAction={backButton}>
        <section className="border border-[#c9d0d5] bg-white">
          <Result
            status="404"
            title="Project unavailable"
            subTitle={
              projectQuery.error instanceof Error
                ? projectQuery.error.message
                : "The project could not be loaded."
            }
            extra={backButton}
          />
        </section>
      </CrudPageLayout>
    );
  }

  const { organization, project } = projectQuery.data;
  const rectangle: RectangleBounds = {
    north: project.topLeft.latitude,
    east: project.bottomRight.longitude,
    south: project.bottomRight.latitude,
    west: project.topLeft.longitude,
  };

  return (
    <CrudPageLayout headerAction={backButton}>
      <section className="mb-4 border border-[#c9d0d5] bg-white px-5 py-4">
        <Typography.Text className="!text-xs !font-semibold !tracking-[0.1em] !text-[#376f31] uppercase">
          {organization.name}
        </Typography.Text>
        <Typography.Title level={2} className="!mt-1 !mb-0 !text-2xl">
          {project.name}
        </Typography.Title>
      </section>

      <section className="h-[calc(100dvh-190px)] min-h-[560px] overflow-hidden border border-[#c9d0d5] bg-neutral-200">
        <Map mode="browse" rectangle={rectangle} interactive={false} />
      </section>
    </CrudPageLayout>
  );
}

export default ProjectPage;
