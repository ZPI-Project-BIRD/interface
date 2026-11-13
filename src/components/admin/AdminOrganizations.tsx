import { useState } from "react";
import { Button, Form, Input, Modal, Popconfirm, Space, Table, Typography } from "antd";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "react-query";
import { api, type Organization } from "../../api";
import { useOrganizations } from "../../hooks/useOrganizationCapabilities";
import { privateQueryKey } from "../../queryClient";
import { isCurrentSession, useAuthStore, withSession } from "../../stores/authStore";
import { AccessFeedback } from "../AccessFeedback";
import { MutationFeedback } from "../MutationFeedback";

export function AdminOrganizations() {
  const { allQuery } = useOrganizations();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Organization>();
  const sessionId = useAuthStore((state) => state.sessionId);
  const client = useQueryClient();
  const update = useMutation(({ organization, name }: { organization: Organization; name?: string }) =>
    withSession(sessionId, async () => name === undefined ? await api.organizations.delete(organization.id) : await api.organizations.rename(organization.id, name.trim())), {
    mutationKey: privateQueryKey(sessionId, "admin-organization-change"), retry: false,
    onSuccess: async (_, { organization, name }) => {
      await client.cancelQueries({ queryKey: privateQueryKey(sessionId, "organizations") }, { silent: true });
      if (!isCurrentSession(sessionId)) return;
      setEditing(undefined);
      client.setQueryData<Organization[]>(privateQueryKey(sessionId, "organizations", "all"), (current) =>
        name === undefined ? current?.filter(({ id }) => id !== organization.id) ?? []
          : current?.map((item) => item.id === organization.id ? { ...item, name: name.trim() } : item) ?? []);
      // Refresh names, permissions and project groups anywhere they are currently displayed.
      void client.invalidateQueries(privateQueryKey(sessionId, "organizations"));
      void client.invalidateQueries(privateQueryKey(sessionId, "projects"));
      if (name === undefined) {
        for (const key of ["project", "project-progress", "project-detections", "project-features", "annotation-history", "organization-users"]) {
          void client.cancelQueries(privateQueryKey(sessionId, key, organization.id));
          client.removeQueries(privateQueryKey(sessionId, key, organization.id));
        }
        client.setQueryData<Organization[]>(privateQueryKey(sessionId, "known-project-organizations"), (current) =>
          current?.filter(({ id }) => id !== organization.id) ?? []);
      }
    },
  });
  if (allQuery.isError) return <AccessFeedback error={allQuery.error} onRetry={() => void allQuery.refetch()} />;
  return <section className="border border-[#c9d0d5] bg-white p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <Typography.Title level={3} className="!m-0">All organizations</Typography.Title>
      <Input.Search className="max-w-80" placeholder="Filter organizations" allowClear onChange={(event) => setSearch(event.target.value)} />
    </div>
    <MutationFeedback error={update.error} />
    <Table<Organization> rowKey="id" loading={allQuery.isLoading} scroll={{ x: 700 }} pagination={{ pageSize: 10 }}
      dataSource={allQuery.data?.filter(({ name }) => name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))}
      columns={[
        { title: "Organization", dataIndex: "name", render: (name, item) => <div><Typography.Text strong>{name}</Typography.Text><br /><Typography.Text type="secondary" copyable>{item.id}</Typography.Text></div> },
        { title: "Actions", render: (_, organization) => <Space wrap>
          <Link to={`/organizations/${organization.id}`}><Button>Members & owners</Button></Link>
          <Link to={`/projects?organizationId=${organization.id}`}><Button>Projects</Button></Link>
          <Button disabled={update.isLoading} onClick={() => { update.reset(); setEditing(organization); }}>Rename</Button>
          <Popconfirm title={`Delete ${organization.name}?`}
            description="All projects, results and annotation history in this organization will be deleted. User accounts remain."
            okText="Delete organization" okButtonProps={{ danger: true }} disabled={update.isLoading}
            onConfirm={() => update.mutateAsync({ organization })}>
            <Button danger loading={update.isLoading && update.variables?.organization.id === organization.id}>Delete</Button>
          </Popconfirm>
        </Space> },
      ]} />
    <Modal title="Rename organization" open={Boolean(editing)} onCancel={() => { if (!update.isLoading) setEditing(undefined); }} footer={null} destroyOnHidden>
      {editing && <Form key={editing.id} layout="vertical" initialValues={{ name: editing.name }} disabled={update.isLoading}
        onFinish={({ name }) => update.mutate({ organization: editing, name })}>
        <Form.Item name="name" label="Organization name" rules={[{ required: true, whitespace: true }, { max: 256 }]}><Input /></Form.Item>
        <MutationFeedback error={update.error} />
        <Button type="primary" htmlType="submit" loading={update.isLoading}>Save name</Button>
      </Form>}
    </Modal>
  </section>;
}
