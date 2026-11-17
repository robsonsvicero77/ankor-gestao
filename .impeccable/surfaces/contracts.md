# Contracts surface

## Scope and visitor mode
The `/contracts` register and its create/edit flow. Operate.

## Audience, task, and constraints
The account holder creates, edits, tracks, and exports service contracts for website/app development, visual identity, UX design, and custom services. Contracts use existing tenant-scoped client records. Preserve the current zinc-and-emerald application shell and the established separate register/editor pattern.

## Content and data
Use the supplied service contract as the editable reference for party details, clauses, payment terms, and the São Paulo venue. Do not reuse its example client, dates, or installment amounts. Use provider details from the model as editable defaults. Snapshot client identity when a contract is created; preserve that snapshot during edits unless the selected client changes. Installment totals must match the contract value.

## Direction contract
THESIS: Make each contract a traceable service record whose commercial commitment and delivery terms stay together.
OWN-WORLD: Inherit the zinc-and-emerald app UI, typography, and components; keep the PDF clean, printable, and consistent with the existing proposal PDF.
STORY: Find the client and service, see the total and next scheduled installment, then open a contract to edit its scope, terms, and payment schedule or download its current PDF.
FIRST VIEWPORT: Put the page title and create action above compact status totals, search/status filters, and a readable register with client, service, total, next scheduled payment, and status.
FORM: Keep a separate editor organized around contract identity and client, services and scope, a prominent editable payment ledger, editable clauses, and provider details. On narrow screens, stack sections and use a compact schedule layout.
FINISH: Verify client selection/snapshot behavior, payment arithmetic, statuses, PDF content, loading/error/empty states, keyboard access, and mobile layouts.
