import { useState } from "react";
import { Card, Form, Input, Button, Checkbox, Flex } from "antd";
import {
  UserOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from "@ant-design/icons";

interface LoginFormValues {
  email: string;
  password: string;
  remember: boolean;
}

export interface LoginFormProps {
  onSubmit?: (values: LoginFormValues) => void | Promise<void>;
  onRegisterClick?: () => void;
  onForgotPasswordClick?: () => void;
  loading?: boolean;
}

const LoginForm = ({
  onSubmit,
  onForgotPasswordClick,
  onRegisterClick,
  loading = false,
}: LoginFormProps) => {
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <Card
      title="Login"
      className="w-full max-w-5xl"
      extra={
        onRegisterClick && ( //show only when this func is passed
          <Button type="link" onClick={onRegisterClick}>
            Register
          </Button>
        )
      }
    >
      <Form<LoginFormValues>
        layout="vertical"
        disabled={loading}
        requiredMark={false}
        initialValues={{ remember: false }}
        onFinish={onSubmit}
      >
        <Form.Item
          name="email"
          rules={[
            { required: true, message: "Please enter your email address." },
            { type: "email", message: "Enter a valid email address." },
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="user@example.com"
            type="email"
            autoComplete="email"
            aria-label="Email"
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
            iconRender={(visible) =>
              visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
            }
            aria-label="Password"
          />
        </Form.Item>

        <Flex vertical gap="large">
          <Flex justify="space-between" align="center" gap="small" wrap>
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox>Remember me?</Checkbox>
            </Form.Item>
            {onForgotPasswordClick && (
              <Button type="link" onClick={onForgotPasswordClick}>
                Forgot password?
              </Button>
            )}
          </Flex>

          <Button type="primary" htmlType="submit" loading={loading} block>
            Log in
          </Button>
        </Flex>
      </Form>
    </Card>
  );
};

export default LoginForm;
