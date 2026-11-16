const roles: Record<string, { label: string; description: string }> = {
  VIEWER: { label: "Viewer", description: "View projects, source sheets and detection results." },
  ANNOTATOR: { label: "Annotator", description: "View projects and add, correct, delete or verify detections." },
  EDITOR: { label: "Editor", description: "Create projects, retry processing, and add, correct, delete or verify detections." },
  OWNER: { label: "Owner", description: "Create and delete projects, annotate results, review annotation history, and manage memberships and member roles." },
};

export function describeOrganizationAccess(role: string) {
  return roles[role.replace(/^_?\d+_/, "")] ?? { label: "Unknown role", description: "Your permissions could not be identified. Contact a global administrator." };
}
