import { Alert, Button, Spin, Tag, Typography } from "antd";
import { useOrganizations } from "../hooks/useOrganizationCapabilities";
import { describeOrganizationAccess } from "../permissions/accessDescriptions";

export function AccountAccess() {
  const { query, memberships, administrator } = useOrganizations();
  return <section className="mt-4 border border-[#c9d0d5] bg-white p-6" aria-labelledby="account-access-title">
    <Typography.Title id="account-access-title" level={3} className="!mt-0 !text-lg">Organizations and access</Typography.Title>
    <div className="mb-4">
      <Tag color={administrator ? "green" : "default"}>{administrator ? "Global administrator" : "Standard account"}</Tag>
      <p className="mt-2 text-sm text-neutral-600">{administrator
        ? "You can administer all organizations and accounts, assign owners, and access all projects, including organizations where you have no membership."
        : "Your role in each organization determines which projects and actions you can access."}</p>
    </div>
    {query.isError ? <Alert type="error" showIcon title="Could not load organization access"
      description="Your membership information is unavailable. Refresh it to see your current roles."
      action={<Button onClick={() => void query.refetch()}>Retry</Button>} />
      : query.isLoading || query.isFetching ? <div className="flex items-center gap-3" role="status"><Spin size="small" /><span>Checking organization access…</span></div>
      : memberships.length === 0 ? <p>You do not belong to any organizations.{administrator ? " Your global administrator access still applies." : " Contact an organization owner or global administrator to be added."}</p>
      : <ul className="m-0 list-none divide-y divide-neutral-200 p-0">
        {memberships.map(({ organization, role }) => {
          const details = describeOrganizationAccess(role);
          return <li key={organization.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2"><Typography.Text strong>{organization.name}</Typography.Text><Tag>{details.label}</Tag></div>
            <p className="mb-0 mt-2 text-sm text-neutral-600">{details.description}</p>
          </li>;
        })}
      </ul>}
  </section>;
}
