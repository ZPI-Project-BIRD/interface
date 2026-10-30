import { useState } from "react";
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Result,
  Select,
  Table,
  Tag,
  Typography,
  message,
  type TableColumnsType,
} from "antd";
import { useMutation, useQuery } from "react-query";
import { Link } from "react-router";
import { api, type OrganizationUser } from "../../api";
import CrudPageHeader from "../../components/CrudPageHeader";
import CrudPageLayout from "../../components/ProjectsPageLayout";
import { useAuthStore } from "../../stores/authStore";

interface AddUserFormValues {
  friendlyName: string;
  username: string;
  membershipRole: "VIEWER" | "ANNOTATOR" | "EDITOR";
}

interface AddUserVariables extends AddUserFormValues {
  organizationId: string;
}

function formatRole(role: string) {
  return role
    .replace(/^_?\d+_/, "")
    .replaceAll("_", " ")
    .toLocaleLowerCase()
    .replace(/^./, (letter) => letter.toLocaleUpperCase());
}

const userColumns: TableColumnsType<OrganizationUser> = [
  {
    title: "User",
    key: "user",
    render: (_, user) => (
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center bg-[#123f5d] text-sm font-semibold text-white">
          {(user.friendlyName || user.username).charAt(0).toLocaleUpperCase()}
        </div>
        <div className="flex flex-col">
          <Typography.Text strong className="min-w-0 truncate">
            {user.friendlyName}
          </Typography.Text>
          <Typography.Text className="leading-none!">{user.username}</Typography.Text>
        </div>
      </div>
    ),
  },
  {
    title: "Role",
    dataIndex: "membershipRole",
    key: "role",
    width: 180,
    render: (role: string) => (
      <Tag color={role.includes("OWNER") ? "green" : "default"}>{formatRole(role)}</Tag>
    ),
  },
  {
    title: "Status",
    dataIndex: "bannedAt",
    key: "status",
    width: 130,
    render: (bannedAt: string | null) => (
      <Tag color={bannedAt ? "red" : "green"}>{bannedAt ? "Banned" : "Active"}</Tag>
    ),
  },
];

function OrganizationsPage() {
  const [organizationId, setOrganizationId] = useState<string>();
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addUserForm] = Form.useForm<AddUserFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const username = useAuthStore((state) => state.user?.username);
  const organizationsQuery = useQuery(
    ["organizations", "owned", username],
    () => api.organizations.getOwned(),
    { enabled: Boolean(username), staleTime: 60_000 },
  );

  const selectedOrganizationId = organizationId ?? organizationsQuery.data?.[0]?.id;

  const usersQuery = useQuery(
    ["organization-users", selectedOrganizationId],
    () => api.users.getAll(selectedOrganizationId!),
    { enabled: Boolean(selectedOrganizationId) },
  );

  const addUserMutation = useMutation(
    async (variables: AddUserVariables) => {
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      return variables;
    },
    {
      onSuccess: ({ username }) => {
        messageApi.success(`Dummy add-user action completed for ${username}.`);
        setIsAddUserOpen(false);
        addUserForm.resetFields();
      },
      onError: () => {
        messageApi.error("The dummy add-user action failed.");
      },
    },
  );

  const handleAddUser = (values: AddUserFormValues) => {
    if (selectedOrganizationId) {
      addUserMutation.mutate({ ...values, organizationId: selectedOrganizationId });
    }
  };

  if (organizationsQuery.isError) {
    return (
      <CrudPageLayout>
        <Alert
          type="error"
          showIcon
          message="Could not load organizations"
          description={
            organizationsQuery.error instanceof Error
              ? organizationsQuery.error.message
              : "Please try again."
          }
          action={<Button onClick={() => void organizationsQuery.refetch()}>Retry</Button>}
        />
      </CrudPageLayout>
    );
  }

  if (organizationsQuery.isSuccess && organizationsQuery.data.length === 0) {
    return (
      <CrudPageLayout>
        <section className="border border-[#c9d0d5] bg-white">
          <Result
            status="403"
            title="Organization management unavailable"
            subTitle="You do not own an organization and are not permitted to manage organization users."
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
    <CrudPageLayout>
      {messageContextHolder}
      <CrudPageHeader
        title="Manage organizations"
        actions={
          <>
            <Select
              id="organization-select"
              value={selectedOrganizationId}
              onChange={setOrganizationId}
              loading={organizationsQuery.isLoading}
              placeholder="Select organization"
              className="w-full max-w-75"
              options={organizationsQuery.data?.map((organization) => ({
                label: organization.name,
                value: organization.id,
              }))}
            />
            <Button
              type="primary"
              disabled={!selectedOrganizationId}
              onClick={() => setIsAddUserOpen(true)}
            >
              Add user
            </Button>
          </>
        }
      />

      <section>
        {usersQuery.isError && (
          <Alert
            type="error"
            showIcon
            message="Could not load organization users"
            description={
              usersQuery.error instanceof Error ? usersQuery.error.message : "Please try again."
            }
            action={
              <Button size="small" onClick={() => void usersQuery.refetch()}>
                Retry
              </Button>
            }
          />
        )}

        {!usersQuery.isError && (
          <Table<OrganizationUser>
            bordered
            showHeader={false}
            className="rounded-none!"
            columns={userColumns}
            dataSource={usersQuery.data ?? []}
            loading={
              organizationsQuery.isLoading || usersQuery.isLoading || !selectedOrganizationId
            }
            locale={{ emptyText: "This organization has no users." }}
            pagination={false}
            rowKey="id"
            scroll={{ x: 760 }}
            size="middle"
          />
        )}
      </section>

      <Modal
        title="Add user to organization"
        open={isAddUserOpen}
        okText="Add user"
        confirmLoading={addUserMutation.isLoading}
        onOk={() => addUserForm.submit()}
        onCancel={() => {
          if (!addUserMutation.isLoading) {
            setIsAddUserOpen(false);
            addUserForm.resetFields();
          }
        }}
      >
        <Form<AddUserFormValues>
          form={addUserForm}
          layout="vertical"
          requiredMark={false}
          initialValues={{ membershipRole: "VIEWER" }}
          disabled={addUserMutation.isLoading}
          onFinish={handleAddUser}
        >
          <Form.Item
            label="Full name"
            name="friendlyName"
            rules={[
              { required: true, message: "Please enter the user's name." },
              { whitespace: true, message: "The user's name cannot be blank." },
              { max: 256, message: "The user's name cannot exceed 256 characters." },
            ]}
          >
            <Input autoComplete="off" />
          </Form.Item>

          <Form.Item
            label="Username"
            name="username"
            rules={[
              { required: true, message: "Please enter a username." },
              { whitespace: true, message: "The username cannot be blank." },
              { max: 16, message: "The username cannot exceed 16 characters." },
            ]}
          >
            <Input autoComplete="off" />
          </Form.Item>

          <Form.Item
            label="Organization role"
            name="membershipRole"
            rules={[{ required: true, message: "Please select a role." }]}
          >
            <Select
              options={[
                { value: "VIEWER", label: "Viewer" },
                { value: "ANNOTATOR", label: "Annotator" },
                { value: "EDITOR", label: "Editor" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </CrudPageLayout>
  );
}

export default OrganizationsPage;
