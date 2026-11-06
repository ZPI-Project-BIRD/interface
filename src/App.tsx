import "./App.css";
import { useEffect } from "react";
import { ConfigProvider, Flex, Spin } from "antd";
import { Navigate, Route, Routes } from "react-router";
import { theme } from "./theme";
import LoginPage from "./pages/LoginPage";
import MapSelectionPage from "./pages/MapSelectionPage";
import NotFoundPage from "./pages/NotFoundPage";
import CreateProjectPage from "./pages/projects/CreateProjectPage";
import ProjectsPage from "./pages/projects/ProjectsPage";
import ProjectPage from "./pages/projects/ProjectPage";
import OrganizationsPage from "./pages/organizations/OrganizationsPage";
import AccountPage from "./pages/AccountPage";
import { useAuthStore } from "./stores/authStore";
import {
  RequireAuth,
  RequireGuest,
  RequireOrganizationOwner,
} from "./components/AuthRouteGuards";

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
            <Route path="/" element={<Navigate to="/projects" replace />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/map-selection" element={<MapSelectionPage />} />
            <Route path="/projects/create" element={<CreateProjectPage />} />
            <Route path="/projects/:organizationId/:projectId" element={<ProjectPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route element={<RequireOrganizationOwner />}>
              <Route path="/organizations" element={<OrganizationsPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      )}
    </ConfigProvider>
  );
}

export default App;
