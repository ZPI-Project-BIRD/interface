import { Alert, Button, Form, Input, Modal, Select, message } from "antd";
import { useMutation, useQueryClient } from "react-query";
import { api, type OrganizationUser, type OrganizationRole } from "../api";
import { useOrganizationCapabilities } from "../hooks/useOrganizationCapabilities";
import { isCurrentSession, useAuthStore, withSession } from "../stores/authStore";
import { privateQueryKey } from "../queryClient";
import { MutationFeedback } from "./MutationFeedback";

export function OrganizationUserEditor({ organizationId, user, onClose }: {
  organizationId: string; user: OrganizationUser; onClose: () => void;
}) {
  const access = useOrganizationCapabilities(organizationId);
  const sessionId = useAuthStore((state) => state.sessionId);
  const username = useAuthStore((state) => state.user?.username);
  const client = useQueryClient();
  const [passwordForm] = Form.useForm();
  const [messageApi, messageContext] = message.useMessage();
  const allowed = access.canEditUsers && user.username !== username;
  const canChangeRole = access.canChangeRole(user);
  const roleMutation = useMutation((role: OrganizationRole) => withSession(sessionId, () => {
    if (!canChangeRole || !access.userRoles.includes(role)) throw new Error("You cannot change this member's role.");
    return api.organizations.updateUserRole(organizationId, user.username, role);
  }), {
    mutationKey: privateQueryKey(sessionId, "update-member-role", organizationId, user.username), retry: false,
    onSuccess: () => {
      if (!isCurrentSession(sessionId)) return;
      void client.invalidateQueries(privateQueryKey(sessionId, "organization-users", organizationId));
      void client.invalidateQueries(privateQueryKey(sessionId, "organizations", "my"));
      onClose();
    },
    onError: (error) => access.reportError(error),
  });
  const mutation = useMutation(
    ({ kind, value }: { kind: "name" | "password"; value: string }) => withSession(sessionId, () => {
      if (!allowed) throw new Error("You cannot edit this user.");
      return kind === "name"
        ? api.organizations.updateUserFullName(organizationId, user.username, value.trim())
        : api.organizations.updateUserPassword(organizationId, user.username, value);
    }),
    {
      mutationKey: privateQueryKey(sessionId, "admin-edit-user", organizationId, user.username),
      onSuccess: () => {
        if (!isCurrentSession(sessionId)) return;
        passwordForm.resetFields();
        void client.invalidateQueries(privateQueryKey(sessionId, "organization-users", organizationId));
        messageApi.success("User updated.");
      },
      onError: (error) => {
        if (!isCurrentSession(sessionId)) return;
        access.reportError(error);
        messageApi.error(error instanceof Error ? error.message : "Unable to update user.");
      },
    },
  );
  return <Modal title={`${allowed ? "Edit account" : "Change organization role"}: ${user.username}`} open={allowed || canChangeRole} onCancel={() => { if (!mutation.isLoading && !roleMutation.isLoading) onClose(); }} footer={null}>
    {messageContext}
    {!allowed && <Alert className="mb-4" type="info" showIcon title="Organization membership"
      description="Role changes apply only to this organization. Members update their own account name and password; contact a global administrator for account resets or ownership changes." />}
    {canChangeRole && <Form layout="vertical" initialValues={{ membershipRole: user.membershipRole.replace(/^_?\d+_/, "") }} disabled={roleMutation.isLoading}
      onFinish={({ membershipRole }) => roleMutation.mutate(membershipRole)}>
      <Form.Item name="membershipRole" label="Organization role" rules={[{ required: true }]}>
        <Select options={access.userRoles.map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() }))} />
      </Form.Item>
      <MutationFeedback error={roleMutation.error} conflict="Assign another owner before demoting the last owner. Refresh the members to check their current roles." />
      <Button htmlType="submit" type="primary" loading={roleMutation.isLoading}>Save role</Button>
    </Form>}
    {allowed && <><Form className="mt-6" layout="vertical" initialValues={{ fullName: user.friendlyName }} disabled={mutation.isLoading || !allowed} onFinish={({ fullName }) => mutation.mutate({ kind: "name", value: fullName })}>
      <Form.Item name="fullName" label="Full name" rules={[{ required: true, whitespace: true }, { max: 256 }]}><Input /></Form.Item>
      <Button htmlType="submit" loading={mutation.isLoading}>Save name</Button>
    </Form>
    <Form form={passwordForm} className="mt-6" layout="vertical" disabled={mutation.isLoading || !allowed} onFinish={({ password }) => mutation.mutate({ kind: "password", value: password })}>
      <Form.Item name="password" label="New password" rules={[{ required: true, whitespace: true }]}><Input.Password autoComplete="new-password" /></Form.Item>
      <Button htmlType="submit" loading={mutation.isLoading}>Set password</Button>
    </Form><MutationFeedback error={mutation.error} /></>}
  </Modal>;
}
