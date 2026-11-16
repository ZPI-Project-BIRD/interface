import { Button, Form, Input, Modal, Select } from "antd";
import { useMutation, useQueryClient } from "react-query";
import { api, type OrganizationRole } from "../api";
import { useOrganizationCapabilities } from "../hooks/useOrganizationCapabilities";
import { privateQueryKey } from "../queryClient";
import { isCurrentSession, useAuthStore, withSession } from "../stores/authStore";
import { UserPicker } from "./admin/UserPicker";
import { MutationFeedback } from "./MutationFeedback";

export function AddExistingMemberModal({ organizationId, onClose, memberIds }: {
  organizationId: string; onClose: () => void; memberIds: string[];
}) {
  const access = useOrganizationCapabilities(organizationId);
  const sessionId = useAuthStore((state) => state.sessionId);
  const client = useQueryClient();
  const add = useMutation(({ userId, membershipRole }: { userId: string; membershipRole: OrganizationRole }) =>
    withSession(sessionId, () => {
      if (!access.canManageUsers || !access.userRoles.includes(membershipRole)) throw new Error("You cannot assign this role.");
      return api.organizations.addMembership(organizationId, userId, membershipRole);
    }), {
    mutationKey: privateQueryKey(sessionId, "assign-membership", organizationId), retry: false,
    onSuccess: () => {
      if (!isCurrentSession(sessionId)) return;
      void client.invalidateQueries(privateQueryKey(sessionId, "organization-users", organizationId));
      void client.invalidateQueries(privateQueryKey(sessionId, "organizations", "my"));
      onClose();
    },
    onError: (error) => access.reportError(error),
  });
  return <Modal title="Add existing account" open={access.canManageUsers} footer={null} onCancel={() => { if (!add.isLoading) onClose(); }}>
    <Form layout="vertical" initialValues={{ membershipRole: "VIEWER" }} disabled={add.isLoading} onFinish={(values) => add.mutate(values)}>
      <Form.Item label={access.administrator ? "Account" : "Account ID"} name="userId" rules={[
        { required: true }, ...(!access.administrator ? [{ pattern: /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i, message: "Enter a valid user ID." }] : []),
      ]} extra={!access.administrator ? "Use the account ID supplied by the user or a global administrator." : undefined}>
        {access.administrator ? <UserPicker excludeIds={memberIds} disabled={add.isLoading} /> : <Input />}
      </Form.Item>
      <Form.Item label="Organization role" name="membershipRole" rules={[{ required: true }]}>
        <Select options={access.userRoles.map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() }))} />
      </Form.Item>
      <MutationFeedback error={add.error} conflict="This account is already a member. Refresh the member list to change its role." />
      <Button type="primary" htmlType="submit" loading={add.isLoading}>Add member</Button>
    </Form>
  </Modal>;
}
