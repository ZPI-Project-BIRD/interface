import "./App.css";
import { useEffect } from "react";
import { ConfigProvider, Flex, Spin } from "antd";
import { Navigate, Route, Routes } from "react-router";
import { theme } from "./theme";
import LoginPage from "./pages/LoginPage";
import MapSelectionPage from "./pages/MapSelectionPage";
import NotFoundPage from "./pages/NotFoundPage";
import { useAuthStore } from "./stores/authStore";
import { RequireAuth, RequireGuest } from "./components/AuthRouteGuards";

function App() {
  const initializeAuth = useAuthStore((state) => state.initialize);
  const initialized = useAuthStore((state) => state.initialized);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  return (
    <ConfigProvider theme={theme}>
      {!initialized ? (
        <Flex align="center" justify="center" className="min-h-dvh">
          <Spin size="large" />
        </Flex>
      ) : (
        <Routes>
          <Route element={<RequireGuest />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route path="/" element={<Navigate to="/map-selection" replace />} />
            <Route path="/map-selection" element={<MapSelectionPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      )}
    </ConfigProvider>
  );
}

export default App;
