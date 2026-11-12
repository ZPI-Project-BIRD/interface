import { Button, Form, Input, Modal, message } from "antd";
import { useMutation, useQueryClient } from "react-query";
import { api, type OrganizationUser } from "../api";
import { useOrganizationCapabilities } from "../hooks/useOrganizationCapabilities";
import { isCurrentSession, useAuthStore, withSession } from "../stores/authStore";
import { privateQueryKey } from "../queryClient";

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
  return <Modal title={`Edit ${user.username}`} open={allowed} onCancel={onClose} footer={null}>
    {messageContext}
    <Form layout="vertical" initialValues={{ fullName: user.friendlyName }} disabled={mutation.isLoading || !allowed} onFinish={({ fullName }) => mutation.mutate({ kind: "name", value: fullName })}>
      <Form.Item name="fullName" label="Full name" rules={[{ required: true, whitespace: true }, { max: 256 }]}><Input /></Form.Item>
      <Button htmlType="submit" loading={mutation.isLoading}>Save name</Button>
    </Form>
    <Form form={passwordForm} className="mt-6" layout="vertical" disabled={mutation.isLoading || !allowed} onFinish={({ password }) => mutation.mutate({ kind: "password", value: password })}>
      <Form.Item name="password" label="New password" rules={[{ required: true, whitespace: true }]}><Input.Password autoComplete="new-password" /></Form.Item>
      <Button htmlType="submit" loading={mutation.isLoading}>Set password</Button>
    </Form>
  </Modal>;
}
