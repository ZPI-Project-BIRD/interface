import { Alert } from "antd";
import { ApiError } from "../api";

export function MutationFeedback({ error, conflict }: { error: unknown; conflict?: string }) {
  if (!error || (error instanceof Error && error.name === "AbortError")) return null;
  const description = error instanceof ApiError && error.status === 409 && conflict
    ? conflict : error instanceof Error ? error.message : "The request could not be completed.";
  return <Alert className="my-3" type="error" showIcon title="Action unsuccessful" description={description} />;
}
