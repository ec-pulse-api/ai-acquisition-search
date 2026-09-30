# AI Acquisition Search — Claude Code Plugin

This repository can be loaded as a Claude Code plugin and exposes the AI acquisition engine through MCP.

## Included capabilities

- Product and market acquisition analysis
- Next-campaign decision and production brief
- Higgsfield video generation
- Gemini narration generation
- Social publishing and performance collection
- Campaign persistence

## Local validation

```bash
npm install
claude plugin validate .
```

For local plugin testing:

```bash
npm install
claude --plugin-dir .
```

The Higgsfield credentials must remain in environment variables:

- `HF_API_KEY_ID`
- `HF_API_KEY_SECRET`

They are never placed in plugin source or browser code.

## Community submission

Submit this plugin through the Claude Code community marketplace submission form after validation.
