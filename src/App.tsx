import "./App.css";
import { ConfigProvider } from "antd";
import { Navigate, Route, Routes } from "react-router";
import { theme } from "./theme";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Navbar from "./components/Navbar";

function App() {
  return (
    <ConfigProvider theme={theme}>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    </ConfigProvider>
  );
}

export default App;
