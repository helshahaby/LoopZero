# LoopZero — AgentCofounder Harness (Contracts Track)

**Team LoopZero** — Hossam Elshahaby · Paul Grönborg · Ali Sina · Mohamed Akif · Shivam Gupta
AgentCofounder Hackathon · Stockholm AI · Contracts Track

**Demo video:** https://youtu.be/UVS3UMYBTQc  
**Repository:** https://github.com/helshahaby/LoopZero

> One raw startup idea in. One tested, running, persistent web application out — with the
> harness, not the model, owning every claim about whether it works.

---

## 1. What this is

LoopZero is an **autonomous coding harness**. You hand it a single sentence describing a
product idea it has never seen. It:

1. turns the raw idea into a structured spec,
2. drives the **Pi** coding agent (running **Qwen3 on Berget AI**) to build a full web app
   on top of a pre-built toolkit,
3. **verifies the result deterministically** — unit tests, production build, dev-server
   startup, HTTP probe,
4. runs **one bounded repair pass** if any check fails, then re-verifies,
5. emits an auditable record: `trace.jsonl`, `summary.md`, and a schema-validated
   `result.json`.

The model is never trusted to report success. Every fact in the result file — tests passed,
build clean, server reachable, tokens consumed — is measured by the runner.

## 2. The problem we are solving

Two problems, stacked.

**For founders.** "I have a great idea but no one to build it with." Hiring is slow,
agencies are expensive, and the momentum dies before anything exists to test with users.

**For anyone pointing an agent at that idea.** A single prompt against a vague idea drifts:
half-finished features, no tests, no persistence, unmaintainable code — and no way to tell
whether it actually runs. A demo that only works on the author's laptop proves nothing.

LoopZero attacks the second problem so the first one becomes tractable.

## 3. How it works

```text
raw idea (one sentence, unseen)
  │
  ├─ Phase 1  understand + structure   → compact idea spec
  ├─ Phase 2  build                    → Pi coding agent on Qwen3 (Berget AI)
  │                                       writes app on top of app-template
  ├─ Phase 3  verify (runner-owned)    → vitest → production build → dev server
  │                                       on :3000 → HTTP probe → cleanup
  ├─ Phase 4  repair (bounded, ≤1)     → only failing checks + log tails as context
  │                                       → re-verify into verify-N/
  └─ Phase 5  report                   → trace.jsonl · summary.md · result.json
```

### Deterministic verification

`src/verify-app.ts` is the referee. It accepts a run only when:

- the vitest JSON report says `success`, `numTotalTests > 0`, all passed, **zero** failed,
  pending, todo or skipped tests — a suite of skipped tests is a failure, not a pass;
- the production build completes;
- the dev server binds port 3000, is owned by the spawned process tree, and answers an
  HTTP probe;
- the process tree is torn down cleanly afterwards (`port-owner.ts`, `process-tree.ts`).

### Bounded repair

`src/repair.ts` sends **one** focused follow-up call containing only the failing check names
and the tail of each failing log — not the whole transcript. Re-verification writes into a
fresh `verify-N/` artifact directory so the original evidence is never overwritten. The
repair loop is capped: it cannot spiral into a token sink.

### Runner-owned evidence

- `src/usage.ts` aggregates usage across **every** Pi event stream (build call + any repair
  calls) via `mergeUsageSummaries`. It never estimates.
- `src/trace.ts` appends one JSON object per phase to `trace.jsonl` — start, end, duration,
  outcome, tokens.
- `summary.md` is the human-readable roll-up, including the weighted efficiency figure.
- `src/result.ts` + `src/validate-result.ts` produce and validate `result.json` against the
  unmodified contract schema.

## 4. The token lever

The competition scores efficiency as:

```text
weighted cost = input_tokens + output_tokens × 3 + cache_read_tokens × 0.1
```

Output is charged **triple**. So the cheapest line of code is the one the model never
writes. Two consequences shaped the whole design:

**A. Ship the boilerplate in the template.** `app-template/src/lib/` contains
domain-neutral primitives the agent imports instead of authoring:

| Module | What it gives the generated app |
|---|---|
| `storage.ts` | Typed localStorage with versioning and corrupt-data recovery |
| `repository.ts` | CRUD repository over storage — create/read/update/delete/list |
| `validation.ts` | Field validators and form-level error shaping |
| `dates.ts` | ISO parsing, relative formatting, comparison helpers |
| `collection.ts` | Filter / sort / group / search over record sets |
| `state-machine.ts` | Declarative lifecycles (draft → active → done) |
| `id.ts` | Collision-resistant id generation |
| `useCollection.ts` | React hook binding a repository to component state |
| `src/ui/index.tsx` | Accessible component kit — form, table, dialog, toast, empty/loading/error states, app shell |
| `src/test/setup.ts`, `helpers.ts` | Vitest environment and render helpers |

