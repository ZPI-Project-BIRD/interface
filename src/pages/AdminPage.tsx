import { Tabs, Typography } from "antd";
import CrudPageLayout from "../components/ProjectsPageLayout";
import { useAuthStore } from "../stores/authStore";
import { isAdministrator } from "../permissions/organizationCapabilities";
import { AdminOrganizations } from "../components/admin/AdminOrganizations";
import { AdminUsers } from "../components/admin/AdminUsers";

export default function AdminPage() {
  const user = useAuthStore((state) => state.user);
  if (!isAdministrator(user)) return null;
  return <CrudPageLayout>
    <header className="mb-5">
      <Typography.Title level={2} className="!mt-0 !mb-1">Administration</Typography.Title>
      <Typography.Paragraph type="secondary" className="!mb-0">Manage organizations and platform accounts.</Typography.Paragraph>
    </header>
    <Tabs items={[
      { key: "organizations", label: "Organizations", children: <AdminOrganizations /> },
      { key: "accounts", label: "Accounts", children: <AdminUsers /> },
    ]} />
  </CrudPageLayout>;
}
