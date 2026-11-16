import { Button, Modal } from "antd";
import { useBlocker } from "react-router";

export function AnnotationNavigationGuard({ hasDraft, pending, onDiscard }: {
  hasDraft: boolean; pending: boolean; onDiscard: () => void;
}) {
  const blocker = useBlocker(hasDraft || pending);
  return <Modal title="Unsaved outline changes" open={blocker.state === "blocked"}
    onCancel={() => blocker.reset?.()} mask={{ closable: false }}
    footer={<div className="flex flex-wrap justify-end gap-2">
      <Button danger disabled={pending} onClick={() => { onDiscard(); blocker.proceed?.(); }}>Discard changes</Button>
      <Button disabled={pending} onClick={() => blocker.proceed?.()}>Keep draft and leave</Button>
      <Button type="primary" onClick={() => blocker.reset?.()}>Stay and continue editing</Button>
    </div>}>
    <p>{pending ? "Wait for the current save to finish before leaving." : "Your outline changes have not been saved to the project."}</p>
    <p>Kept drafts can be resumed when you return to this project while signed in. Reloading the page or ending your session clears them.</p>
  </Modal>;
}
