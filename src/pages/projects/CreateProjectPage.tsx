import { useCallback, useState } from "react";
import { Alert, Button, Flex, Form, Input, Result, Select, Typography, message } from "antd";
import { useMutation, useQuery } from "react-query";
import { Link, useNavigate } from "react-router";
import { api, type CreateProjectPayload } from "../../api";
import { Map, type RectangleBounds } from "../../components/Map";
import CrudPageLayout from "../../components/ProjectsPageLayout";

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

function toCreateProjectPayload(name: string, rectangle: RectangleBounds): CreateProjectPayload {
  return {
    name: name.trim(),
    topLeft: {
      latitude: rectangle.north,
      longitude: rectangle.west,
    },
    bottomRight: {
      latitude: rectangle.south,
      longitude: rectangle.east,
    },
  };
}

function CreateProjectPage() {
  const [form] = Form.useForm<ProjectFormValues>();
  const [rectangle, setRectangle] = useState<RectangleBounds | null>(null);
  const [messageApi, messageContextHolder] = message.useMessage();
  const navigate = useNavigate();
  const organizationId = Form.useWatch("organizationId", form);
  const projectName = Form.useWatch("name", form);

  const organizationsQuery = useQuery(["organizations", "editable"], () =>
    api.organizations.getEditable(),
  );

  const createProjectMutation = useMutation(
    ({
      organizationId: selectedOrganizationId,
      name,
      rectangle: selectedRectangle,
    }: CreateProjectVariables) =>
      api.projects.create(selectedOrganizationId, toCreateProjectPayload(name, selectedRectangle)),
    {
      onSuccess: (project) => {
        navigate(`/projects/${project.id}`, { replace: true });
      },
      onError: (error) => {
        messageApi.error(error instanceof Error ? error.message : "Unable to create the project.");
      },
    },
  );

  const handleRectangleDraw = useCallback(
    (nextRectangle: RectangleBounds) => {
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
    [messageApi],
  );

  const handleSubmit = (values: ProjectFormValues) => {
    if (!rectangle) {
      messageApi.error("Draw a project area on the map before continuing.");
      return;
    }

    createProjectMutation.mutate({ ...values, rectangle });
  };

  const isFormComplete = Boolean(organizationId && projectName?.trim());
  const canSubmit = isFormComplete && Boolean(rectangle) && !createProjectMutation.isLoading;
  const areaKm2 = rectangle ? calculateRectangleAreaKm2(rectangle) : null;

  if (organizationsQuery.isSuccess && organizationsQuery.data.length === 0) {
    return (
      <CrudPageLayout
        headerAction={
          <Link to="/projects">
            <Button>Back to projects</Button>
          </Link>
        }
      >
        <section className="border border-[#c9d0d5] bg-white">
          <Result
            status="403"
            title="Project creation unavailable"
            subTitle="You are not permitted to create projects, since you are not an editor or owner of any organization."
            extra={
              <Link to="/projects">
                <Button type="primary">Return to projects</Button>
              </Link>
            }
          />
        </section>
      </CrudPageLayout>
    );
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

          <Form<ProjectFormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            disabled={createProjectMutation.isLoading}
            onFinish={handleSubmit}
          >
            <Form.Item
              label="Organization"
              name="organizationId"
              rules={[{ required: true, message: "Please select an organization." }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                loading={organizationsQuery.isLoading}
                placeholder="Select organization"
                options={organizationsQuery.data?.map((organization) => ({
                  label: organization.name,
                  value: organization.id,
                }))}
                notFoundContent={
                  organizationsQuery.isLoading
                    ? "Loading organizations…"
                    : "No editable organizations"
                }
              />
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
                  Click and drag on the map to draw a rectangle (maximum 20 km²).
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
                Create project
              </Button>
            </Form.Item>
          </Form>
        </section>

        <section className="relative min-h-140 overflow-hidden border border-[#c9d0d5] bg-neutral-200 lg:min-h-[680px]">
          <Map mode="draw-rectangle" rectangle={rectangle} onRectangleDraw={handleRectangleDraw} />
          <div className="pointer-events-none absolute top-4 left-1/2 z-500 -translate-x-1/2 border border-[#aeb8bf] bg-white/95 px-4 py-2">
            <Typography.Text className="whitespace-nowrap">
              {rectangle
                ? "Drag again to replace the selected area"
                : "Drag to select the project area"}
            </Typography.Text>
          </div>
        </section>
      </div>
    </CrudPageLayout>
  );
}

export default CreateProjectPage;
