# Proposed production architecture (not implemented in this ZIP)

GitHub Pages -> HTTPS server-side API (e.g., Cloudflare Workers / Vercel functions) -> PostgreSQL (e.g., Supabase or Neon). Background jobs send guest cards and tour requests with durable idempotency keys; a worker retries failed emails without repeating completed steps.

- Ingest scraper data into staging and upsert normalized `communities`, `floorplans`, `units` and `media` records. Keep stable identifiers. Never accept publicly submitted rent or community contact changes.
- Separate `public_listing_view` from `property_private_view`; public view has no original property URLs, precise coordinates, address, unapproved images or identifying text.
- Create a `lead` and `tour_request` inside a database transaction. Queue `guest_card_delivery` and `tour_request_delivery` using an idempotency key. Store sent/failed/provider-message IDs separately.
- Issue a short-lived, revocable `disclosure_grant` only after **verified** guest-card and tour-request delivery events. Require emailed proof-of-control or a signed account session for stronger protection. Retain audit events.
- Define provider adapters for verified slot lookup and booking: `lookup_slots` -> `hold` (if supported) -> `book` -> `confirm`. If no authorized adapter exists, show only a requested time and private official scheduler handoff.
- Keep highly sensitive notes/screens private with restrictive roles, separate encryption/access policies, short retention and manual review. Do not use protected-class status to determine housing suggestions. Screening risk labels and approval guarantees are prohibited as automated recommendations.
- For custom search, geocode desired area on the backend and rank matching listings by geographic distance, budget and explicit rental criteria. Human-review support-program matches and exceptions; do not promise acceptance.
- Restrict SMS marketing to independently logged opt-ins, respect STOP, use provider-approved registered sending and control send frequency.

**Migration trigger:** You already crossed it by introducing multiple client workflows and contingent disclosure. Begin now in parallel with the existing scraper. Do not turn the PostgreSQL migration and a new public website into one all-at-once deployment.
