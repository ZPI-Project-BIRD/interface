import { useState } from "react";
import { message } from "antd";
import { useNavigate } from "react-router";
import LoginForm from "../components/LoginForm";
import { login } from "../api/auth";
import type { LoginCredentials } from "../api/auth";

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
    <>
      {contextHolder}
      <LoginForm
        onSubmit={handleLogin}
        loading={loading}
        onRegisterClick={() => navigate("/register")}
      />
    </>
  );
}

export default LoginPage;
