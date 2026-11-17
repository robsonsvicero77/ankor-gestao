# Clients surface

## Scope and visitor mode
The `/clients` register and its create/edit flow. Operate.

## Audience, task, and constraints
The account holder keeps reusable records for individual people (PF) and companies (PJ). Create, search, and edit records without duplicating an existing document. Require a valid CPF/CNPJ. Keep the existing application shell and tenant-scoped data model. This surface does not yet connect clients to proposals.

## Content and data
Store legal/display name, optional trade name, CPF/CNPJ, email, phone, company contact, structured Brazilian address, and notes. Do not invent client details. Keep empty optional fields empty rather than fabricating data.

## Direction contract
THESIS: Treat a client record as a reusable business identity, not a one-off text field.
OWN-WORLD: Inherit the Elegant Burgundy application UI, typography, and components.
STORY: Search the register, identify an individual or company, open its record, then save an accurate set of reusable details.
FIRST VIEWPORT: Put the page title and create action above a compact count, search/type filters, and a readable client register; use a focused form grouped by identity, contact, address, and notes.
FORM: Searchable register plus separate create/edit form, following the established proposals workflow.
FINISH: Verify PF/PJ validation, duplicate handling, tenant isolation, loading/error/empty states, and mobile layouts.
