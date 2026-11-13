import { useCallback, useState } from "react";
import { Alert, Button, Flex, Form, Input, Select, Typography, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Map, type RectangleBounds } from "../../components/Map";
import CrudPageLayout from "../../components/ProjectsPageLayout";
import { isCurrentSession, useAuthStore } from "../../stores/authStore";
import { privateQueryKey } from "../../queryClient";
import { creationKey, getProjectCreationFlow, type CreationState } from "../../projects/projectCreation";
import { useOrganizationCapabilities } from "../../hooks/useOrganizationCapabilities";
import { ProjectCreationRecovery } from "../../components/project/ProjectCreationRecovery";
import { AccessFeedback } from "../../components/AccessFeedback";

const EARTH_RADIUS_KILOMETERS = 6_371.0088;
const MAX_RECTANGLE_AREA_KM2 = 20;

interface ProjectFormValues {
  organizationId: string;
  name: string;
}

interface CreateProjectVariables extends ProjectFormValues {
  rectangle: RectangleBounds;
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function calculateRectangleAreaKm2(rectangle: RectangleBounds) {
  const north = degreesToRadians(rectangle.north);
  const south = degreesToRadians(rectangle.south);
  const longitudeSpan = degreesToRadians(rectangle.east - rectangle.west);

  return EARTH_RADIUS_KILOMETERS ** 2 * longitudeSpan * (Math.sin(north) - Math.sin(south));
}

function CreateProjectPage() {
  const [searchParams] = useSearchParams();
  const sessionId = useAuthStore((state) => state.sessionId);
  const queryClient = useQueryClient();
  const flow = getProjectCreationFlow(queryClient, sessionId);
  const creationQuery = useQuery<CreationState | null>(creationKey(sessionId), { enabled: false, initialData: null, cacheTime: Infinity });
  const initialSubmission = flow.state?.outcome !== "accepted" ? flow.state?.submission : undefined;
  const [form] = Form.useForm<ProjectFormValues>();
  const [rectangle, setRectangle] = useState<RectangleBounds | null>(initialSubmission?.rectangle ?? null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [messageApi, messageContextHolder] = message.useMessage();
  const navigate = useNavigate();
  const organizationId = Form.useWatch("organizationId", { form, preserve: true });
  const projectName = Form.useWatch("name", form);
  const access = useOrganizationCapabilities(organizationId);
  const organizationsQuery = access.query;

  const createProjectMutation = useMutation(
    (values: CreateProjectVariables) => flow.submit(values),
    {
      mutationKey: privateQueryKey(sessionId, "create-project"),
      retry: false,
      onSuccess: (project) => {
        if (!isCurrentSession(sessionId) || !project) return;
        navigate(`/projects/${project.organizationId}/${project.id}`, { replace: true });
      },
      onError: (error) => {
        if (!isCurrentSession(sessionId)) return;
        access.reportError(error, flow.state?.submission.organizationId);
      },
    },
  );
  const creation = creationQuery.data;
  const locked = creation?.outcome === "pending" || creation?.outcome === "unknown" || Boolean(creation?.checking);

  const handleRectangleDraw = useCallback(
    (nextRectangle: RectangleBounds) => {
      if (flow.locked) return;
      if (nextRectangle.north <= nextRectangle.south || nextRectangle.east <= nextRectangle.west) {
        messageApi.error("Draw a rectangle with a non-zero width and height.");
        return;
      }

      const areaKm2 = calculateRectangleAreaKm2(nextRectangle);

      if (areaKm2 > MAX_RECTANGLE_AREA_KM2) {
        messageApi.error({
          content: `Selected area is ${areaKm2.toFixed(2)} km². The maximum allowed area is ${MAX_RECTANGLE_AREA_KM2} km².`,
          key: "rectangle-area-limit",
        });
        return;
      }

      setRectangle(nextRectangle);
    },
    [messageApi, flow],
  );

  const handleSubmit = (values: ProjectFormValues) => {
    if (flow.locked || !access.canCreateProject || values.organizationId !== organizationId) return;
    if (!rectangle) {
      messageApi.error("Draw a project area on the map before continuing.");
      return;
    }

    createProjectMutation.mutate({ ...values, rectangle });
  };

  const isFormComplete = Boolean(organizationId && projectName?.trim());
  const canSubmit = access.canCreateProject && isFormComplete && Boolean(rectangle) && !locked && !createProjectMutation.isLoading;
  const areaKm2 = rectangle ? calculateRectangleAreaKm2(rectangle) : null;

  if (access.state !== "ready" || (!access.administrator && (organizationId ? !access.canCreateProject : access.editable.length === 0))) {
    return <CrudPageLayout><AccessFeedback
      state={access.state === "ready" ? "denied" : access.state}
      error={organizationsQuery.error}
      onRetry={() => void access.retry()}
    /></CrudPageLayout>;
  }

  return (
    <CrudPageLayout
      headerAction={
        <Link to="/projects">
          <Button>Back to projects</Button>
        </Link>
      }
    >
      {messageContextHolder}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(340px,420px)_1fr]">
        <section className="z-10 flex flex-col border border-[#c9d0d5] bg-white p-6 lg:p-8">
          <Typography.Title level={2} className="mb-2!">
            Create project
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="mb-8!">
            Enter the project details, then draw its rectangular area on the map.
          </Typography.Paragraph>

          {creation && ["unknown", "acknowledged"].includes(creation.outcome) && <ProjectCreationRecovery creation={creation} flow={flow} />}
          {creation?.outcome === "not-submitted" && <Alert className="mb-5" type="error" showIcon title="Project was not submitted"
            description={`${creation.error} The preliminary project check failed before any creation request was sent. Your name and area are retained; you can try submitting again.`} />}
          {creation?.outcome === "rejected" && <Alert className="mb-5" type="error" showIcon title="Project creation rejected"
            description={`${creation.error} Your name and area are retained; correct the request before submitting again.`} />}
          {creation?.outcome === "pending" && <Alert className="mb-5" type="info"
            title={creation.phase === "checking" ? "Checking existing projects…" : "Creating project…"}
            description="Your submitted name and area are retained. A second creation request will not be sent while this one is pending." />}

          <Form<ProjectFormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            disabled={locked || createProjectMutation.isLoading}
            initialValues={{ organizationId: initialSubmission?.organizationId ?? searchParams.get("organizationId") ?? undefined, name: initialSubmission?.name }}
            onFinish={handleSubmit}
          >
            <Form.Item
              label="Organization"
              name="organizationId"
              rules={[{ required: true, message: "Please select an organization." }]}
            >
              {access.administrator && access.allQuery.isError ? <Input placeholder="Enter a known organization ID" autoComplete="off" /> : (
                <Select
                  showSearch
                  optionFilterProp="label"
                  loading={access.administrator ? access.allQuery.isLoading : organizationsQuery.isLoading}
                  placeholder="Select organization"
                  options={[
                    ...(access.administrator ? access.available : access.editable.map(({ organization }) => organization))
                      .map((organization) => ({ label: organization.name, value: organization.id })),
                    ...(access.administrator && organizationId && !access.available.some(({ id }) => id === organizationId)
                      ? [{ label: organizationId, value: organizationId }] : []),
                  ]}
                  notFoundContent={
                    organizationsQuery.isLoading
                      ? "Loading organizations…"
                      : "No editable organizations"
                  }
                />
              )}
            </Form.Item>

            {organizationsQuery.isError && (
              <Alert
                className="mb-7!"
                type="error"
                showIcon
                message="Could not load organizations"
                description={
                  organizationsQuery.error instanceof Error
                    ? organizationsQuery.error.message
                    : "Try loading them again."
                }
                action={
                  <Button size="small" onClick={() => void organizationsQuery.refetch()}>
                    Retry
                  </Button>
                }
              />
            )}

            <Form.Item
              label="Project name"
              name="name"
              rules={[
                { required: true, message: "Please enter a project name." },
                { whitespace: true, message: "Project name cannot be blank." },
              ]}
            >
              <Input placeholder="Wrocław city centre" autoComplete="off" />
            </Form.Item>

            <Flex vertical gap="small" className="mt-2 border border-[#d9dee2] bg-[#f5f7f7] p-3!">
              <Typography.Text strong>Project area</Typography.Text>
              {rectangle ? (
                <>
                  <Typography.Text type="secondary">
                    {areaKm2?.toFixed(2)} km² selected
                  </Typography.Text>
                  <Button onClick={() => setRectangle(null)}>Clear selection</Button>
                </>
              ) : (
                <Typography.Text type="secondary">
                  Click two opposite corners on the map to draw a rectangle (maximum 20 km²). Drag to move the map.
                </Typography.Text>
              )}
            </Flex>

            <Form.Item className="mt-8! mb-0!">
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                className="h-11!"
                disabled={!canSubmit}
                loading={createProjectMutation.isLoading}
              >
                {creation?.outcome === "acknowledged" ? "Create another project" : "Create project"}
              </Button>
            </Form.Item>
          </Form>
        </section>

        <section className="relative min-h-140 overflow-hidden border border-[#c9d0d5] bg-neutral-200 lg:min-h-[680px]">
          <Map
            mode={locked ? "browse" : "draw-rectangle"}
            rectangle={rectangle}
            onRectangleDraw={handleRectangleDraw}
            onDrawingChange={setIsDrawing}
          />
          <div className="pointer-events-none absolute top-4 left-1/2 z-500 -translate-x-1/2 border border-[#aeb8bf] bg-white/95 px-4 py-2">
            <Typography.Text className="whitespace-nowrap">
              {locked ? "Submitted area retained" : isDrawing
                ? "Click to place the opposite corner · Esc to cancel"
                : rectangle
                  ? "Click to start a new area"
                  : "Click to place the first corner"}
            </Typography.Text>
          </div>
        </section>
      </div>
    </CrudPageLayout>
  );
}

export default CreateProjectPage;
