import { useState } from "react";
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Table,
  Tag,
  Typography,
  message,
  type TableColumnsType,
} from "antd";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Link, useNavigate, useParams } from "react-router";
import {
  api,
  type CreateOrganizationUserPayload,
  type OrganizationUser,
} from "../../api";
import { OrganizationUserEditor } from "../../components/OrganizationUserEditor";
import { AddExistingMemberModal } from "../../components/AddExistingMemberModal";
import CrudPageHeader from "../../components/CrudPageHeader";
import CrudPageLayout from "../../components/ProjectsPageLayout";
import { isCurrentSession, useAuthStore, withSession } from "../../stores/authStore";
import { privateQueryKey } from "../../queryClient";
import { useOrganizationCapabilities, useOrganizations } from "../../hooks/useOrganizationCapabilities";
import { AccessFeedback } from "../../components/AccessFeedback";

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
  const { organizationId } = useParams();
  const navigate = useNavigate();
  const organizations = useOrganizations();
  const selectedOrganizationId = organizationId ?? (organizations.administrator ? organizations.available[0]?.id : organizations.manageable[0]?.organization.id);
  const access = useOrganizationCapabilities(selectedOrganizationId);
  const [editingUser, setEditingUser] = useState<{ organizationId: string; user: OrganizationUser }>();
  const [addUserOrganizationId, setAddUserOrganizationId] = useState<string>();
  const [assignOrganizationId, setAssignOrganizationId] = useState<string>();
  const [addUserForm] = Form.useForm<AddUserFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const queryClient = useQueryClient();
  const sessionId = useAuthStore((state) => state.sessionId);
  const username = useAuthStore((state) => state.user?.username);
  const usersQuery = useQuery(
    privateQueryKey(sessionId, "organization-users", selectedOrganizationId),
    ({ signal }) => api.users.getAll(selectedOrganizationId!, { signal }),
    { enabled: Boolean(selectedOrganizationId && access.canManageUsers), onError: access.reportError },
  );

  const addUserMutation = useMutation(
    ({ organizationId, ...payload }: AddUserVariables) =>
      withSession(sessionId, () => api.organizations.createUser(organizationId, payload)),
    {
      mutationKey: privateQueryKey(sessionId, "create-organization-user"),
      onSuccess: ({ user, password }, { organizationId }) => {
        if (!isCurrentSession(sessionId)) return;
        queryClient.setQueryData<OrganizationUser[]>(
          privateQueryKey(sessionId, "organization-users", organizationId),
          (currentUsers) => [...(currentUsers ?? []), user],
        );
        setAddUserOrganizationId(undefined);
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
      onError: (error, variables) => {
        if (!isCurrentSession(sessionId)) return;
        access.reportError(error, variables.organizationId);
        messageApi.error(error instanceof Error ? error.message : "Unable to create the user.");
      },
    },
  );

  const removeUserMutation = useMutation(
    ({ organizationId, user }: RemoveUserVariables) =>
      withSession(sessionId, () => api.organizations.removeUser(organizationId, user.username)),
    {
      mutationKey: privateQueryKey(sessionId, "remove-organization-user"),
      onSuccess: (_, { organizationId, user }) => {
        if (!isCurrentSession(sessionId)) return;
        queryClient.setQueryData<OrganizationUser[]>(
          privateQueryKey(sessionId, "organization-users", organizationId),
          (currentUsers) =>
            currentUsers?.filter((currentUser) => currentUser.id !== user.id) ?? [],
        );
        messageApi.success(`${user.friendlyName || user.username} was removed.`);
      },
      onError: (error, variables) => {
        if (!isCurrentSession(sessionId)) return;
        access.reportError(error, variables.organizationId);
        messageApi.error(error instanceof Error ? error.message : "Unable to remove the user.");
      },
    },
  );

  const handleAddUser = (values: AddUserFormValues) => {
    if (selectedOrganizationId && access.canManageUsers && access.userRoles.includes(values.membershipRole)) {
      addUserMutation.mutate({ ...values, organizationId: selectedOrganizationId });
    }
  };

  const userColumns: TableColumnsType<OrganizationUser> = [
    ...baseUserColumns,
    ...(access.canManageUsers ? [{
      title: "Edit", key: "edit", width: 140,
      render: (_: unknown, user: OrganizationUser) => access.canChangeRole(user) || (access.canEditUsers && user.username !== username)
        ? <Button size="small" onClick={() => setEditingUser({ organizationId: selectedOrganizationId!, user })}>{access.canEditUsers ? "Edit account" : "Change role"}</Button> : null,
    }] : []),
    {
      title: "Actions",
      key: "actions",
      align: "right",
      width: 120,
      render: (_, user) => {
        const isRemoving =
          removeUserMutation.isLoading && removeUserMutation.variables?.user.id === user.id;

        if (!access.canRemoveUser(user)) {
          return (
            <Button danger size="small" disabled title="You cannot remove yourself or an owner without administrator authority.">
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
              if (selectedOrganizationId && access.canRemoveUser(user)) {
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

  if (selectedOrganizationId && (access.state !== "ready" || !access.canManageUsers)) {
    return <CrudPageLayout><AccessFeedback
      state={access.state === "ready" ? "denied" : access.state}
      error={access.query.error}
      onRetry={() => void access.retry()}
    /></CrudPageLayout>;
  }

  return (
    <CrudPageLayout>
      {messageContextHolder}
      {modalContextHolder}
      {assignOrganizationId === selectedOrganizationId && selectedOrganizationId && access.canManageUsers && <AddExistingMemberModal
        organizationId={selectedOrganizationId} memberIds={usersQuery.data?.map(({ id }) => id) ?? []} onClose={() => setAssignOrganizationId(undefined)} />}
      {editingUser && editingUser.organizationId === selectedOrganizationId && selectedOrganizationId && access.canManageUsers && <OrganizationUserEditor
        key={`${selectedOrganizationId}:${editingUser.user.id}`}
        organizationId={selectedOrganizationId} user={editingUser.user} onClose={() => setEditingUser(undefined)}
      />}
      <CrudPageHeader
        title="Manage organizations"
        actions={
          <>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {access.administrator && <Input.Search
              aria-label="Open organization by ID"
              placeholder="Open organization by ID"
              enterButton="Open"
              onSearch={(id) => { if (id.trim()) navigate(`/organizations/${encodeURIComponent(id.trim())}`); }}
              className="w-full sm:!w-80 sm:!min-w-64"
            />}
            <Select
              id="organization-select"
              value={selectedOrganizationId}
              onChange={(id) => { setAddUserOrganizationId(undefined); addUserForm.resetFields(); navigate(`/organizations/${id}`); }}
              loading={access.query.isLoading}
              placeholder="Select organization"
              aria-label="Organization"
              className="w-full sm:!w-64 sm:!min-w-48"
              options={[
                ...(access.administrator ? access.available : access.manageable.map(({ organization }) => organization)).map((organization) => ({ label: organization.name, value: organization.id })),
                ...(selectedOrganizationId && !(access.administrator ? access.available : access.manageable.map(({ organization }) => organization)).some(({ id }) => id === selectedOrganizationId)
                  ? [{ label: selectedOrganizationId, value: selectedOrganizationId }] : []),
              ]}
            />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            {selectedOrganizationId && <Link to={`/projects?organizationId=${encodeURIComponent(selectedOrganizationId)}`}><Button>Organization projects</Button></Link>}
            <Button
              type="primary"
              disabled={!selectedOrganizationId || !access.canManageUsers}
              onClick={() => setAddUserOrganizationId(selectedOrganizationId)}
            >
              Create account
            </Button>
            <Button disabled={!selectedOrganizationId || !access.canManageUsers} onClick={() => setAssignOrganizationId(selectedOrganizationId)}>Assign existing account</Button>
            </div>
          </>
        }
      />

      <Typography.Paragraph type="secondary">
        Organization owners manage memberships and member roles. Users update their own account name and password;
        global administrators handle account resets and organization ownership.
      </Typography.Paragraph>

      <section>
        {usersQuery.isError && <AccessFeedback error={usersQuery.error} onRetry={() => { void access.retry().then(() => usersQuery.refetch()); }} />}
        {!selectedOrganizationId && <Alert type="info" title="Open an organization by its ID to manage its users." />}
        {selectedOrganizationId && !usersQuery.isError && (
          <Table<OrganizationUser>
            bordered showHeader={false} className="rounded-none!" columns={userColumns}
            dataSource={usersQuery.data ?? []} loading={usersQuery.isLoading}
            locale={{ emptyText: "This organization has no users." }} pagination={false}
            rowKey="id" scroll={{ x: 760 }} size="middle"
          />
        )}
      </section>

      <Modal
        title="Add user to organization"
        open={Boolean(selectedOrganizationId) && addUserOrganizationId === selectedOrganizationId && access.canManageUsers}
        okText="Add user"
        confirmLoading={addUserMutation.isLoading}
        onOk={() => { if (access.canManageUsers) addUserForm.submit(); }}
        onCancel={() => {
          if (!addUserMutation.isLoading) {
            setAddUserOrganizationId(undefined);
            addUserForm.resetFields();
          }
        }}
      >
        <Form<AddUserFormValues>
          form={addUserForm}
          layout="vertical"
          requiredMark={false}
          initialValues={{ membershipRole: "VIEWER" }}
          disabled={addUserMutation.isLoading || !access.canManageUsers}
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
              options={access.userRoles.map((role) => ({ value: role, label: formatRole(role) }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </CrudPageLayout>
  );
}

export default OrganizationsPage;
