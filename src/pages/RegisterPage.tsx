import { useState } from "react";
import { useNavigate } from "react-router";
import RegisterForm from "../components/RegisterForm";
import { Flex, message } from "antd";
import Title from "../components/Title";
import { api, type LoginCredentials } from "../api";

function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  async function handleRegister(credentials: LoginCredentials) {
    setLoading(true);
    try {
      await api.auth.register(credentials);
      messageApi.success("Account created. You can now log in.");
    } catch (error) {
      messageApi.error(
        error instanceof Error ? error.message : "Unable to create your account.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Flex vertical justify="center" align="center" className="min-h-dvh">
      {contextHolder}
      <Title />
      <RegisterForm
        onSubmit={handleRegister}
        loading={loading}
        onLoginClick={() => navigate("/login")}
      />
    </Flex>
  );
}

export default RegisterPage;
