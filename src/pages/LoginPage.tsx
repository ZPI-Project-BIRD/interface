import { useState } from "react";
import { message, Flex } from "antd";
import { useNavigate } from "react-router";
import LoginForm from "../components/LoginForm";
import { login } from "../api/auth";
import type { LoginCredentials } from "../api/auth";
import Title from "../components/Title";

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  async function handleLogin(credentials: LoginCredentials) {
    setLoading(true);
    try {
      await login(credentials);
      messageApi.success("Logged in successfully.");
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : "Unable to log in.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Flex vertical justify="center" align="center" className="min-h-dvh">
      {contextHolder}
      <Title />
      <LoginForm
        onSubmit={handleLogin}
        loading={loading}
        onRegisterClick={() => navigate("/register")}
      />
    </Flex>
  );
}

export default LoginPage;
