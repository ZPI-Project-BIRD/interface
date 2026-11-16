import { Button, Checkbox, Form, Input, Modal, Typography } from "antd";
import { useMutation, useQueryClient } from "react-query";
import { useNavigate } from "react-router";
import { api } from "../../api";
import type { CreateUnassignedUserPayload } from "../../api/contracts/users";
import { privateQueryKey } from "../../queryClient";
import { isCurrentSession, useAuthStore, withSession } from "../../stores/authStore";
import { MutationFeedback } from "../MutationFeedback";

export function CreateOrganizationDialog({ onClose }: { onClose: () => void }) {
  const sessionId = useAuthStore((state) => state.sessionId);
  const client = useQueryClient();
  const navigate = useNavigate();
  const create = useMutation(({ name }: { name: string }) => withSession(sessionId, () => api.organizations.create(name.trim())), {
    mutationKey: privateQueryKey(sessionId, "admin-create-organization"), retry: false,
    onSuccess: (organization) => {
      if (!isCurrentSession(sessionId)) return;
      void client.invalidateQueries(privateQueryKey(sessionId, "organizations", "all"));
      onClose();
      navigate(`/organizations/${organization.id}`);
    },
  });
  return <Modal title="Create organization" open footer={null} mask={{ closable: !create.isLoading }}
    closable={!create.isLoading} keyboard={!create.isLoading} onCancel={onClose}>
    <Typography.Paragraph type="secondary">Create the organization, then assign its owner on the members page.</Typography.Paragraph>
    <Form layout="vertical" disabled={create.isLoading} onFinish={(values) => create.mutate(values)}>
      <Form.Item label="Organization name" name="name" rules={[{ required: true, whitespace: true }, { max: 256 }]}>
        <Input autoFocus autoComplete="off" />
      </Form.Item>
      <MutationFeedback error={create.error} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button disabled={create.isLoading} onClick={onClose}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={create.isLoading}>Create organization</Button>
      </div>
    </Form>
  </Modal>;
}

export function CreateAccountDialog({ onClose }: { onClose: () => void }) {
  const sessionId = useAuthStore((state) => state.sessionId);
  const client = useQueryClient();
  const create = useMutation((payload: CreateUnassignedUserPayload) => withSession(sessionId, () => api.users.createUnassigned(payload)), {
    mutationKey: privateQueryKey(sessionId, "admin-create-unassigned-user"), retry: false,
    onSuccess: () => {
      if (!isCurrentSession(sessionId)) return;
      void client.invalidateQueries(privateQueryKey(sessionId, "platform-users"));
      void client.invalidateQueries(privateQueryKey(sessionId, "user-picker"));
    },
  });
  const created = create.data;
  return <Modal title={created ? "Account created" : "Create account"} open footer={null}
    mask={{ closable: !create.isLoading }} closable={!create.isLoading} keyboard={!create.isLoading} onCancel={onClose}>
    {created ? <>
      <Typography.Paragraph>Share these credentials with the user. The generated password is only shown here.</Typography.Paragraph>
      <dl className="grid gap-3 rounded-xl border border-app-border bg-page p-4">
        <div><dt className="text-sm text-muted">Username</dt><dd className="m-0"><Typography.Text copyable>{created.user.username}</Typography.Text></dd></div>
        <div><dt className="text-sm text-muted">Temporary password</dt><dd className="m-0 break-all"><Typography.Text code copyable>{created.password}</Typography.Text></dd></div>
      </dl>
      <Typography.Paragraph className="!mt-4" type="secondary">Assign this account to an organization from its Members &amp; owners page.</Typography.Paragraph>
      <div className="flex justify-end"><Button type="primary" onClick={onClose}>Done</Button></div>
    </> : <>
      <Typography.Paragraph type="secondary">The account starts without an organization. You can assign it afterwards.</Typography.Paragraph>
      <Form layout="vertical" initialValues={{ isAdmin: false }} disabled={create.isLoading} onFinish={(values) => create.mutate(values)}>
        <Form.Item label="Full name" name="friendlyName" rules={[{ required: true, whitespace: true }, { max: 256 }]}><Input autoFocus autoComplete="off" /></Form.Item>
        <Form.Item label="Username" name="username" rules={[{ required: true, whitespace: true }, { max: 16 }]}><Input autoComplete="off" /></Form.Item>
        <Form.Item name="isAdmin" valuePropName="checked"><Checkbox>Global administrator</Checkbox></Form.Item>
        <MutationFeedback error={create.error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button disabled={create.isLoading} onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={create.isLoading}>Create account</Button>
        </div>
      </Form>
    </>}
  </Modal>;
}
