import { useState } from "react";
import { Button, Form, Input, Modal, Popconfirm, Space, Table, Tag, Typography } from "antd";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { api, type PlatformUser } from "../../api";
import { privateQueryKey } from "../../queryClient";
import { isCurrentSession, useAuthStore, withSession } from "../../stores/authStore";
import { AccessFeedback } from "../AccessFeedback";
import { MutationFeedback } from "../MutationFeedback";

const PAGE_SIZE = 25;

export function AdminUsers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [banning, setBanning] = useState<PlatformUser>();
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
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <Typography.Title level={3} className="!m-0">All accounts</Typography.Title>
      <Input.Search className="max-w-80" placeholder="Search name or username" allowClear onSearch={(value) => { setSearch(value); setPage(0); }} />
    </div>
    <MutationFeedback error={change.error} conflict="The last active global administrator cannot be banned. Refresh the account list and try again." />
    {users.isError ? <AccessFeedback error={users.error} onRetry={() => void users.refetch()} /> : <>
      <Table<PlatformUser> rowKey="id" loading={users.isLoading} dataSource={users.data?.slice(0, PAGE_SIZE)} pagination={false} scroll={{ x: 700 }} columns={[
        { title: "Account", render: (_, user) => <div><Typography.Text strong>{user.friendlyName}</Typography.Text><div>@{user.username} {user.isAdmin && <Tag>Global admin</Tag>}</div><Typography.Text type="secondary" copyable>{user.id}</Typography.Text></div> },
        { title: "Status", render: (_, user) => <div><Tag color={user.bannedAt ? "red" : "green"}>{user.bannedAt ? "Banned" : "Active"}</Tag>{user.banReason && <div>{user.banReason}</div>}</div> },
        { title: "Actions", render: (_, user) => user.bannedAt
          ? <Popconfirm title={`Unban @${user.username}?`} onConfirm={() => change.mutateAsync({ user })}><Button disabled={change.isLoading}>Unban</Button></Popconfirm>
          : <Button danger disabled={change.isLoading || user.username === username} onClick={() => { change.reset(); setBanning(user); }}>Ban account</Button> },
      ]} />
      <Space className="mt-4"><Button disabled={page === 0 || users.isFetching} onClick={() => setPage(page - 1)}>Previous</Button>
        <span>Page {page + 1}</span><Button disabled={!users.data || users.data.length <= PAGE_SIZE || users.isFetching} onClick={() => setPage(page + 1)}>Next</Button></Space>
    </>}
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
