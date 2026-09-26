# AI Acquisition Search

AI-powered acquisition intelligence workspace for discovering, researching, and comparing potential acquisition targets.

## Current capabilities

- Acquisition target search UI
- Shared acquisition target data model
- Search API at `/api/targets`
- Target thesis pages at `/targets/[id]`
- Import payload validation at `POST /api/targets/import`

## Data status

The included target universe is **sample data**. It is intentionally not presented as verified live acquisition listings.

The import layer is designed so external datasets can be normalized into the same target model before persistence is added.

## Development

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Product direction

The intended workflow is:

1. Discover acquisition candidates
2. Normalize source data
3. Search and filter the target universe
4. Generate an acquisition thesis
5. Validate revenue, growth, ownership, and other due-diligence signals
6. Save and compare targets
7. Build a focused deal pipeline

Live source connectors, persistent storage, authentication, and AI-generated research are intentionally not claimed until they are actually connected.
