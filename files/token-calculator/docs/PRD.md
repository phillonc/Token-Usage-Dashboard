# Token Calculator: Product Requirements

Version 0.2, 17 November 2026. Draft for review. Companion: [Technical Requirements](TRD.md).

Token Calculator measures the tokens and cost needed to complete a defined task on any provider and model, either as a single request or through a selected agent framework, and stores the results as comparable baselines. From release 3 it also forecasts tokens and cost for features that are not yet built.

## Problem

The token cost of building a feature cannot be measured today in a way that compares models or agent frameworks.

- **P1 Usage is reported in different shapes.** Each provider counts cached, reasoning and tool tokens differently, so raw totals from two vendors are not comparable.
- **P2 Framework overhead is hidden.** Agent frameworks add system prompts, tool definitions, re-sent history and retries. Nothing separates that overhead from the cost of the model.
- **P3 One run is not representative.** The same task produces a different token count on each run, so a single measurement cannot be trusted.

## Goals and non-goals

Release 1 delivers measured baselines. Releases 2 to 4 add controlled execution, estimation and calibration, in that order, because each depends on data from the one before.

**Goals**

- **G1** Measure tokens and cost for a task on any provider and any model, including local models.
- **G2** Run a task in one of two modes: a single request, or a selected agent framework.
- **G3** Normalise usage into one set of token buckets so results compare across vendors.
- **G4** Store repeated runs of one configuration as a baseline with a median and a spread.
- **G5** Compare baselines side by side on tokens, cost and cost per passing run.
- **G6** Show where an agent framework spends tokens, so framework overhead is separated from model cost.
- **G7** Make runs repeatable through versioned execution profiles, context policies and bounded repair.
- **G8** Forecast tokens and cost for a feature from its requirements, repository evidence and past runs.
- **G9** Report the uncertainty of every forecast and check forecasts against actual outcomes.

**Non-goals**

- **N1** Withdrawn. Estimation is in scope from release 3 (D8).
- **N2** Judging output quality beyond pass or fail of the acceptance check.
- **N3** Multi-user access, authentication or hosted deployment.
- **N4** Budget enforcement that reserves budget before a request is sent, and live spend alerts.
- **N5** Building or modifying agent frameworks.
- **N6** A guarantee that a feature completes within a forecast budget.

## Definitions

These terms are used with one meaning in both the PRD and the TRD.

| Term | Meaning |
| --- | --- |
| Task | The unit of work measured: a prompt, or a feature contract plus a repo at a pinned commit. It carries limits. |
| Run mode | How a task is executed. **Single request** sends one API call. **Agent framework** runs a selected framework until it stops. |
| Configuration | One combination of run mode, framework and its version (agent mode only), provider, model and parameters. |
| Run | One execution of one task under one configuration. |
| Baseline | The repeated runs of one task under one configuration, with summary statistics. |
| Token bucket | One of six non-overlapping token categories: uncached input, cache read, cache write, visible output, reasoning, tool input. |
| Acceptance check | A command or a manual attestation that decides one acceptance criterion. A command passes when it exits 0. |
| Cost per passing run | Total cost of all runs in a baseline, failed ones included, divided by the number that passed. |
| Feature contract | A versioned record of a feature's requirements: PRD and TRD references, scope exclusions, technical contracts, acceptance criteria and open decisions. |
| Execution profile | A configuration extended with workflow stages, tools, context policy, budgets, retry limits and stopping rules. |
| Stage | One step of a workflow: discovery, planning, implementation, validation, repair or review. |
| Repair cycle | A validation failure, the repair attempt that follows it, and the next validation result. |
| Work package | A bounded piece of a feature with its dependencies and validation needs. |
| Preliminary estimate | A forecast made from documents alone, before the repo is inspected. |
| Planning estimate | A forecast made after bounded discovery and a readiness check. |
| Evidence level | How well a forecast is supported: `provisional`, `historical` or `calibrated`. |
| Estimation overhead | Tokens and cost spent producing or refining an estimate. |

