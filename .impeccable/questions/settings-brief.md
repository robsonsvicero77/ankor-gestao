# Configurações

Scope and mode: Protected account settings page, Operate.

Audience and task: Business owners update account identity, provider details reused in contracts, financial preferences, security, avatar, and opening balance. Users can opt into reminders to linked clients and due-date alerts.

Constraints: Currency remains BRL. The opening balance is editable only before any other ledger entry. Provider data is tenant-scoped; account changes persist.

## Direction contract

THESIS: Keep every account setting reachable without losing the active form or the user's financial context.

OWN-WORLD: Continue the Elegant Burgundy design system: light neutral canvas, white surfaces, burgundy actions, semantic feedback colors, and Lucide controls.

STORY: The user chooses a settings area, edits only its fields, sees whether changes are saved, and can correct mistakes before they affect documents or the ledger.

FIRST VIEWPORT: A section rail sits left of the active form; an identity summary and primary save action sit right. Below 1024px, the summary moves above the form and the rail becomes a compact horizontal selector. Selecting a section updates the form in place; an unsaved-state marker follows edits.

FORM: “Bancada de configurações,” fourth grounded composition, selected as the clearest option; seed 34db502a. Section switching uses a brief reduced-motion-aware opacity transition, with no animated content hidden by default.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
