# Abundant CU Web Platform

Launch-ready site for Abundant CU, built with Next.js + Tailwind and a reused Champaign zoning map module.

## Implemented Launch Scope

- `/` home page with:
  - Swiss minimalist style tokens
  - home map preview widget
  - mission pillars
  - sticky primary CTA for email signup
- `/zoning` full interactive zoning + permits map (reused from previous app)
- `/writings` publication card list (seed data + Sanity-ready loader)
- `/action` with CUrbanism first, Sway second, then resources
- global navbar/footer with repeated signup form
- lightweight lead capture API (`/api/lead`) with:
  - honeypot spam check
  - simple in-memory rate limiting
  - Google Sheets webhook submission
  - optional owner notification webhook

## Development

```bash
npm run dev
```

## Environment Setup

Copy `.env.example` to `.env.local` and set values:

- `GOOGLE_SHEETS_WEBHOOK_URL` is required for form submission storage.
- `OWNER_EMAIL_WEBHOOK_URL` is optional.
- `SANITY_*` values are optional. If unset, writings use local seed data.

## Notes

- The original map app is preserved separately and reused here.
- This launch intentionally keeps analytics and lead infrastructure light.