Baseline always means measured runs. A forecast is always called an estimate (D9).

## Relationship to usage-collector

Token Calculator is a separate tool that sits beside `files/usage-collector`. The two answer different questions.

| | usage-collector | Token Calculator |
| --- | --- | --- |
| Question | What did I spend, and was it worth it? | What does this task cost on this model and framework? |
| Unit | Session, model and day | Task, configuration and run, with one row per API call where the framework reports it |
| Token detail | Input, output, cache read and cache write. Reasoning is folded into output. | Six buckets, with reasoning and tool input kept separate |
| Source of data | Everyday usage, picked up by watchers and ingest | Controlled runs that it starts itself |
| Judgement | Human review fields | Pass or fail from an acceptance check |

Token Calculator sends nothing to the collector (FR-27). Agent runs that it starts are still real usage, so the collector's own watchers record them as usual. From release 2, an ingestion API accepts runs started outside the tool (FR-44). It does not replace the collector, and the two stores stay separate.

## Functional requirements

P0 and P1 belong to release 1. P0 is required and P1 can follow. Requirements for later releases carry their release number.

**Providers and models**

- **FR-1 (P0)** A provider is added through configuration only: an ID, an API style, a base URL and the name of the environment variable that holds its key.
- **FR-2 (P0)** Four API styles are supported: `anthropic-messages`, `openai-responses`, `openai-chat` and `gemini-generate-content`.
- **FR-3 (P0)** Any model ID is accepted as free text. No model list is hard-coded.
- **FR-4 (P0)** Local model servers work through the `openai-chat` style with no API key.
- **FR-5 (P0)** Model parameters are set per configuration and passed to the provider, including reasoning or thinking settings.

**Run modes**

- **FR-6 (P0)** Single request mode sends one API call built from a system prompt, a user prompt and optional context files, and records its usage.
- **FR-7 (P0)** Agent framework mode runs a selected framework headlessly on a task in an isolated copy of the repo, and records the usage of the API calls it makes.
- **FR-8 (P0)** Claude Code, Codex CLI, Gemini CLI and Pi are selectable in release 1. Only frameworks installed on the machine are offered, each with its detected version.
- **FR-9 (P0)** A framework is added by writing one adapter module. The runner, storage and reports do not change.
- **FR-10 (P0)** Every run records the framework version, model ID and parameters used.

**Tasks and limits**

- **FR-11 (P0)** A task is defined once and reused across configurations. It holds the prompt or feature contract, the repo and commit for agent mode, and limits.
- **FR-12 (P0)** Each run has a maximum cost, a maximum number of tokens, a maximum duration and a maximum number of API calls. A run that reaches a limit is stopped and recorded with the limit as the reason.
- **FR-13 (P0)** A run ends as `passed`, `failed`, `unchecked` or `cancelled`. Acceptance criteria decide (FR-34). `unchecked` means the task has no criteria, and `cancelled` means the user stopped the run.

**Measurement**

- **FR-14 (P0)** The usage of every API call is normalised into the six token buckets.
- **FR-15 (P0)** The provider's raw usage payload is stored with each call.
- **FR-16 (P0)** A bucket the provider does not report is stored as not reported, never as zero.
- **FR-17 (P0)** Cost is calculated from a versioned price table with a rate per bucket per model. A model with no price shows its tokens and the label `unpriced`.
- **FR-18 (P0)** Agent runs report the framework overhead metrics W1 to W6 below, where the framework exposes the data.

| Code | Metric | What it shows |
| --- | --- | --- |
| W1 | Fixed overhead | Input tokens of the first call: the system prompt plus tool definitions |
| W2 | History growth | How input tokens per call rise as the conversation is re-sent |
| W3 | Cache hit rate | Share of input tokens read from cache |
| W4 | Tool output size | How much tool output enters the context |
| W5 | Subagent share | Share of tokens spent by subagents |
| W6 | Calls per passing run | API calls needed for each run that passes |

**Baselines**

