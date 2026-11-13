import { useState } from "react";
import { Alert, Button, Checkbox, Form, Input, Modal, Tabs, Typography } from "antd";
import { useMutation, useQueryClient } from "react-query";
import { Link, useNavigate } from "react-router";
import { api } from "../api";
import type { CreateUnassignedUserPayload } from "../api/contracts/users";
import CrudPageLayout from "../components/ProjectsPageLayout";
import CrudPageHeader from "../components/CrudPageHeader";
import { AccessFeedback } from "../components/AccessFeedback";
import { useAuthStore, isCurrentSession, withSession } from "../stores/authStore";
import { privateQueryKey } from "../queryClient";
import { isAdministrator, isPermissionDenied } from "../permissions/organizationCapabilities";
import { AdminOrganizations } from "../components/admin/AdminOrganizations";
import { AdminUsers } from "../components/admin/AdminUsers";

export default function AdminPage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const sessionId = useAuthStore((state) => state.sessionId);
  const user = useAuthStore((state) => state.user);
  const [organizationId, setOrganizationId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [createdOrganization, setCreatedOrganization] = useState<{ id: string; name: string }>();
  const [organizationForm] = Form.useForm<{ name: string }>();
  const [userForm] = Form.useForm<CreateUnassignedUserPayload>();
  const [modal, modalContext] = Modal.useModal();
  const createOrganization = useMutation(
    ({ name }: { name: string }) => withSession(sessionId, () => api.organizations.create(name.trim())),
    {
      mutationKey: privateQueryKey(sessionId, "admin-create-organization"),
      onSuccess: (organization) => {
        if (!isCurrentSession(sessionId)) return;
        setCreatedOrganization(organization);
        setOrganizationId(organization.id);
        organizationForm.resetFields();
        void client.invalidateQueries(privateQueryKey(sessionId, "organizations", "all"));
      },
    },
  );
  const createUser = useMutation(
    (payload: CreateUnassignedUserPayload) => withSession(sessionId, () => api.users.createUnassigned(payload)),
    {
      mutationKey: privateQueryKey(sessionId, "admin-create-unassigned-user"),
      onSuccess: ({ user, password }) => {
        if (!isCurrentSession(sessionId)) return;
        userForm.resetFields();
        void client.invalidateQueries(privateQueryKey(sessionId, "platform-users"));
        void client.invalidateQueries(privateQueryKey(sessionId, "user-picker"));
        modal.success({ title: "Account created", content: <div>
          <p>{user.username} was created without an organization.</p>
          <p>Temporary password: <Typography.Text code copyable>{password}</Typography.Text></p>
        </div> });
      },
    },
  );
  if (!isAdministrator(user)) return null; // The route guard also protects this entry point.
  const encodedOrganizationId = encodeURIComponent(organizationId.trim());
  const failure = createOrganization.error ?? createUser.error;
  if (isPermissionDenied(failure)) return <CrudPageLayout><AccessFeedback error={failure} onRetry={() => window.location.reload()} /></CrudPageLayout>;
  return <CrudPageLayout headerAction={/**<Link to="/projects"><Button>Back to projects</Button></Link>**/<></>}>
    {modalContext}
    <CrudPageHeader title="Administration" actions={null} />
    <Tabs items={[
      { key: "organizations", label: "Organizations", children: <AdminOrganizations /> },
      { key: "accounts", label: "Accounts", children: <AdminUsers /> },
    ]} />
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="border border-[#c9d0d5] bg-white p-6">
        <Typography.Title level={3}>Open by ID</Typography.Title>
        <Typography.Paragraph>Open a specific organization or project directly using its ID.</Typography.Paragraph>
        <Form layout="vertical">
          <Form.Item label="Organization ID"><Input value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} /></Form.Item>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button disabled={!organizationId.trim()} onClick={() => navigate(`/projects?organizationId=${encodedOrganizationId}`)}>Open projects</Button>
            <Button disabled={!organizationId.trim()} onClick={() => navigate(`/organizations/${encodedOrganizationId}`)}>Manage users</Button>
            <Button disabled={!organizationId.trim()} onClick={() => navigate(`/projects/create?organizationId=${encodedOrganizationId}`)}>New project</Button>
          </div>
          <Form.Item label="Project ID"><Input value={projectId} onChange={(event) => setProjectId(event.target.value)} /></Form.Item>
          <Button disabled={!organizationId.trim() || !projectId.trim()} onClick={() => navigate(`/projects/${encodedOrganizationId}/${encodeURIComponent(projectId.trim())}`)}>Open project</Button>
        </Form>
      </section>
      <section className="border border-[#c9d0d5] bg-white p-6">
        <Typography.Title level={3}>Create organization</Typography.Title>
        <Form form={organizationForm} layout="vertical" disabled={createOrganization.isLoading} onFinish={(values) => createOrganization.mutate(values)}>
          <Form.Item label="Organization name" name="name" rules={[{ required: true, whitespace: true }, { max: 256 }]}><Input /></Form.Item>
          <Button type="primary" htmlType="submit" loading={createOrganization.isLoading}>Create organization</Button>
        </Form>
        {createdOrganization && <Alert className="mt-4" type="success" title={`Created ${createdOrganization.name}`} description={<Link to={`/organizations/${createdOrganization.id}`}>Manage {createdOrganization.id}</Link>} />}
      </section>
      <section className="border border-[#c9d0d5] bg-white p-6">
        <Typography.Title level={3}>Create unassigned account</Typography.Title>
        <Form form={userForm} layout="vertical" initialValues={{ isAdmin: false }} disabled={createUser.isLoading} onFinish={(values) => createUser.mutate(values)}>
          <Form.Item label="Full name" name="friendlyName" rules={[{ required: true, whitespace: true }, { max: 256 }]}><Input autoComplete="off" /></Form.Item>
          <Form.Item label="Username" name="username" rules={[{ required: true, whitespace: true }, { max: 16 }]}><Input autoComplete="off" /></Form.Item>
          <Form.Item name="isAdmin" valuePropName="checked"><Checkbox>Global administrator</Checkbox></Form.Item>
          <Button type="primary" htmlType="submit" loading={createUser.isLoading}>Create account</Button>
        </Form>
      </section>
    </div>
    {Boolean(failure) && <AccessFeedback error={failure} onRetry={() => { createOrganization.reset(); createUser.reset(); }} />}
  </CrudPageLayout>;
}
