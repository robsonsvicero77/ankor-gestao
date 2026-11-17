# Proposals surface

## Scope and visitor mode
The `/proposals` register and its create/edit flow. Operate.

## Audience, task, and constraints
The account holder creates and follows commercial proposals for clients, edits them over time, and downloads a PDF based on the supplied DOCX. Preserve the existing application shell and tenant-scoped data model. Confirmed statuses: draft, sent, in negotiation, approved, rejected, expired, and cancelled.

## Content and proof
Use the supplied proposal's sections: presentation, objectives, scope, deliverables, execution stages, investment, payment terms, estimated timeline, client responsibilities, exclusions, approval criteria, and acceptance. Do not invent commercial terms or client data.

## Direction contract
THESIS: Make each proposal a traceable business record, not a disposable document.
OWN-WORLD: Inherit the existing zinc-and-emerald application UI, typography, and components; the exported PDF is a clean, printable document following the supplied model.
STORY: Scan client, value, validity, and status; open a proposal to edit its sections or download its current PDF.
FIRST VIEWPORT: Place the page title and primary create action above compact status totals, then search/status filters and a readable proposal register; edit in a focused page with grouped document sections.
FORM: Searchable register plus section-based editor, extending the established app patterns. Preserve the user-pinned model and current visual world.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisions
Proposals can include an optional payment schedule for reference; when present, its installments must sum to the investment total. Proposals never create receivables or other financial entries, even when approved. Only signed contracts create receivables. Company logo and sender details are not part of the confirmed request.
