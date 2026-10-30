import { Alert, Button, Form, Input, Spin, Typography, message } from "antd";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { api, type CurrentUser, type UpdatePasswordPayload } from "../api";
import CrudPageLayout from "../components/ProjectsPageLayout";
import { useAuthStore } from "../stores/authStore";

interface FullNameFormValues {
  fullName: string;
}

interface PasswordFormValues extends UpdatePasswordPayload {
  confirmPassword: string;
}

function AccountPage() {
  const [fullNameForm] = Form.useForm<FullNameFormValues>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const queryClient = useQueryClient();
  const username = useAuthStore((state) => state.user?.username);

  const currentUserQuery = useQuery(["account", username], () => api.me.get(), {
    enabled: Boolean(username),
  });

  const fullNameMutation = useMutation(
    ({ fullName }: FullNameFormValues) => api.me.updateFullName({ fullName: fullName.trim() }),
    {
      onSuccess: (user) => {
        queryClient.setQueryData<CurrentUser>(["account", username], user);
        fullNameForm.setFieldsValue({ fullName: user.fullName });
        messageApi.success("Full name updated.");
      },
      onError: (error) => {
        messageApi.error(error instanceof Error ? error.message : "Unable to update your name.");
      },
    },
  );

  const passwordMutation = useMutation(
    ({ currentPassword, newPassword }: PasswordFormValues) =>
      api.me.updatePassword({ currentPassword, newPassword }),
    {
      onSuccess: () => {
        passwordForm.resetFields();
        messageApi.success("Password updated.");
      },
      onError: (error) => {
        messageApi.error(
          error instanceof Error ? error.message : "Unable to update your password.",
        );
      },
    },
  );

  return (
    <CrudPageLayout>
      {messageContextHolder}

      {currentUserQuery.isLoading && (
        <div className="flex min-h-105 items-center justify-center border border-[#c9d0d5] bg-white">
          <Spin size="large" />
        </div>
      )}

      {currentUserQuery.isError && (
        <Alert
          type="error"
          showIcon
          message="Could not load your account"
          description={
            currentUserQuery.error instanceof Error
              ? currentUserQuery.error.message
              : "Please try again."
          }
          action={<Button onClick={() => void currentUserQuery.refetch()}>Retry</Button>}
        />
      )}

      {currentUserQuery.isSuccess && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="border border-[#c9d0d5] bg-white p-6">
            <Typography.Title level={3} className="mb-1! text-lg!">
              Personal details
            </Typography.Title>

            <Form<FullNameFormValues>
              form={fullNameForm}
              layout="vertical"
              requiredMark={false}
              initialValues={{ fullName: currentUserQuery.data.fullName }}
              disabled={fullNameMutation.isLoading}
              onFinish={(values) => fullNameMutation.mutate(values)}
            >
              <Form.Item label="Username">
                <Input value={currentUserQuery.data.username} disabled />
              </Form.Item>
              <Form.Item
                label="Full name"
                name="fullName"
                rules={[
                  { required: true, message: "Please enter your full name." },
                  { whitespace: true, message: "Your full name cannot be blank." },
                  { max: 256, message: "Your full name cannot exceed 256 characters." },
                ]}
              >
                <Input autoComplete="name" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={fullNameMutation.isLoading}>
                Save changes
              </Button>
            </Form>
          </section>

          <section className="border border-[#c9d0d5] bg-white p-6">
            <Typography.Title level={3} className="mb-1! text-lg!">
              Change password
            </Typography.Title>

            <Form<PasswordFormValues>
              form={passwordForm}
              layout="vertical"
              requiredMark={false}
              disabled={passwordMutation.isLoading}
              onFinish={(values) => passwordMutation.mutate(values)}
            >
              <Form.Item
                label="Current password"
                name="currentPassword"
                rules={[{ required: true, message: "Please enter your current password." }]}
              >
                <Input.Password autoComplete="current-password" />
              </Form.Item>
              <Form.Item
                label="New password"
                name="newPassword"
                rules={[{ required: true, message: "Please enter a new password." }]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                label="Confirm new password"
                name="confirmPassword"
                dependencies={["newPassword"]}
                rules={[
                  { required: true, message: "Please confirm your new password." },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      return !value || getFieldValue("newPassword") === value
                        ? Promise.resolve()
                        : Promise.reject(new Error("The new passwords do not match."));
                    },
                  }),
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={passwordMutation.isLoading}>
                Update password
              </Button>
            </Form>
          </section>
        </div>
      )}
    </CrudPageLayout>
  );
}

export default AccountPage;
