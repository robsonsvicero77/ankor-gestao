# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Assumption from the request and existing application: business owners or independent professionals manage their client records, finances, and commercial proposals under their own account.

## Product Purpose
AnkorGestão helps users organize clients, receivables, payables, financial history, commercial proposals, and service contracts.

## Positioning
No differentiated market position has been confirmed. Do not invent marketing claims or customer outcomes.

## Operating Context
The product is a web application with a React frontend, a FastAPI API, Supabase Auth, and PostgreSQL. Business data is scoped to the authenticated user's tenant. Users prepare proposals and contracts from structured, editable sections and download PDFs to send to their clients.

## Capabilities and Constraints
- Users can create and edit tenant-scoped individual (PF) and company (PJ) client records, including legal identity, contact, address, and notes for future reuse.
- Client registration requires a valid CPF or CNPJ; duplicate documents are prevented within the same tenant.
- Proposal forms do not yet select from the client register. Contracts select an existing client and snapshot that client's identity when the contract is created or its client is changed.
- The proposal workflow includes create, list, edit, status tracking, and PDF download.
- Confirmed proposal statuses: draft, sent, in negotiation, approved, rejected, expired, and cancelled.
- The supplied DOCX is the content and PDF-layout reference. Its sections include presentation, objectives, scope, deliverables, execution stages, investment, payment terms, timeline, client responsibilities, exclusions, approval criteria, and acceptance.
- Proposal records must be isolated by tenant and must not expose one tenant's data to another.
- Proposal approval must not create a receivable or ledger entry unless that behavior is explicitly requested later.
- The contract workflow includes create, list, edit, status tracking, editable payment schedules and clauses, and PDF download. It supports website/app development, visual identity, UX design, and custom services.
- Confirmed contract statuses: draft, sent, signed, in progress, completed, and cancelled. Signature status is manual; the system does not collect electronic signatures.
- Contract records and their client snapshots are tenant-scoped. Editing a contract preserves its original client snapshot unless the selected client changes.
- Contract payment installments must add up to the contract total. Saving or signing a contract does not create receivables or ledger entries.
- The user-supplied service contract is the editable clause and provider-details reference. Its example client, dates, and amounts are not defaults. Contract clauses and provider details remain editable and should be reviewed by the user before sending.
- Signature collection, email delivery, and automatic status transitions are not part of the confirmed request.

## Brand Commitments
The product name is AnkorGestão and should be displayed consistently. Proposal PDFs should follow the supplied proposal model. Contract PDFs should include the supplied logo and use blue `#0052CC`, consistent with the proposal PDF.

## Evidence on Hand
A user-supplied commercial proposal DOCX is available as reference for proposal fields, section order, payment options, and PDF structure. A user-supplied service contract DOCX is available as reference for party details, clauses, and payment terms. Do not reuse either document's client-specific examples as sample data.

## Product Principles
- Keep client identity and contact data private within its tenant and preserve structured fields for future reuse.
- Keep proposal data private within its tenant.
- Keep contract data private within its tenant and preserve client identity as a contract snapshot.
- Preserve the proposal's terms and content between editing and PDF export.
- Preserve contract clauses, service scope, provider details, client snapshot, and payment schedule between editing and PDF export.
- Keep proposal status explicit and understandable.
- Never invent client details, pricing, legal terms, or commercial promises.