- **FR-19 (P0)** A matrix run executes one task under several configurations, with a set number of runs each. The default is 3. Before it starts, the matrix shows its maximum spend, which is the sum of the run cost limits.
- **FR-20 (P0)** Each baseline reports the median, minimum and maximum per bucket and for cost, the spread, the pass rate and the cost per passing run.
- **FR-21 (P0)** A configuration is identified by a hash of its run mode, framework and version, provider, model and parameters. Any change creates a new baseline, and a completed baseline cannot be edited.

**Reporting**

- **FR-22 (P0)** Two or more baselines of the same task are compared side by side on buckets, cost, run duration, pass rate, cost per passing run and W1 to W6. Each figure shows the number of runs behind it. Pairs whose cost ranges overlap are flagged, and so are differences in conditions that weaken the comparison.
- **FR-23 (P1)** A run can be opened to show each API call in order with its buckets.
- **FR-24 (P1)** Baselines and runs export as CSV and JSON.

**Interface**

- **FR-25 (P0)** A local web UI defines tasks, selects the run mode, framework, provider and model, starts a matrix, shows progress and compares baselines.
- **FR-26 (P1)** A CLI command starts the same matrix from a file.

**Coexistence**

- **FR-27 (P0)** Token Calculator keeps its own store and sends nothing to usage-collector. Run workspaces are named with the prefix `tokcalc-`, so the collector's project field identifies benchmark usage.

**Measurement integrity**

- **FR-28 (P0)** A usage event with an ID that was already stored is ignored, so duplicates never change totals.
- **FR-29 (P0)** Every usage row records the normaliser version and a completeness status of `complete`, `partial` or `unknown`. A run shows the lowest status among its rows.
- **FR-30 (P0)** Where a source reports cumulative snapshots, the latest snapshot replaces earlier ones. A corrected event is stored as a new revision, and earlier revisions are kept.
- **FR-31 (P1)** Where a source reports no usage, tokens can be counted with a local tokenizer. Those rows are labelled `estimated` and record the tokenizer and its version.
- **FR-32 (P0)** A failed request that reports usage is stored and counted.

**Feature contract and acceptance**

- **FR-33 (P0)** A feature contract is versioned and immutable. It holds PRD and TRD references with content digests, scope exclusions, technical contracts, acceptance criteria and open decisions. Every run and estimate references one contract version.
- **FR-34 (P0)** Each acceptance criterion has a stable key, a mandatory flag and the evidence it requires. A run records `pass`, `fail`, `blocked` or `not_run` for each criterion. The run passes only when every mandatory criterion passes with its evidence. A manual attestation is labelled as manual.

**Pricing and reporting**

- **FR-35 (P0)** Each price row records its source and the date it was read. Each cost calculation is stored with the usage revision, price rows and calculation version it used, and repricing adds a new calculation.
- **FR-36 (P1)** Charges that are not per token, such as tool fees, are recorded per call and included in cost.
- **FR-37 (P0)** Reports label every value as measured, derived or predicted. Cost is shown separately for cold-start and warm-start runs.

**Controlled execution (release 2)**

- **FR-38 (Rel 2)** An execution profile extends a configuration with workflow stages, tools, context policy, budgets, retry limits and stopping rules. Profiles are versioned and immutable, and the configuration hash covers all of these fields.
- **FR-39 (Rel 2)** A profile can allow runtime adaptations. Each one is recorded as an event with its trigger and the change it made.
- **FR-40 (Rel 2)** Usage is attributed to a stage. Stage totals add up to the run total, and usage with no stage is shown as unattributed.
- **FR-41 (Rel 2)** Repair cycles are recorded and limited by the profile. A run that reaches the limit or meets an escalation condition ends as `escalated`. Comparisons show repair cycles per run.
- **FR-42 (Rel 2)** A request can record a context manifest: references to instructions, retrieved files, tool results and history, token sizes where available, the assembly policy version, truncation and summarisation events, and cache observations. Where a framework does not expose this, the manifest is marked unavailable.
- **FR-43 (Rel 2)** A context policy sets stage token allowances, retrieval rules, history retention, summarisation, maximum tool output size and prefix order. Summarisation calls are counted as usage.
- **FR-44 (Rel 2)** An ingestion API accepts runs started outside the tool. A run is registered, events arrive in batches in any order, and completing the run reconciles events that are missing.
- **FR-45 (Rel 2)** Usage events carry a parent ID, so nested calls and child agents form a tree.
- **FR-46 (Rel 2)** A TypeScript SDK registers a run, sends events and completes the run.

