import { Button, Form, Input, Modal, Select, Typography } from "antd";
import { useMutation, useQueryClient } from "react-query";
import { api, type CreateOrganizationUserPayload } from "../../api";
import { useOrganizationCapabilities } from "../../hooks/useOrganizationCapabilities";
import { describeOrganizationAccess } from "../../permissions/accessDescriptions";
import { privateQueryKey } from "../../queryClient";
import { isCurrentSession, useAuthStore, withSession } from "../../stores/authStore";
import { MutationFeedback } from "../MutationFeedback";

export function CreateMemberDialog({ organizationId, onClose }: { organizationId: string; onClose: () => void }) {
  const access = useOrganizationCapabilities(organizationId);
  const sessionId = useAuthStore((state) => state.sessionId);
  const client = useQueryClient();
  const create = useMutation((values: CreateOrganizationUserPayload) => withSession(sessionId, () => {
    if (!access.canManageUsers || !access.userRoles.includes(values.membershipRole)) throw new Error("You cannot create a member with this role.");
    return api.organizations.createUser(organizationId, {
      ...values, username: values.username.trim(), friendlyName: values.friendlyName.trim(),
    });
  }), {
    mutationKey: privateQueryKey(sessionId, "create-organization-user", organizationId), retry: false,
    onSuccess: () => {
      if (!isCurrentSession(sessionId)) return;
      void client.invalidateQueries(privateQueryKey(sessionId, "organization-users", organizationId));
      for (const key of ["platform-users", "user-picker"]) void client.invalidateQueries(privateQueryKey(sessionId, key));
    },
    onError: (error) => access.reportError(error),
  });
  const created = isCurrentSession(sessionId) ? create.data : undefined;
  return <Modal title={created ? "Member account created" : "Create member account"} open={access.canManageUsers} footer={null}
    mask={{ closable: !create.isLoading }} closable={!create.isLoading} keyboard={!create.isLoading} onCancel={onClose}>
    {created ? <>
      <Typography.Paragraph>{created.user.friendlyName || created.user.username} has been added. Share these credentials with the member.</Typography.Paragraph>
      <dl className="grid gap-3 rounded-xl border border-app-border bg-surface-muted p-4">
        <div><dt className="text-sm text-muted">Username</dt><dd className="m-0"><Typography.Text copyable>{created.user.username}</Typography.Text></dd></div>
        <div><dt className="text-sm text-muted">Temporary password</dt><dd className="m-0 break-all"><Typography.Text code copyable>{created.password}</Typography.Text></dd></div>
      </dl>
      <div className="mt-4 flex justify-end"><Button type="primary" onClick={onClose}>Done</Button></div>
    </> : <Form<CreateOrganizationUserPayload> layout="vertical" requiredMark={false} initialValues={{ membershipRole: "VIEWER" }}
      disabled={create.isLoading} onFinish={(values) => create.mutate(values)}>
      <Form.Item label="Full name" name="friendlyName" rules={[{ required: true, whitespace: true }, { max: 256 }]}>
        <Input autoFocus autoComplete="off" />
      </Form.Item>
      <Form.Item label="Username" name="username" rules={[{ required: true, whitespace: true }, { max: 16 }]}>
        <Input autoComplete="off" />
      </Form.Item>
      <Form.Item label="Organization role" name="membershipRole" rules={[{ required: true }]}>
        <Select options={access.userRoles.map((value) => ({ value, label: describeOrganizationAccess(value).label }))} />
      </Form.Item>
      <MutationFeedback error={create.error} conflict="That username is already in use. Add the existing account or choose another username." />
      <div className="flex justify-end gap-2">
        <Button disabled={create.isLoading} onClick={onClose}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={create.isLoading}>Create account</Button>
      </div>
    </Form>}
  </Modal>;
}