All of it is **domain-neutral** — nothing assumes a particular product. 16 template tests
cover the primitives, so the generated app inherits a passing baseline.

**B. Design the prompt for cache reads.** `solution/system-prompt.md` puts the stable
role/method text first and the volatile idea last, so the invariant prefix is cache-eligible
at 0.1× weight. The `mvp-builder` skill is **inlined** into the prompt rather than loaded
from a file path, removing an entire read turn from every run.

The `mvp-builder` skill is written around **domain shapes** — workflow, planner, log,
comparison, checklist, register — not around CRUD examples, so an unseen idea maps onto a
known plan instead of being improvised.

## 5. Measured results

From the demo run (`OPTIMIZATION_REPORT.md`):

| Metric | Value |
|---|---|
| Model | `openai/Qwen/Qwen3.8-27B-FP8` on Berget AI |
| Total model calls | 19 |
| Total execution time | 796.3 s (~13.2 min) |
| Pass rate | 100% — **0 repair attempts required** |
| Total tokens | 491,343 |
| Input tokens | 468,472 (95.3%) |
| Output tokens | 22,871 (4.7%) |
| Weighted cost score | 537,085 |

Output tokens at 4.7% of total is the headline: the toolkit absorbed the boilerplate, so
the expensive channel stayed nearly empty.

**Demo idea (unseen):** *"I run a small pottery studio and I keep running out of glazes and
clay at the worst possible moment."*

**What came back:** a running studio-supplies app on `:3000` — add a supply, filter by type
(glaze / clay / tools), adjust quantities inline, edit, delete, and a "Running low" panel
driven by a threshold. Refresh the browser and every row is still there.

## 6. Hidden-idea robustness

`benchmark/ideas/` holds six synthetic ideas, one per domain shape, deliberately unlike the
public example so the harness cannot overfit:

| File | Shape |
|---|---|
| `01-workflow-repair-shop.txt` | Workflow / state machine |
| `02-planner-plant-care.txt` | Recurring planner |
| `03-log-freelance-hours.txt` | Time log with aggregation |
| `04-comparison-energy-bills.txt` | Comparison / trend |
| `05-checklist-rental-inspection.txt` | Checklist with completion state |
| `06-register-lending-library.txt` | Register with lending lifecycle |

Run any of them with `--idea-file`.

## 7. Repository layout

```text
src/                 harness — run-challenge, verify-app, repair, trace, usage,
                     result, validate-result, port-owner, process-tree, prepare-output
test/                47 harness tests (vitest)
app-template/        starter app + reusable toolkit + 16 template tests
solution/            system-prompt.md, skills/mvp-builder, extensions/protected-paths
benchmark/ideas/     six hidden-idea test cases
contract-public/     competition contract — UNMODIFIED
docs/                journeys and contract notes
Dockerfile           judging image
```

## 8. Running it

```bash
npm ci --ignore-scripts

# static gate: lint + typecheck + all tests
npm run check

# dry run — prepares the workspace, no model call, no credentials needed
npm run challenge -- --prepare-only

# real run (requires your Berget AI credentials exported in the shell)
npm run challenge -- --idea-file benchmark/ideas/01-workflow-repair-shop.txt
```

Credentials are read from the environment only. Nothing is written into the repository or
the distributed ZIP.

Artifacts land in `output/<timestamp>/`: the generated app, `verify-*/` logs,
`trace.jsonl`, `summary.md`, `result.json`.

## 9. Contract compliance

Deliberately **untouched**:

- `contract-public/**` and the `result.json` schema
- `src/result.ts`, `src/validate-result.ts`
- the semantics of `src/verify-app.ts` (ordering and pass conditions)
- `solution/extensions/protected-paths.ts` — protections are not weakened
- the pinned Pi agent version and both lockfiles

No new runtime dependencies were added. The runner — never the model — owns test, build,
startup, token and success facts.

## 10. Impact

- **For founders:** a real, testable artifact in minutes instead of a slide deck.
- **For engineering teams:** verification moves into the harness; agent output is accepted
  only when tests, build and startup all pass.
- **For the agent ecosystem:** an open, auditable contract — `trace.jsonl`, `summary.md` and
  `result.json` make every run replayable and comparable across harnesses.
- **For the Nordic AI stack:** runs entirely on Berget AI with Qwen — sovereign European
  compute, no US hyperscaler in the loop.

---

*Team LoopZero · AgentCofounder Hackathon · Contracts Track · Stockholm AI*
