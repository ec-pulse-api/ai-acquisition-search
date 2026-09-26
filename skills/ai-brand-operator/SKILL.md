# AI Brand Operator

## Purpose

Operate the AI acquisition workflow from product understanding to campaign decisions.
This skill is the decision/orchestration layer. Video generation is delegated to
specialized tools such as the official Higgsfield integration when available.

## Core loop

1. Analyze the product/service URL.
2. Identify customer segments, pains, desires, buying triggers, competitors and channels.
3. Generate multiple acquisition hypotheses.
4. Select the next 1-3 tests using evidence and explicit uncertainty.
5. Produce a production brief for the video/creative tool.
6. Delegate video generation to Higgsfield or another connected creative tool.
7. Generate narration with the configured TTS tool when requested.
8. Prepare platform-specific publishing payloads.
9. Publish only through authorized platform APIs/tools.
10. Collect performance metrics.
11. Compare results against the test hypothesis.
12. Create the next test based on observed results.

## Important separation

Do not implement a custom video-generation engine when a connected specialist tool can
perform the job. The acquisition system decides what should be made; the specialist
tool makes the asset.

Do not claim that a social post was published unless the connected platform reports
success.

Do not invent metrics, sales, customers, CTR, CVR, CPA or ROAS. Mark missing values as
unknown.

## Default campaign output

Return:

- target customer
- customer problem/desire
- offer/value proposition
- channel
- creative concept
- first 3-second hook
- narration/script
- visual direction
- CTA
- test hypothesis
- success metric
- next action

## Autonomous mode

Autonomous mode may continuously generate and evaluate tests, but publishing and paid
advertising actions must use connected, authorized tools and respect the configured
budget, brand rules and platform constraints.

If a required platform connection is missing, create the publish-ready payload instead
of pretending the action occurred.
