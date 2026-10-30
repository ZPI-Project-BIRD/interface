import { useState } from "react";
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Result,
  Select,
  Table,
  Tag,
  Typography,
  message,
  type TableColumnsType,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Link } from "react-router";
import {
  api,
  type CreateOrganizationUserPayload,
  type OrganizationUser,
} from "../../api";
import CrudPageHeader from "../../components/CrudPageHeader";
import CrudPageLayout from "../../components/ProjectsPageLayout";
import { useAuthStore } from "../../stores/authStore";

type AddUserFormValues = CreateOrganizationUserPayload;

interface AddUserVariables extends AddUserFormValues {
  organizationId: string;
}

interface RemoveUserVariables {
  organizationId: string;
  user: OrganizationUser;
}

function formatRole(role: string) {
  return role
    .replace(/^_?\d+_/, "")
    .replaceAll("_", " ")
    .toLocaleLowerCase()
    .replace(/^./, (letter) => letter.toLocaleUpperCase());
}

const baseUserColumns: TableColumnsType<OrganizationUser> = [
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
  const [modalApi, modalContextHolder] = Modal.useModal();
  const queryClient = useQueryClient();
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
    ({ organizationId, ...payload }: AddUserVariables) =>
      api.organizations.createUser(organizationId, payload),
    {
      onSuccess: ({ user, password }, { organizationId }) => {
        queryClient.setQueryData<OrganizationUser[]>(
          ["organization-users", organizationId],
          (currentUsers) => [...(currentUsers ?? []), user],
        );
        setIsAddUserOpen(false);
        addUserForm.resetFields();
        modalApi.success({
          title: "User created",
          content: (
            <div>
              <p>{user.friendlyName || user.username} was added to the organization.</p>
              <p>
                Temporary password: <Typography.Text code copyable>{password}</Typography.Text>
              </p>
            </div>
          ),
        });
      },
      onError: (error) => {
        messageApi.error(error instanceof Error ? error.message : "Unable to create the user.");
      },
    },
  );

  const removeUserMutation = useMutation(
    ({ organizationId, user }: RemoveUserVariables) =>
      api.organizations.removeUser(organizationId, user.username),
    {
      onSuccess: (_, { organizationId, user }) => {
        queryClient.setQueryData<OrganizationUser[]>(
          ["organization-users", organizationId],
          (currentUsers) =>
            currentUsers?.filter((currentUser) => currentUser.id !== user.id) ?? [],
        );
        messageApi.success(`${user.friendlyName || user.username} was removed.`);
      },
      onError: (error) => {
        messageApi.error(error instanceof Error ? error.message : "Unable to remove the user.");
      },
    },
  );

  const handleAddUser = (values: AddUserFormValues) => {
    if (selectedOrganizationId) {
      addUserMutation.mutate({ ...values, organizationId: selectedOrganizationId });
    }
  };

  const userColumns: TableColumnsType<OrganizationUser> = [
    ...baseUserColumns,
    {
      title: "Actions",
      key: "actions",
      align: "right",
      width: 120,
      render: (_, user) => {
        const isOwner = user.membershipRole.includes("OWNER");
        const isRemoving =
          removeUserMutation.isLoading && removeUserMutation.variables?.user.id === user.id;

        if (isOwner) {
          return (
            <Button danger size="small" disabled title="Organization owners cannot be removed.">
              Remove
            </Button>
          );
        }

        return (
          <Popconfirm
            title="Remove organization user?"
            description={`Remove ${user.friendlyName || user.username} from this organization?`}
            okText="Remove"
            okButtonProps={{ danger: true }}
            cancelText="Cancel"
            onConfirm={() => {
              if (selectedOrganizationId) {
                removeUserMutation.mutate({ organizationId: selectedOrganizationId, user });
              }
            }}
          >
            <Button danger size="small" loading={isRemoving}>
              Remove
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

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
      {modalContextHolder}
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
