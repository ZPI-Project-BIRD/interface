import { Button, Result, Spin } from "antd";
import { Link } from "react-router";
import { isPermissionDenied } from "../permissions/organizationCapabilities";

export function AccessFeedback({ state, error, onRetry }: {
  state?: "loading" | "error" | "denied";
  error?: unknown;
  onRetry: () => void;
}) {
  if (state === "loading") return <div className="flex min-h-64 items-center justify-center"><Spin size="large" /></div>;
  const denied = state === "denied" || isPermissionDenied(error);
  return <Result
    status={denied ? "403" : "error"}
    title={denied ? "Access denied" : "Unable to check access or load data"}
    subTitle={denied ? "You no longer have permission for this organization or action. Refresh access to try again." : error instanceof Error ? error.message : "The server could not be reached. Please try again."}
    extra={<><Button onClick={onRetry}>Retry</Button><Link to="/projects"><Button>Back to projects</Button></Link></>}
  />;
}
