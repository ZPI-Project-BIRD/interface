import { useState } from "react";
import { Card, Form, Input, Button, Flex, Popconfirm } from "antd";
import { UserOutlined, EyeOutlined, EyeInvisibleOutlined } from "@ant-design/icons";

interface LoginFormValues {
  username: string;
  password: string;
}

export interface LoginFormProps {
  onSubmit?: (values: LoginFormValues) => void | Promise<void>;
  loading?: boolean;
}

const LoginForm = ({ onSubmit, loading = false }: LoginFormProps) => {
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <Card title="Login" className="w-full max-w-xl">
      <Form<LoginFormValues>
        layout="vertical"
        disabled={loading}
        requiredMark={false}
        onFinish={onSubmit}
      >
        <Form.Item
          name="username"
          rules={[{ required: true, message: "Please enter your username." }]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="jkowalski"
            autoComplete="username"
            aria-label="Username"
          />
        </Form.Item>

        <Form.Item
          name="password"
          rules={[{ required: true, message: "Please enter your password." }]}
        >
          <Input.Password
            placeholder="Enter password"
            autoComplete="current-password"
            visibilityToggle={{
              visible: passwordVisible,
              onVisibleChange: setPasswordVisible,
            }}
            iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
            aria-label="Password"
          />
        </Form.Item>

        <Flex vertical gap="large">
          <Flex justify="flex-end" align="center" gap="small" wrap>
            <Popconfirm
              title="Password recovery"
              description="Contact a global administrator to request a password reset."
              okText="Got it"
              showCancel={false}
              placement="topRight"
            >
              <Button type="link">Forgot password?</Button>
            </Popconfirm>
          </Flex>

          <Button type="primary" htmlType="submit" loading={loading} block className="h-12!">
            Log in
          </Button>
        </Flex>
      </Form>
    </Card>
  );
};

export default LoginForm;