**Estimation (release 3)**

- **FR-47 (Rel 3)** A readiness assessment checks a feature contract against a versioned ruleset and returns `ready`, `ready_with_scenarios` or `not_ready` with its findings.
- **FR-48 (Rel 3)** A preliminary estimate is produced from documents and repository metadata. It gives a task breakdown, assumptions, an evidence level and usage and cost ranges, and it states what is missing.
- **FR-49 (Rel 3)** A discovery job inspects the repo read-only within its own limits. It reports progress, can be cancelled, and reports its own usage and cost separately.
- **FR-50 (Rel 3)** A planning estimate needs a readiness result of `ready` or `ready_with_scenarios`. It references discovery evidence, task dependencies, the execution profile and unresolved scenarios, and it is bound to a fingerprint of its inputs.
- **FR-51 (Rel 3)** Estimates are built from work packages. Each covers initial implementation, validation, repair, escalation and rework caused by dependencies. Shared work is counted once, and percentiles of separate categories are never added to make a total.
- **FR-52 (Rel 3)** Forecasts separate expected consumption before a run stops from the probability of acceptance within a budget. A budget for a target probability is shown only when the workflow can reach it. Otherwise the report says `target not supported`. Every forecast shows its evidence level, and values the evidence cannot support are left out.
- **FR-53 (Rel 3)** Estimation overhead is reported separately from implementation cost.

**Forecast upkeep (release 4)**

- **FR-54 (Rel 4)** Changes to requirements, the repo snapshot, the execution profile or observed task complexity are detected and classified as `informational`, `review_required` or `forecast_invalidating`.
- **FR-55 (Rel 4)** A revised forecast combines measured usage to date with predicted remaining usage. It is stored as a new version with its reason, and the original forecast is never overwritten.
- **FR-56 (Rel 4)** A calibration report evaluates forecasts on held-out features. It shows the validation period, sample size, error, interval coverage and interval width. An estimator version is promoted only when it beats the current one on that evidence.

## Non-functional requirements

Every non-functional requirement is measurable and has at least one TDD scenario in the TRD.

- **NFR-1 Accuracy.** On every call where the provider reports a total, the six buckets sum to it. A mismatch is flagged on the call, and the reported values are stored unchanged.
- **NFR-2 Deterministic cost.** Cost uses integer arithmetic only. The same rows and prices always give the same cost, in any order.
- **NFR-3 Secret handling.** API key values never appear in the database, logs, exports, API responses or error messages.
- **NFR-4 Local only.** The server and every capture listener bind to 127.0.0.1 and accept no other connections.
- **NFR-5 Content privacy.** Prompt and response text is not stored unless the task turns storage on. Token counts and metadata are always stored.
- **NFR-6 Crash safety.** If the process dies during a matrix, completed runs are intact, the interrupted run is marked `error`, no framework process is left running, and the matrix can resume.
- **NFR-7 Run isolation.** Every run starts from the pinned commit in a new workspace with a new session. A run cannot change the source repo or another run's workspace.
- **NFR-8 Performance.** Comparing 4 baselines over a store of 100,000 usage rows responds in under 500 ms at the 95th percentile. Storing 10,000 usage rows takes under 2 seconds.
- **NFR-9 Extensibility.** Adding a provider that uses a supported API style changes no code. Adding a framework changes files only under the adapters directory.
- **NFR-10 Reproducibility.** Every run stores the task hash, configuration hash, framework version, model ID and parameters. Normalising the stored raw usage again gives the same buckets. Price rows are only added, never edited, so a past cost can be recalculated.
- **NFR-11 Drift visibility.** Capture lines that cannot be parsed are counted and shown per run. A run that yields no usage rows is marked `error`.
- **NFR-12 Portability.** The tool runs on macOS on Apple Silicon and on Linux x64, on the current Node.js LTS release.
- **NFR-13 Reasoning content.** Reasoning content is never stored, and it is not requested where the provider makes it optional. Only its token count is kept.
- **NFR-14 Redaction.** When content storage is on, secrets are redacted before text is stored.
- **NFR-15 Untrusted repositories.** Repository files are treated as untrusted input. Discovery reads files only, never executes repository code, and reaches the network only for the model provider.
- **NFR-16 Telemetry isolation.** A telemetry or ingestion failure never fails the host run. The SDK queue is bounded, sends are retried with backoff, and dropped events are counted and reported.
- **NFR-17 Self-monitoring.** The tool shows its own dropped events, unparsed lines, normalisation mismatches, missing prices, failed discovery jobs and invalidated estimates.
- **NFR-18 Ingestion performance.** The ingestion API acknowledges a batch in under 500 ms at the 95th percentile at 50 events per second.
- **NFR-19 Background jobs.** Discovery and estimation run as background jobs. The API stays responsive while they run, and each job can be cancelled.

