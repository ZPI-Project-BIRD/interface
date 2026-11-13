import { Alert, Button, Modal, Space } from "antd";
import { useMutation } from "react-query";
import { Link } from "react-router";
import { useOrganizationCapabilities } from "../../hooks/useOrganizationCapabilities";
import { isCurrentSession, useAuthStore } from "../../stores/authStore";
import { privateQueryKey } from "../../queryClient";
import type { CreationState, ProjectCreationFlow } from "../../projects/projectCreation";

export function ProjectCreationRecovery({ creation, flow }: { creation: CreationState; flow: ProjectCreationFlow }) {
  const sessionId = useAuthStore((state) => state.sessionId);
  const access = useOrganizationCapabilities(creation.submission.organizationId);
  const [modal, modalContext] = Modal.useModal();
  const check = useMutation(() => flow.checkExisting(), {
    mutationKey: privateQueryKey(sessionId, "check-project-creation"), retry: false,
    onError: (error) => {
      if (isCurrentSession(sessionId)) access.reportError(error, creation.submission.organizationId);
    },
  });
  const organizationId = encodeURIComponent(creation.submission.organizationId);
  return <>
    {modalContext}
    <Alert className="mb-5" type="warning" showIcon title="Creation outcome not yet known"
      description={<>
        <p>{creation.error}</p>
        <p>The project may already be saved, even if sheet discovery failed. Your submitted name and area are retained. Check existing projects before considering another submission.</p>
        <Space wrap>
          <Button loading={creation.checking} onClick={() => check.mutate()}>Check existing projects</Button>
          <Link to={`/projects?organizationId=${organizationId}`}><Button>View organization projects</Button></Link>
        </Space>
        {creation.checkError && <p role="alert">Could not check projects: {creation.checkError}. No creation request was sent.</p>}
        {creation.checked && !creation.checkError && <>
          <p>{creation.candidates?.length ? "New projects matching the submitted name and area:" : "No new matching projects were found. The earlier request may still be running; this does not prove that creation failed."}</p>
          {creation.candidates?.map((project) => <p key={project.id}>
            <Link to={`/projects/${organizationId}/${encodeURIComponent(project.id)}`}>Open {project.name} · {project.id}</Link>
          </p>)}
          {Boolean(creation.candidates?.length) && <p>A matching name and area do not prove that a project came from this submission. Inspect it before creating another. Opening it does not restart discovery.</p>}
          {creation.outcome === "unknown" && <Button disabled={creation.checking} onClick={() => modal.confirm({
            title: "Allow another project submission?",
            content: "The earlier request may still complete or already exist, even if no matching project was listed. Another submission can create a duplicate. This only unlocks the form; it does not submit it.",
            okText: "I understand; unlock the form", cancelText: "Keep checking",
            onOk: () => { if (isCurrentSession(sessionId)) flow.allowAnotherSubmission(); },
          })}>Consider another submission</Button>}
        </>}
        {creation.outcome === "acknowledged" && <p>The form is unlocked at your request. Submitting it creates another project and may duplicate the earlier one.</p>}
      </>}
    />
  </>;
}
