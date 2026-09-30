---
name: acquisition-cycle
description: Analyze a product URL, decide the next revenue-oriented acquisition test, create an ad video with Higgsfield, and collect performance data. Use when the user asks what to publish next, wants an ad cycle, or wants to turn a product into a measurable acquisition experiment.
---

# AI Acquisition Cycle

Use the ai-acquisition-search MCP tools to run the acquisition workflow.

## Workflow

1. Start with `analyze-acquisition` for the product/service URL.
2. Use `optimize-next-campaign` when prior performance is available.
3. Use `higgsfield-create-video` to create the selected creative. Default short-form format is 9:16 and 1080p unless the user specifies otherwise.
4. Keep publishing in `draft` or `approval` mode unless the user explicitly authorizes autonomous publishing and the required platform credentials are connected.
5. Save the campaign with `campaign-save`.
6. After the post has accumulated data, use `collect-campaign-performance`.
7. Use the measured performance to decide the next test; do not invent missing metrics.

## Decision principle

Optimize for the next measurable acquisition action, not generic content generation. Preserve the hypothesis, creative angle, platform, and observed metrics so the next cycle can learn from the previous one.

## Safety

Never expose API keys or OAuth tokens. Never claim a post was published unless the publishing tool returned a successful result. Never fabricate sales, CTR, CVR, views, or other performance metrics.
