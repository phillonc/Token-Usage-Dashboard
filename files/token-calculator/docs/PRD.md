# Token Calculator: Product Requirements

Version 0.1, 17 November 2026. Draft for review. Companion: [Technical Requirements](TRD.md).

Token Calculator measures the tokens and cost needed to complete a defined task on any provider and model, either as a single request or through a selected agent framework, and stores the results as comparable baselines.

## Problem

The token cost of building a feature cannot be measured today in a way that compares models or agent frameworks.

- **P1 Usage is reported in different shapes.** Each provider counts cached, reasoning and tool tokens differently, so raw totals from two vendors are not comparable.
- **P2 Framework overhead is hidden.** Agent frameworks add system prompts, tool definitions, re-sent history and retries. Nothing separates that overhead from the cost of the model.
- **P3 One run is not representative.** The same task produces a different token count on each run, so a single measurement cannot be trusted.

## Goals and non-goals

v1 delivers measured baselines. Estimating features that have not been built is out of scope until baselines exist.

**Goals**

- **G1** Measure tokens and cost for a task on any provider and any model, including local models.
- **G2** Run a task in one of two modes: a single request, or a selected agent framework.
- **G3** Normalise usage into one set of token buckets so results compare across vendors.
- **G4** Store repeated runs of one configuration as a baseline with a median and a spread.
- **G5** Compare baselines side by side on tokens, cost and cost per passing run.
- **G6** Show where an agent framework spends tokens, so framework overhead is separated from model cost.

**Non-goals**

- **N1** Predicting tokens for a feature before it is built.
- **N2** Judging output quality beyond pass or fail of the acceptance check.
- **N3** Multi-user access, authentication or hosted deployment.
- **N4** Budget enforcement or live spend alerts.
- **N5** Building or modifying agent frameworks.

## Definitions

These terms are used with one meaning in both the PRD and the TRD.

| Term | Meaning |
| --- | --- |
| Task | The unit of work measured: a prompt, or a spec plus a repo at a pinned commit. It can carry an acceptance check and limits. |
| Run mode | How a task is executed. **Single request** sends one API call. **Agent framework** runs a selected framework until it stops. |
| Configuration | One combination of run mode, framework and its version (agent mode only), provider, model and parameters. |
| Run | One execution of one task under one configuration. |
| Baseline | The repeated runs of one task under one configuration, with summary statistics. |
| Token bucket | One of six non-overlapping token categories: uncached input, cache read, cache write, visible output, reasoning, tool input. |
| Acceptance check | A command that exits 0 on pass. It decides whether a run passed. |
| Cost per passing run | Total cost of all runs in a baseline, failed ones included, divided by the number that passed. |

## Relationship to usage-collector

Token Calculator is a separate tool that sits beside `files/usage-collector`. The two answer different questions.

| | usage-collector | Token Calculator |
| --- | --- | --- |
| Question | What did I spend, and was it worth it? | What does this task cost on this model and framework? |
| Unit | Session, model and day | Task, configuration and run, with one row per API call where the framework reports it |
| Token detail | Input, output, cache read and cache write. Reasoning is folded into output. | Six buckets, with reasoning and tool input kept separate |
| Source of data | Everyday usage, picked up by watchers and ingest | Controlled runs that it starts itself |
| Judgement | Human review fields | Pass or fail from an acceptance check |

Token Calculator sends nothing to the collector (FR-27). Agent runs that it starts are still real usage, so the collector's own watchers record them as usual.

## Functional requirements

P0 is required for v1. P1 can follow v1.

**Providers and models**

- **FR-1 (P0)** A provider is added through configuration only: an ID, an API style, a base URL and the name of the environment variable that holds its key.
- **FR-2 (P0)** Four API styles are supported: `anthropic-messages`, `openai-responses`, `openai-chat` and `gemini-generate-content`.
- **FR-3 (P0)** Any model ID is accepted as free text. No model list is hard-coded.
- **FR-4 (P0)** Local model servers work through the `openai-chat` style with no API key.
- **FR-5 (P0)** Model parameters are set per configuration and passed to the provider, including reasoning or thinking settings.

**Run modes**

- **FR-6 (P0)** Single request mode sends one API call built from a system prompt, a user prompt and optional context files, and records its usage.
- **FR-7 (P0)** Agent framework mode runs a selected framework headlessly on a task in an isolated copy of the repo, and records the usage of the API calls it makes.
- **FR-8 (P0)** Claude Code, Codex CLI, Gemini CLI and Pi are selectable in v1. Only frameworks installed on the machine are offered, each with its detected version.
- **FR-9 (P0)** A framework is added by writing one adapter module. The runner, storage and reports do not change.
- **FR-10 (P0)** Every run records the framework version, model ID and parameters used.

