# AI Acquire

Run the AI acquisition workflow for a product or service.

## Input

Accept a public product/service URL and optional constraints such as:

- target market
- budget
- preferred social platforms
- brand rules
- desired number of tests

## Workflow

Use the `analyze-acquisition` tool first.

Then:

1. Summarize the product and evidence.
2. Identify customer and acquisition hypotheses.
3. Produce up to 3 next-post concepts.
4. If a Higgsfield tool is connected, turn the selected concept into a production brief and use the connected Higgsfield capability for video creation.
5. If narration is requested and Gemini TTS is configured, use `generate-narration`.
6. If authorized social publishing tools are connected, prepare and execute the requested publishing actions.
7. Record the resulting post identifiers and URLs.
8. If publishing tools are not connected, output platform-ready payloads and state that publishing is pending.
9. On later runs, use available performance data to choose the next test.

Never fabricate a completed generation, publication, or performance result.
