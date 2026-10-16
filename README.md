# Ask Demo

A small full-stack example that answers questions about a fictional company policy using Gemini, with streamed responses and document references.

Built with React, TypeScript, Vite, Node.js and Express. All documents are synthetic. No employer code or proprietary data is included.

## Run locally

Prerequisites: Node.js 24 and npm.

Install backend dependencies from the repository root:

```bash
npm ci
```

Install frontend dependencies:

```bash
cd client
npm ci
cd ..
```

Copy `.env.example` to `.env` in the repository root and add your own Gemini API key:

```env
GEMINI_API_KEY=your_key_here
```

The key is used only by the backend.

Start the backend from the repository root:

```bash
npm run dev
```

In a second terminal, start the frontend:

```bash
cd client
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` requests to the backend at http://localhost:3001.

The live demo requires Gemini API access. Model availability and usage limits depend on the provider and account. The current model is `gemini-3.5-flash-lite`, configured in `server/app.ts`.

## Try it

Supported question:

> How many days per week can employees work remotely?

Expected: up to three days, with a reference to `[demo-001]`.

Question outside the document:

> How many paid vacation days do employees receive?

Expected: the assistant states that the provided documents do not contain the answer.

## How it works

1. The backend validates the question.
2. It sends the synthetic document and question to Gemini with instructions to answer only from that context.
3. Model output is forwarded as Server-Sent Events over a POST response.
4. The frontend decodes the stream and buffers incomplete events before processing them.
5. The backend returns metadata for known document IDs cited in the answer.

Events: `chunk`, `sources`, `done`, and `error`.

Failures before streaming return HTTP 502. Failures after streaming starts produce an error event. The frontend also detects a connection ending without a `done` event.

## Verification

From the repository root:

```bash
npm run typecheck
npm test
```

From `client`:

```bash
npm run build
```

Eleven automated tests run with `npm test`:

- Eight backend tests mock Gemini and verify input validation, SSE event ordering, cited-source metadata, and provider failures before and during streaming.
- Three frontend parser tests use synthetic byte streams to verify an event split across reads, a UTF-8 character split across byte chunks, and a connection closing before the `done` event. They also check reader-lock release and delivery of partial text before an incomplete-stream error.

The parser tests exercise `readAnswerStream`, the same function used by the React component. They run in Node, without mounting React or making network requests.

These tests do not verify Gemini availability, factual accuracy, semantic support for citations, browser rendering, or real network/proxy behavior.

## AI assistance

I used ChatGPT to help structure the implementation, documentation, suggest code and tests, explain unfamiliar APIs, and troubleshoot issues.

I reviewed and integrated the suggestions, corrected implementation errors, and validated the application through TypeScript checks, eight automated backend tests, a frontend production build, and manual testing of live streaming and document-based answers.

One AI-suggested model choice returned a 404 because it was unavailable to new accounts. I checked the backend error, updated the model to the replacement identified by the provider, and verified a successful streamed response with source metadata.

For the parser follow-up, I checked that the Unicode test splits the encoded UTF-8 bytes inside the emoji, rather than splitting the JavaScript string before encoding.

## Scope and limitations

- The full synthetic document is supplied as context; there is no retrieval index or vector database.
- Prompt instructions reduce unsupported answers but do not guarantee factual accuracy.
- Source metadata confirms that a cited ID exists, not that every claim is supported.
- The SSE parser handles the event format emitted by this backend; it is not a general-purpose SSE implementation.
- This is a local demonstration without authentication, rate limiting, automatic retries, or cancellation of upstream generation when a client disconnects.
- The frontend production build is checked, but production hosting and API routing are not configured.