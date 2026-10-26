import "./App.css";
import { useState } from "react";
import { ConfigProvider, message } from "antd";
import { theme } from "./theme";
import LoginForm from "./components/LoginForm";
import Navbar from "./components/Navbar";
import { login } from "./api/auth";
import type { LoginCredentials } from "./api/auth";

function App() {
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
    <ConfigProvider theme={theme}>
      {contextHolder}
      <Navbar />
      <LoginForm onSubmit={handleLogin} loading={loading} />
    </ConfigProvider>
  );
}

export default App;
