# ReviewRoom domain glossary

This file defines product terms without prescribing implementation details.

| Term | Meaning | Important boundary |
|---|---|---|
| Organization | A separate review workspace with its own people, reviewers, forms, settings, and records. | Data in one organization is never visible in another organization unless explicitly shared by a future product feature. |
| User | A person's global identity, identified by email and display name. | A User is not an authorization role and does not own one shared password for every workspace. |
| Membership | A User's participation in one Organization, with a role, active/removed state, and credentials for that role in that Organization. | Admin and reviewer sign-ins are separate; permissions are granted by the active Membership. |
| Owner | The initial workspace authority that can grant administrator access and control the workspace. | There is one bootstrap owner per initial workspace; do not build public self-registration. |
| Admin | A trusted workspace operator who manages review cycles, forms, team access, assignments, and submissions. | Admin permissions are enforced by the server for every protected operation. |
| Reviewer | A team member who reviews only the people assigned to that Membership and sees only their own review activity. | Reviewer views never expand access because of a client-supplied ID. |
| Review target | A person who is the subject of one or more reviews. | A target is separate from the reviewer who writes feedback. |
| Assignment | The active relationship that gives one reviewer permission to review one target. | Version one allows at most one active reviewer per target per organization. |
| Form | An organization-owned set of questions with a draft definition and zero or more immutable published versions. | Editing a draft never changes what an older submission means. |
| Form field | A typed question with a stable ID, label, required rule, and type-specific constraints. | Stored answers reference field IDs and must be checked against the exact published version. |
| Reviewer link | A revocable, expiring bearer secret that opens a reviewer-specific public submission portal. | It grants access only to the link's reviewer, assigned targets, and allowed published forms. |
| Invitation token | A one-time credential that allows a person to establish a Membership and its password. | Invitation tokens are not reviewer links or password-reset tokens. |
| Password-reset token | A separately issued, one-time credential that changes the password for exactly one Membership. | An admin gives it directly to the member; it is not emailed and cannot be reused. |
| Submission | One reviewer's answers for one target against one published Form version. | It is immutable evidence of the questions and answers at submission time; admin review state and archive state are lifecycle metadata. |
| Reviewed | An admin/reviewer workflow state indicating that a submitted response has been read. | It does not mean the target was reviewed by every assigned reviewer. |
| Archived | A reversible removal from active workflow lists while preserving history. | Archive does not erase a submission or user account. |
| Permanent deletion | An explicit, irreversible deletion permitted only when domain and foreign-key rules allow it. | Prefer archive; show impact and require confirmation. |
| Workspace goal | The configured count of people included in the current review cycle. | It is a progress denominator, not a count of existing assignments. |
| Completion | A derived state that a target has at least one non-archived submission from their assigned reviewer. | Completion percentages are calculated from active data and the configured goal. |
| Appearance theme | A workspace-level choice among safe, built-in brand and surface presets. | Arbitrary CSS, user-provided URLs, and remote font injection are excluded from version one. |
| Signature response | A typed name or pointer-drawn acknowledgement captured by the form. | It is not represented as a qualified/legal digital-signature service. |

## Core invariants

1. Every organization-owned record is scoped to one Organization in both queries and writes.
2. User, Membership, Organization, Review target, reviewer, Form, Form version, and Submission are distinct concepts.
3. The server is authoritative for roles, assignments, link validity, form publication, answer validation, and progress.
4. A revoked, expired, archived, or otherwise inactive credential fails closed.
5. History remains interpretable after edits because submissions point to immutable published versions.
6. Reviewer assignment is managed from Team access; People manages targets only. A target has at most one current reviewer, and both must be active in the same organization. New targets go to the least-loaded active reviewer; when a reviewer joins or becomes active, existing unassigned targets are balanced across active reviewers. Existing assignments are preserved until an administrator changes them.
7. Reassigning or unassigning changes current access, not historical submissions. Assignment retries are idempotent, and concurrent stale edits return a conflict.
8. A Membership is unique for a User within an Organization. An Assignment is unique for a target within an Organization and has database-enforced same-organization foreign keys to both its target and reviewer.
9. A permanent delete is available only after the relevant lifecycle checks: forms with submissions and members with submission history remain protected. Archive/restore keeps the evidence record and audit trail available.
