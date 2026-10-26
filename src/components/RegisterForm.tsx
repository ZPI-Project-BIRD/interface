import { useState } from "react";
import { Button, Card, Form, Input } from "antd";
import {
  EyeInvisibleOutlined,
  EyeOutlined,
  UserOutlined,
} from "@ant-design/icons";

interface RegisterFormValues {
  email: string;
  confirmEmail: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterFormProps {
  onSubmit?: (values: RegisterFormValues) => void | Promise<void>;
  onLoginClick?: () => void;
  loading?: boolean;
}

const RegisterForm = ({
  onSubmit,
  onLoginClick,
  loading = false,
}: RegisterFormProps) => {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  return (
    <Card
      title="Register"
      size="medium"
      className="w-full max-w-xl"
      extra={
        onLoginClick && (
          <Button type="link" onClick={onLoginClick}>
            Log in
          </Button>
        )
      }
    >
      <Form<RegisterFormValues>
        layout="vertical"
        requiredMark={false}
        colon={false}
        onFinish={onSubmit}
      >
        <Form.Item
          label="enter email:"
          name="email"
          rules={[
            { required: true, message: 'Please enter your email address.' },
            { type: 'email', message: 'Enter a valid email address.' },
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="user@example.com"
            type="email"
            autoComplete="email"
          />
        </Form.Item>

        <Form.Item
          label="confirm email:"
          name="confirmEmail"
          dependencies={['email']}
          rules={[
            { required: true, message: 'Please confirm your email address.' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('email') === value) {
                  return Promise.resolve();
                }

                return Promise.reject(new Error('Email addresses do not match.'));
              },
            }),
          ]}
        >
          <Input
            prefix={<UserOutlined />}
            placeholder="user@example.com"
            type="email"
            autoComplete="email"
          />
        </Form.Item>

        <Form.Item
          label="enter password:"
          name="password"
          rules={[
            { required: true, message: 'Please enter a password.' },
            { min: 8, message: 'Use at least 8 characters.' },
          ]}
        >
          <Input.Password
            placeholder="Enter password"
            autoComplete="new-password"
            visibilityToggle={{
              visible: passwordVisible,
              onVisibleChange: setPasswordVisible,
            }}
            iconRender={(visible) =>
              visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
            }
          />
        </Form.Item>

        <Form.Item
          label="confirm password:"
          name="confirmPassword"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Please confirm your password.' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }

                return Promise.reject(new Error('Passwords do not match.'));
              },
            }),
          ]}
        >
          <Input.Password
            placeholder="Confirm password"
            autoComplete="new-password"
            visibilityToggle={{
              visible: confirmPasswordVisible,
              onVisibleChange: setConfirmPasswordVisible,
            }}
            iconRender={(visible) =>
              visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
            }
          />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={loading} block>
          Create an account
        </Button>
      </Form>
    </Card>
  );
};

export default RegisterForm;
