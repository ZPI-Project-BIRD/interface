import { useState } from "react";
import { Button, Dropdown, Form, Input, Modal, Space, Table, Tag, Typography, message } from "antd";
import { MoreOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { api, type PlatformUser } from "../../api";
import { privateQueryKey } from "../../queryClient";
import { isCurrentSession, useAuthStore, withSession } from "../../stores/authStore";
import { AccessFeedback } from "../AccessFeedback";
import { MutationFeedback } from "../MutationFeedback";
import { CreateAccountDialog } from "./AdminCreateDialogs";

const PAGE_SIZE = 25;

export function AdminUsers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [banning, setBanning] = useState<PlatformUser>();
  const [creating, setCreating] = useState(false);
  const [modal, modalContext] = Modal.useModal();
  const [messageApi, messageContext] = message.useMessage();
  const sessionId = useAuthStore((state) => state.sessionId);
  const username = useAuthStore((state) => state.user?.username);
  const client = useQueryClient();
  const users = useQuery(privateQueryKey(sessionId, "platform-users", search, page),
    ({ signal }) => api.users.search({ search, limit: PAGE_SIZE + 1, offset: page * PAGE_SIZE }, { signal }));
  const change = useMutation(({ user, reason }: { user: PlatformUser; reason?: string }) => withSession(sessionId, () =>
    reason === undefined ? api.users.unban(user.id) : api.users.ban(user.id, reason.trim())), {
    mutationKey: privateQueryKey(sessionId, "admin-user-ban"), retry: false,
    onSuccess: () => {
      if (!isCurrentSession(sessionId)) return;
      setBanning(undefined);
      for (const key of ["platform-users", "organization-users", "user-picker"]) void client.invalidateQueries(privateQueryKey(sessionId, key));
    },
  });
  return <section className="border border-[#c9d0d5] bg-white p-5">
    {modalContext}
    {messageContext}
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Input.Search className="w-full sm:max-w-80" placeholder="Search name or username" aria-label="Search accounts" allowClear onSearch={(value) => { setSearch(value); setPage(0); }} />
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Create account</Button>
    </div>
    <MutationFeedback error={change.error} conflict="The last active global administrator cannot be banned. Refresh the account list and try again." />
    {users.isError ? <AccessFeedback error={users.error} onRetry={() => void users.refetch()} /> : <>
      <Table<PlatformUser> rowKey="id" tableLayout="fixed" loading={users.isLoading} dataSource={users.data?.slice(0, PAGE_SIZE)} pagination={false} columns={[
        { title: "Account", render: (_, user) => <div className="break-words"><Typography.Text strong>{user.friendlyName}</Typography.Text><div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500"><span>@{user.username}</span>{user.isAdmin && <Tag>Global admin</Tag>}{user.username === username && <Tag>You</Tag>}</div>
          <div className="mt-2 min-[576px]:hidden"><Tag color={user.bannedAt ? "red" : "green"}>{user.bannedAt ? "Banned" : "Active"}</Tag>{user.banReason && <div className="mt-1 text-sm">{user.banReason}</div>}</div>
        </div> },
        { title: "Status", width: 130, responsive: ["sm"], render: (_, user) => <div className="break-words"><Tag color={user.bannedAt ? "red" : "green"}>{user.bannedAt ? "Banned" : "Active"}</Tag>{user.banReason && <div>{user.banReason}</div>}</div> },
        { title: <span className="sr-only">Actions</span>, width: 64, render: (_, user) => <Dropdown trigger={["click"]} menu={{ items: [
          { key: "copy", label: "Copy account ID", onClick: async () => {
            try { await navigator.clipboard.writeText(user.id); messageApi.success("Account ID copied."); }
            catch { messageApi.error("Unable to copy the account ID."); }
          } },
          ...(user.username === username ? [] : [{ key: "status", label: user.bannedAt ? "Unban account" : "Ban account", danger: !user.bannedAt,
            onClick: () => {
              change.reset();
              if (user.bannedAt) modal.confirm({ title: `Unban @${user.username}?`, okText: "Unban account", onOk: () => change.mutateAsync({ user }) });
              else setBanning(user);
            },
          }]),
        ] }}><Button type="text" icon={<MoreOutlined />} disabled={change.isLoading} aria-label={`Actions for @${user.username}`} /></Dropdown> },
      ]} />
      {(page > 0 || (users.data?.length ?? 0) > PAGE_SIZE) && <Space className="mt-4"><Button disabled={page === 0 || users.isFetching} onClick={() => setPage(page - 1)}>Previous</Button>
        <span>Page {page + 1}</span><Button disabled={!users.data || users.data.length <= PAGE_SIZE || users.isFetching} onClick={() => setPage(page + 1)}>Next</Button></Space>}
    </>}
    {creating && <CreateAccountDialog onClose={() => setCreating(false)} />}
    <Modal title={banning ? `Ban @${banning.username}` : "Ban account"} open={Boolean(banning)} footer={null} destroyOnHidden
      onCancel={() => { if (!change.isLoading) setBanning(undefined); }}>
      {banning && <Form layout="vertical" disabled={change.isLoading} onFinish={({ reason }) => change.mutate({ user: banning, reason })}>
        <Typography.Paragraph>This will prevent login and revoke the account's existing sessions.</Typography.Paragraph>
        <Form.Item label="Reason" name="reason" rules={[{ required: true, whitespace: true }, { max: 2000 }]}><Input.TextArea rows={3} showCount maxLength={2000} /></Form.Item>
        <MutationFeedback error={change.error} />
        <Button danger type="primary" htmlType="submit" loading={change.isLoading}>Ban account</Button>
      </Form>}
    </Modal>
  </section>;
}