**Tasks and limits**

- **FR-11 (P0)** A task is defined once and reused across configurations. It holds the prompt or spec files, the repo and commit for agent mode, an optional acceptance check, and limits.
- **FR-12 (P0)** Each run has a maximum cost, a maximum duration and a maximum number of API calls. A run that reaches a limit is stopped and recorded with the limit as the reason.
- **FR-13 (P0)** A run ends as `passed`, `failed` or `unchecked`. The acceptance check decides, and `unchecked` means the task has no check.

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

- **FR-22 (P0)** Two or more baselines of the same task are compared side by side on buckets, cost, pass rate, cost per passing run and W1 to W6. Pairs whose cost ranges overlap are flagged.
- **FR-23 (P1)** A run can be opened to show each API call in order with its buckets.
- **FR-24 (P1)** Baselines and runs export as CSV and JSON.

**Interface**

- **FR-25 (P0)** A local web UI defines tasks, selects the run mode, framework, provider and model, starts a matrix, shows progress and compares baselines.
- **FR-26 (P1)** A CLI command starts the same matrix from a file.

**Coexistence**

- **FR-27 (P0)** Token Calculator keeps its own store and sends nothing to usage-collector. Run workspaces are named with the prefix `tokcalc-`, so the collector's project field identifies benchmark usage.

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

## Acceptance criteria

v1 is accepted when all six hold. AC-2 to AC-6 need real providers, so they are run by hand outside CI.

- **AC-1** Every FR and NFR has at least one TDD scenario in the [TRD](TRD.md#11-tdd-scenarios), and every scenario passes in CI.
- **AC-2** One prompt run through Anthropic, OpenAI, Gemini and one local OpenAI-compatible server gives four runs, and no call fails the bucket sum check.
- **AC-3** Each v1 framework completes the reference task headlessly, and the stored totals are within 1% of the framework's own reported session total.
- **AC-4** A matrix of 4 configurations with 3 runs each completes on the reference task with no manual step after start.
- **AC-5** For runs billed to an API key, calculated cost is within 5% of the provider's billed amount for the same calls.
- **AC-6** During AC-4, usage-collector receives no request from Token Calculator.

## Success metrics

- **M1** A comparison of two frameworks on one task, with 3 runs each, is produced from one form submission or one command.
- **M2** Adding a provider that uses a supported API style takes under 5 minutes.
- **M3** The bucket sum check passes on 100% of calls that report a total.
- **M4** Unparsed capture lines stay at zero for pinned framework versions.

## Open decisions

Each decision has a default that this draft already follows. Changing one changes the requirements named beside it.

| Code | Decision | Default in this draft | Affects |
| --- | --- | --- | --- |
| D1 | Estimate unbuilt features in v1 | No. Baselines come first. | N1 |
| D2 | Interface | Web UI in v1, CLI after | FR-25, FR-26 |
| D3 | Relationship to usage-collector | Separate package and store in this repo, with no ingest into the collector | FR-27 |
| D4 | Order in which framework adapters are built | Claude Code, Pi, Codex CLI, Gemini CLI | FR-8 |
| D5 | Runs per baseline | 3 | FR-19 |
| D6 | Cost basis for runs made on a subscription plan | API list price, so plans and API keys compare on one scale | FR-17 |
| D7 | Currency | US dollars, because providers publish prices in dollars | FR-17 |

## Risks

Risks use the code RK because the collector already uses R1, R4 and R7 for its own rules.

- **RK1 Provider usage formats change.** Raw payloads are kept (FR-15) and each normaliser has recorded fixtures, so stored data can be normalised again.
- **RK2 A framework changes its telemetry or hides per-call usage.** Each adapter declares what it can report, the version is recorded (FR-10), and unparsed lines are counted (NFR-11).
- **RK3 Agent runs execute commands on the local machine.** Runs use a disposable workspace (NFR-7) and limits (FR-12). A container is recommended for repos that are not trusted.
- **RK4 Baselines cost money to produce.** The matrix shows its maximum spend before it starts (FR-19), and each run is capped (FR-12).
- **RK5 Prompt caches carry over between repeated runs.** Later runs can be cheaper than the first. Runs that begin with cache reads are flagged as warm starts.
- **RK6 Reasoning is not reported the same way everywhere.** Some sources fold it into output. Those values are stored as not reported (FR-16), so reasoning comparisons can be incomplete.
- **RK7 Run-to-run spread hides small differences.** The comparison shows the spread and flags baselines whose cost ranges overlap (FR-22).
