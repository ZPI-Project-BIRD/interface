import { message, Flex, Typography } from "antd";
import { useNavigate } from "react-router";
import LoginForm from "../components/LoginForm";
import type { LoginCredentials } from "../api";
import { useAuthStore } from "../stores/authStore";
import logo from "../assets/logo.png";

function LoginPage() {
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);

  async function handleLogin(credentials: LoginCredentials) {
    try {
      await login(credentials);
      messageApi.success("Logged in successfully.");
      navigate("/map-selection", { replace: true });
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : "Unable to log in.");
    }
  }

  return (
    <Flex vertical justify="center" align="center" className="min-h-dvh">
      {contextHolder}
      <div className="max-w-md flex flex-row items-center justify-center space-x-3 mb-8">
        <img src={logo} alt="Logo of BIRD" className="size-16 shrink-0" />
        <Typography.Title level={3} className="mb-0!">
          Building Irregularity Recognition and Detection
        </Typography.Title>
      </div>
      <LoginForm onSubmit={handleLogin} loading={loading} />
    </Flex>
  );
}

export default LoginPage;
