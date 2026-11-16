import { useState } from "react";
import { Alert, Button, Dropdown, Empty, Input, Modal, Select, Table, Tag, Typography, message, type TableColumnsType } from "antd";
import { DownOutlined, MoreOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Link, useNavigate, useParams } from "react-router";
import { api, type OrganizationUser } from "../../api";
import { OrganizationUserEditor } from "../../components/OrganizationUserEditor";
import { AddExistingMemberModal } from "../../components/AddExistingMemberModal";
import { CreateMemberDialog } from "../../components/organization/CreateMemberDialog";
import CrudPageLayout from "../../components/ProjectsPageLayout";
import { isCurrentSession, useAuthStore, withSession } from "../../stores/authStore";
import { privateQueryKey } from "../../queryClient";
import { useOrganizationCapabilities, useOrganizations } from "../../hooks/useOrganizationCapabilities";
import { describeOrganizationAccess } from "../../permissions/accessDescriptions";
import { AccessFeedback } from "../../components/AccessFeedback";

function MemberRole({ role }: { role: string }) {
  return <Tag color={role.includes("OWNER") ? "green" : "default"}>{describeOrganizationAccess(role).label}</Tag>;
}

function OrganizationsPage() {
  const { organizationId } = useParams();
  const navigate = useNavigate();
  const organizations = useOrganizations();
  const available = organizations.administrator ? organizations.available : organizations.manageable.map(({ organization }) => organization);
  const organizationList = organizations.administrator ? organizations.allQuery : organizations.query;
  const selectedOrganizationId = organizationId ?? available[0]?.id;
  const access = useOrganizationCapabilities(selectedOrganizationId);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<{ organizationId: string; user: OrganizationUser }>();
  const [creatingFor, setCreatingFor] = useState<string>();
  const [assigningFor, setAssigningFor] = useState<string>();
  const [messageApi, messageContext] = message.useMessage();
  const [modal, modalContext] = Modal.useModal();
  const client = useQueryClient();
  const sessionId = useAuthStore((state) => state.sessionId);
  const username = useAuthStore((state) => state.user?.username);
  const users = useQuery(
    privateQueryKey(sessionId, "organization-users", selectedOrganizationId),
    ({ signal }) => api.users.getAll(selectedOrganizationId!, { signal }),
    { enabled: Boolean(selectedOrganizationId && access.canManageUsers), onError: access.reportError },
  );
  const remove = useMutation(({ organizationId, user }: { organizationId: string; user: OrganizationUser }) =>
    withSession(sessionId, () => {
      if (organizationId !== selectedOrganizationId || !access.canRemoveUser(user)) throw new Error("You cannot remove this member.");
      return api.organizations.removeUser(organizationId, user.username);
    }), {
    mutationKey: privateQueryKey(sessionId, "remove-organization-user"), retry: false,
    onSuccess: (_, { organizationId, user }) => {
      if (!isCurrentSession(sessionId)) return;
      client.setQueryData<OrganizationUser[]>(privateQueryKey(sessionId, "organization-users", organizationId),
        (current) => current?.filter(({ id }) => id !== user.id) ?? []);
      messageApi.success(`${user.friendlyName || user.username} was removed.`);
    },
    onError: (error, variables) => {
      if (!isCurrentSession(sessionId)) return;
      access.reportError(error, variables.organizationId);
      messageApi.error(error instanceof Error ? error.message : "Unable to remove the member.");
    },
  });
  const columns: TableColumnsType<OrganizationUser> = [
    { title: "Member", key: "member", render: (_, user) => <div className="min-w-0 break-words">
      <Typography.Text strong>{user.friendlyName || user.username}</Typography.Text>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span>@{user.username}</span>
        {user.username === username && <Tag>You</Tag>}
        {user.bannedAt && <Tag color="red">Banned</Tag>}
      </div>
      <div className="mt-2 min-[576px]:hidden"><MemberRole role={user.membershipRole} /></div>
    </div> },
    { title: "Role", key: "role", width: 150, responsive: ["sm"], render: (_, user) => <MemberRole role={user.membershipRole} /> },
    { title: <span className="sr-only">Actions</span>, key: "actions", width: 64, align: "right", render: (_, user) => {
      const canEditAccount = access.canEditUsers && user.username !== username;
      const items = [
        ...(access.canChangeRole(user) || canEditAccount ? [{ key: "edit", label: canEditAccount ? "Edit account" : "Change role",
          onClick: () => setEditingUser({ organizationId: selectedOrganizationId!, user }),
        }] : []),
        ...(access.canRemoveUser(user) ? [{ key: "remove", label: "Remove member", danger: true, onClick: () => {
          modal.confirm({ title: `Remove @${user.username}?`,
            content: "They will lose access to this organization. Their account will remain.",
            okText: "Remove member", okButtonProps: { danger: true }, cancelText: "Cancel",
            onOk: () => remove.mutateAsync({ organizationId: selectedOrganizationId!, user }),
          });
        } }] : []),
      ];
      return items.length > 0 ? <Dropdown trigger={["click"]} menu={{ items }}>
        <Button type="text" icon={<MoreOutlined />} disabled={remove.isLoading} aria-label={`Actions for @${user.username}`} />
      </Dropdown> : null;
    } },
  ];

  if (selectedOrganizationId && (access.state !== "ready" || !access.canManageUsers)) {
    return <CrudPageLayout><AccessFeedback state={access.state === "ready" ? "denied" : access.state}
      error={access.query.error} onRetry={() => void access.retry()} /></CrudPageLayout>;
  }
  const organizationName = access.organization?.name;
  const title = organizationName && organizationName !== selectedOrganizationId ? organizationName : "Organization members";
  const options = available.map(({ id, name }) => ({ value: id, label: name }));
  if (selectedOrganizationId && !options.some(({ value }) => value === selectedOrganizationId)) {
    options.push({ value: selectedOrganizationId, label: "Current organization" });
  }
  const term = search.trim().toLocaleLowerCase();
  const visibleUsers = users.data?.filter((user) => `${user.friendlyName} ${user.username}`.toLocaleLowerCase().includes(term));

  return <CrudPageLayout>
    {messageContext}
    {modalContext}
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <Typography.Title level={2} className="!mt-0 !mb-1 break-words">{selectedOrganizationId ? title : "Organizations"}</Typography.Title>
        <Typography.Paragraph type="secondary" className="!mb-0">Manage members and their organization roles.</Typography.Paragraph>
      </div>
      {options.length > 1 && <Select className="w-full sm:!w-64" showSearch optionFilterProp="label"
        aria-label="Organization" value={selectedOrganizationId} loading={organizationList.isFetching} options={options}
        onChange={(id) => {
          setCreatingFor(undefined); setAssigningFor(undefined); setEditingUser(undefined); setSearch("");
          navigate(`/organizations/${encodeURIComponent(id)}`);
        }} />}
    </header>

    {selectedOrganizationId ? <section className="app-card p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Input.Search className="w-full sm:!max-w-80" allowClear aria-label="Search members" placeholder="Search name or username"
          value={search} onChange={(event) => setSearch(event.target.value)} />
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/projects?organizationId=${encodeURIComponent(selectedOrganizationId)}`}><Button>View projects</Button></Link>
          <Dropdown trigger={["click"]} menu={{ items: [
            { key: "create", label: "Create new account", onClick: () => setCreatingFor(selectedOrganizationId) },
            { key: "existing", label: "Add existing account", disabled: !users.isSuccess, onClick: () => setAssigningFor(selectedOrganizationId) },
          ] }}><Button type="primary" icon={<PlusOutlined />}>Add member <DownOutlined /></Button></Dropdown>
        </div>
      </div>
      {organizationList.isError && <Alert className="mb-4" type="warning" showIcon title="Could not refresh the organization list."
        action={<Button onClick={() => void organizationList.refetch()}>Retry</Button>} />}
      {users.isError ? <AccessFeedback error={users.error} onRetry={() => { void access.retry().then(() => users.refetch()); }} />
        : <Table<OrganizationUser> className="app-table" classNames={{ section: "app-table-frame" }} tableLayout="fixed" columns={columns}
          dataSource={visibleUsers} loading={users.isLoading} rowKey="id" size="middle"
          pagination={{ pageSize: 10, hideOnSinglePage: true, showSizeChanger: false }}
          locale={{ emptyText: term ? "No members match your search." : "No members yet. Add an account to get started." }} />}
    </section> : organizationList.isLoading ? <AccessFeedback state="loading" onRetry={() => void organizationList.refetch()} />
      : organizationList.isError ? <AccessFeedback error={organizationList.error} onRetry={() => void organizationList.refetch()} />
      : <section className="app-card p-8"><Empty description="No organizations available to manage.">
        {access.administrator && <Link to="/admin"><Button type="primary">Manage organizations</Button></Link>}
      </Empty></section>}

    {selectedOrganizationId && creatingFor === selectedOrganizationId && access.canManageUsers && <CreateMemberDialog
      organizationId={selectedOrganizationId} onClose={() => setCreatingFor(undefined)} />}
    {selectedOrganizationId && assigningFor === selectedOrganizationId && access.canManageUsers && <AddExistingMemberModal
      organizationId={selectedOrganizationId} memberIds={users.data?.map(({ id }) => id) ?? []} onClose={() => setAssigningFor(undefined)} />}
    {editingUser && editingUser.organizationId === selectedOrganizationId && access.canManageUsers && <OrganizationUserEditor
      key={`${selectedOrganizationId}:${editingUser.user.id}`} organizationId={editingUser.organizationId} user={editingUser.user}
      onClose={() => setEditingUser(undefined)} />}
  </CrudPageLayout>;
}

export default OrganizationsPage;
