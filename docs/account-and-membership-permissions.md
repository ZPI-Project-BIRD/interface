# Account and organization membership management

Accounts are shared across organizations. Organization membership changes apply only to the selected organization; profile and credential changes affect the account everywhere.

## Organization membership stories

- As an organization owner, I want to change a member's Viewer, Annotator or Editor role so their access to my organization's resources remains appropriate.
- As an organization owner, I want to add or remove organization memberships without changing the member's account or access to other organizations.
- As a global administrator, I want to assign or change organization owners. The last owner cannot be removed or demoted until another owner is assigned.

## Global account stories

- As a signed-in user, I want to update my own display name and password.
- As a global administrator, I want to update a member account's display name or reset its password when assistance is needed.
- As a signed-in user, I want to see my global administrator status, organization memberships, roles and associated permissions on my Account page.

Organization owners do not reset global passwords or edit other users' global profiles. The membership editor explains this distinction. Password recovery directs users to a global administrator.

## Annotation drafts

Unsaved outlines are kept per organization and project in the current signed-in session. Navigation offers Stay, Keep draft and leave, or Discard changes. Returning to a project resumes a kept draft with its original version for conflict detection. Saving or explicitly discarding clears it. Refreshing the page, signing out, or session expiration clears drafts; page unload and sign-out warn before an intentional loss.
