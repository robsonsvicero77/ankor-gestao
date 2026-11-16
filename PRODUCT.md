# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Users
Assumption from the request and existing application: business owners or independent professionals manage their client records, finances, and commercial proposals under their own account.

## Product Purpose
Ankor Gestão helps users organize clients, receivables, payables, and financial history. The proposals capability extends that workflow so users can create, store, edit, track, and deliver commercial proposals.

## Positioning
No differentiated market position has been confirmed. Do not invent marketing claims or customer outcomes.

## Operating Context
The product is a web application with a React frontend, a FastAPI API, Supabase Auth, and PostgreSQL. Business data is scoped to the authenticated user's tenant. Users prepare proposals from structured sections and download a PDF to send to their clients.

## Capabilities and Constraints
- Users can create and edit tenant-scoped individual (PF) and company (PJ) client records, including legal identity, contact, address, and notes for future reuse.
- Client registration requires a valid CPF or CNPJ; duplicate documents are prevented within the same tenant.
- Client records are not yet integrated with proposal forms.
- The proposal workflow includes create, list, edit, status tracking, and PDF download.
- Confirmed proposal statuses: draft, sent, in negotiation, approved, rejected, expired, and cancelled.
- The supplied DOCX is the content and PDF-layout reference. Its sections include presentation, objectives, scope, deliverables, execution stages, investment, payment terms, timeline, client responsibilities, exclusions, approval criteria, and acceptance.
- Proposal records must be isolated by tenant and must not expose one tenant's data to another.
- Proposal approval must not create a receivable or ledger entry unless that behavior is explicitly requested later.
- Signature collection, email delivery, and automatic status transitions are not part of the confirmed request.

## Brand Commitments
The proposal PDF should follow the supplied proposal model. The user refers to the product as Ankor Gestão; the existing navigation also displays FinPredict, so that naming inconsistency must not be silently expanded or changed as part of this feature.

## Evidence on Hand
A user-supplied commercial proposal DOCX is available as reference for the fields, section order, payment options, and PDF structure. Do not reuse its client-specific content as sample data.

## Product Principles
- Keep client identity and contact data private within its tenant and preserve structured fields for future reuse.
- Keep proposal data private within its tenant.
- Preserve the proposal's terms and content between editing and PDF export.
- Keep proposal status explicit and understandable.
- Never invent client details, pricing, legal terms, or commercial promises.
