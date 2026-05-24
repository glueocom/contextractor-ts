# TypeScript Type File Audit

Split grouped type files into one-type-per-file where types are conceptually independent. Tightly coupled pairs (one type directly contains the other) stay co-located.

## Rule

Each conceptually independent interface or type gets its own kebab-case file. A `types.ts` with 5+ unrelated interfaces is a barrel that should be split. See `.claude/rules/prompt-engineering-knowledge.md` for context.

## Targets

### Step AUDIT: Identify candidates

Run:

```bash
grep -rn "^export interface\|^export type" --include="*.ts" packages/ apps/ tools/ | grep -v "node_modules\|/dist"
```

Primary candidate: `tools/platform-test-runner/src/types.ts` — contains 10+ distinct interfaces. Split each into its own file:

- `TestCaseInput` → `test-case-input.ts`
- `ActorSettings` → `actor-settings.ts`
- `TestSuite` + `TestCase` → `test-suite.ts` (keep together — `TestSuite` contains `TestCase[]`)
- `TestResult` → `test-result.ts`
- `DatasetItem` + `ContentRef` → `dataset-item.ts` (keep together — `ContentRef` is used only by `DatasetItem`)
- `SuiteRunResult` → `suite-run-result.ts`
- `CLIOptions` → `cli-options.ts`
- `ReportEntry` → `report-entry.ts`

Secondary candidate: `packages/crawler/src/sinks/types.ts` — contains `Sink<T>` (type alias) and `ExtractionResult`. These are distinct enough to consider splitting, but if all consumers always import both, keeping them together is acceptable. Apply judgment.

### Step SPLIT: Create individual files

For each type being split out of `platform-test-runner/src/types.ts`:
- Create the new file in the same directory (`tools/platform-test-runner/src/`)
- Move the interface/type definition (and any JSDoc above it) verbatim
- Do NOT add re-exports back to `types.ts` — update callers directly

### Step UPDATE: Fix all imports

- `grep -rn "from.*types" tools/platform-test-runner/src/ --include="*.ts"` — find all files importing from the old `types.ts`
- Update each import to reference the new specific file
- Delete `types.ts` once all imports are updated

### Step VERIFY: Lint and type-check

```bash
pnpm lint
pnpm build
```

Fix any errors before marking done.