## Acceptance criteria

Release 1 is accepted when AC-1 to AC-6 hold. AC-7 to AC-9 gate releases 2 to 4. AC-2 to AC-9 need real providers or real measured data, so they are run by hand outside CI.

- **AC-1** Every FR and NFR has at least one TDD scenario in the [TRD](TRD.md#15-tdd-scenarios), and every scenario for the release being shipped passes in CI.
- **AC-2** One prompt run through Anthropic, OpenAI, Gemini and one local OpenAI-compatible server gives four runs, and no call fails the bucket sum check.
- **AC-3** Each release 1 framework completes the reference task headlessly, and the stored totals are within 1% of the framework's own reported session total.
- **AC-4** A matrix of 4 configurations with 3 runs each completes on the reference task with no manual step after start.
- **AC-5** For runs billed to an API key, calculated cost is within 5% of the provider's billed amount for the same calls.
- **AC-6** During AC-4, usage-collector receives no request from Token Calculator.
- **AC-7** Release 2. A staged run through one framework reports stage totals that equal the run total. The same run sent through the SDK matches the directly measured figures within 1%.
- **AC-8** Release 3. For 5 measured features, a planning estimate is produced with its fingerprint, assumptions and evidence level, and discovery cost is reported separately.
- **AC-9** Release 4. A calibration report on held-out features states interval coverage and width, and no forecast is labelled `calibrated` without one.

## Success metrics

- **M1** A comparison of two frameworks on one task, with 3 runs each, is produced from one form submission or one command.
- **M2** Adding a provider that uses a supported API style takes under 5 minutes.
- **M3** The bucket sum check passes on 100% of calls that report a total.
- **M4** Unparsed capture lines stay at zero for pinned framework versions.
- **M5** Forecast error is tracked by feature category, configuration and stage.
- **M6** Interval coverage is reported with interval width. Narrow intervals do not count as success unless coverage is adequate.
- **M7** The number and cause of forecast revisions are tracked.

Accuracy targets for M5 to M7 are set from the first measured features.

## Features adopted from the v1.1 draft

On 17 November 2026 the "Feature Token and Cost Calculator" PRD and TRD version 1.1 was reviewed against this document. It held 19 features that were missing or only partly covered. Seventeen are now requirements and two were dropped.

| Code | Feature | Where it is now |
| --- | --- | --- |
| F1 | Readiness assessment | FR-47 |
| F2 | Estimation: preliminary estimates, discovery, planning estimates, simulation | FR-48 to FR-52 |
| F3 | Forecast upkeep: change detection, revisions, calibration | FR-54 to FR-56 |
| F4 | Budget enforcement by reservation | Dropped (D8) |
| F5 | Ingestion API and SDK for external runs | FR-44 to FR-46 |
| F6 | Context manifests and context policies | FR-42, FR-43 |
| F7 | Workflow stages and repair cycles | FR-40, FR-41 |
| F8 | Multi-project access control | Dropped (D8) |
| F9 | Feature contract | FR-33 |
| F10 | Acceptance evidence per criterion | FR-34 |
| F11 | Execution profile | FR-38, FR-39 |
| F12 | Usage record integrity | FR-28 to FR-31 |
| F13 | Failed requests that report usage | FR-32 |
| F14 | Comparison detail | FR-22, FR-41 |
| F15 | Token limit and run states | FR-12, FR-13, FR-41 |
| F16 | Pricing detail | FR-35, FR-36 |
| F17 | Report labels | FR-37, FR-53 |
| F18 | Security rules | NFR-13 to NFR-15 |
| F19 | Operations | NFR-16 to NFR-19 |

## Open decisions

D1 and D8 are decided. The others are defaults that this draft follows, and changing one changes the requirements named beside it.

| Code | Decision | Default in this draft | Affects |
| --- | --- | --- | --- |
| D1 | Estimate unbuilt features | Yes, from release 3. Decided 17 November 2026. | FR-47 to FR-56 |
| D2 | Interface | Web UI in release 1, CLI after | FR-25, FR-26 |
| D3 | Relationship to usage-collector | Separate package and store in this repo, with no ingest into the collector | FR-27 |
| D4 | Order in which framework adapters are built | Claude Code, Pi, Codex CLI, Gemini CLI | FR-8 |
| D5 | Runs per baseline | 3 | FR-19 |
| D6 | Cost basis for runs made on a subscription plan | API list price, so plans and API keys compare on one scale | FR-17 |
| D7 | Currency | US dollars, because providers publish prices in dollars | FR-17 |
| D8 | Scope taken from the v1.1 draft | F1 to F19 are added, except F4 and F8. Decided 17 November 2026. | N1, N3, N4 |
| D9 | Meaning of baseline | Baseline means measured runs. A forecast is an estimate. | Definitions |
| D10 | Stack | Local Node.js, TypeScript and SQLite, not the hosted Python, PostgreSQL, Redis and S3 stack in v1.1 | TRD section 2 |
| D11 | Release order | Measurement, controlled execution, estimation, calibration | FR-38 to FR-56 |

## Risks

Risks use the code RK because the collector already uses R1, R4 and R7 for its own rules.

- **RK1 Provider usage formats change.** Raw payloads are kept (FR-15) and each normaliser has recorded fixtures, so stored data can be normalised again.
- **RK2 A framework changes its telemetry or hides per-call usage.** Each adapter declares what it can report, the version is recorded (FR-10), and unparsed lines are counted (NFR-11).
- **RK3 Agent runs execute commands on the local machine.** Runs use a disposable workspace (NFR-7) and limits (FR-12). A container is recommended for repos that are not trusted.
- **RK4 Baselines cost money to produce.** The matrix shows its maximum spend before it starts (FR-19), and each run is capped (FR-12).
- **RK5 Prompt caches carry over between repeated runs.** Later runs can be cheaper than the first. Runs that begin with cache reads are flagged as warm starts.
- **RK6 Reasoning is not reported the same way everywhere.** Some sources fold it into output. Those values are stored as not reported (FR-16), so reasoning comparisons can be incomplete.
- **RK7 Run-to-run spread hides small differences.** The comparison shows the spread and flags baselines whose cost ranges overlap (FR-22).
- **RK8 A forecast can look more precise than its evidence.** Every forecast shows its evidence level, and unsupported values are left out (FR-52).
- **RK9 Frameworks do not report stages or context sources.** Staged runs need a workflow that the runner drives itself. Values a framework cannot supply are marked unavailable (FR-40, FR-42).
- **RK10 External ingestion overlaps usage-collector.** The stores stay separate, and the one-door rule still holds inside each store (FR-44).
