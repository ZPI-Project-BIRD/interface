import { useState } from "react";
import { Button, Dropdown, Form, Grid, Input, Modal, Space, Table, Typography } from "antd";
import { MoreOutlined, PlusOutlined } from "@ant-design/icons";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "react-query";
import { api, type Organization } from "../../api";
import { useOrganizations } from "../../hooks/useOrganizationCapabilities";
import { privateQueryKey } from "../../queryClient";
import { isCurrentSession, useAuthStore, withSession } from "../../stores/authStore";
import { AccessFeedback } from "../AccessFeedback";
import { MutationFeedback } from "../MutationFeedback";
import { CreateOrganizationDialog } from "./AdminCreateDialogs";

export function AdminOrganizations() {
  const wide = Grid.useBreakpoint().sm;
  const { allQuery } = useOrganizations();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Organization>();
  const [creating, setCreating] = useState(false);
  const [modal, modalContext] = Modal.useModal();
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
  return <section className="app-card p-5">
    {modalContext}
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Input.Search className="w-full sm:max-w-80" placeholder="Search organizations" aria-label="Search organizations" allowClear onChange={(event) => setSearch(event.target.value)} />
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Create organization</Button>
    </div>
    <MutationFeedback error={update.error} />
    <Table<Organization> className="app-table" classNames={{ section: "app-table-frame" }} rowKey="id" tableLayout="fixed" loading={allQuery.isLoading} pagination={{ pageSize: 10, hideOnSinglePage: true }}
      dataSource={allQuery.data?.filter(({ name }) => name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))}
      columns={[
        { title: "Organization", dataIndex: "name", render: (name) => <Typography.Text strong className="break-words">{name}</Typography.Text> },
        { title: wide ? "Actions" : <span className="sr-only">Actions</span>, width: wide ? 310 : 64, render: (_, organization) => <Space wrap>
          {wide && <>
            <Link to={`/organizations/${organization.id}`}><Button type="link" className="!px-1">Members & owners</Button></Link>
            <Link to={`/projects?organizationId=${organization.id}`}><Button type="link" className="!px-1">Projects</Button></Link>
          </>}
          <Dropdown trigger={["click"]} menu={{ items: [
            ...(!wide ? [
              { key: "members", label: <Link to={`/organizations/${organization.id}`}>Members &amp; owners</Link> },
              { key: "projects", label: <Link to={`/projects?organizationId=${organization.id}`}>Projects</Link> },
            ] : []),
            { key: "rename", label: "Rename", onClick: () => { update.reset(); setEditing(organization); } },
            { key: "delete", label: "Delete organization", danger: true, onClick: () => {
              update.reset();
              modal.confirm({ title: `Delete ${organization.name}?`,
                content: "All projects, results and annotation history in this organization will be deleted. User accounts remain.",
                okText: "Delete organization", okButtonProps: { danger: true },
                onOk: () => update.mutateAsync({ organization }),
              });
            } },
          ] }}>
            <Button type="text" icon={<MoreOutlined />} disabled={update.isLoading} aria-label={`More actions for ${organization.name}`} />
          </Dropdown>
        </Space> },
      ]} />
    {creating && <CreateOrganizationDialog onClose={() => setCreating(false)} />}
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
