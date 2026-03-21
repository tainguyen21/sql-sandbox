# Phase 08 - AI Optimizer & A/B Query Comparison

## Context Links
- [Plan Overview](./plan.md)
- [Spec: AI Optimizer](../../pg-sandbox-prompt%20(1).md) (Section 6)
- [Spec: A/B Comparison](../../pg-sandbox-prompt%20(1).md) (Section 5, A/B subsection)

## Overview
- **Priority**: P2
- **Status**: pending
- **Effort**: 10h
- **Blocked by**: Phase 06
- **Description**: LLM-powered query optimization suggestions using full 7-layer AnalysisResult, and side-by-side A/B query comparison tool.

## Key Insights
- Prompt includes: schema DDL, original query, all signals, GUC values, column stats, plan JSON, storage state, index usage, WAL impact
- Structured JSON response: suggestions with title, layer, problem, solution, rewritten_query, ddl_changes, guc_changes
- A/B comparison: run both queries through full analyzer, diff signals and metrics
- Provider-agnostic: OpenRouter or OpenAI, configurable per workspace

## Requirements

### Functional
- **AI Optimizer**: "Get AI suggestions" button on analyzer results
- Build structured prompt from full AnalysisResult
- Parse JSON response into suggestion cards
- Each card: layer badge, problem, solution, before/after SQL diff, DDL changes, GUC changes
- "Apply DDL" executes CREATE INDEX etc., "Apply GUC" executes SET, "Copy rewritten query" to editor
- **A/B Compare**: two editor panes, run both through analyzer, side-by-side metrics
- Diff view: signals in A vs B, metric comparison (cost, time, buffers, WAL)
- Verdict badge: which query wins per metric

### Non-functional
- LLM call timeout: 30s
- API key stored encrypted or from env
- Graceful fallback if LLM unavailable

## Related Code Files

### Files to Create
- `apps/api/src/modules/optimizer/optimizer.module.ts`
- `apps/api/src/modules/optimizer/optimizer.controller.ts`
- `apps/api/src/modules/optimizer/optimizer.service.ts`
- `apps/api/src/modules/optimizer/prompt-builder.service.ts`
- `apps/api/src/modules/optimizer/llm-client.service.ts`
- `apps/api/src/modules/optimizer/dto/suggest.dto.ts`
- `apps/api/src/modules/analyzer/compare.service.ts`
- `packages/shared/src/types/optimizer.ts`
- `apps/web/components/optimizer/ai-suggestion-panel.tsx`
- `apps/web/components/optimizer/suggestion-card.tsx`
- `apps/web/components/optimizer/sql-diff-viewer.tsx`
- `apps/web/components/compare/ab-compare-panel.tsx`
- `apps/web/components/compare/compare-metrics-table.tsx`
- `apps/web/components/compare/compare-signals-diff.tsx`

## Implementation Steps

1. **LlmClientService** (`apps/api/src/modules/optimizer/llm-client.service.ts`)
   - Abstract LLM provider: `complete(prompt: string): Promise<string>`
   - OpenRouter implementation: POST to `https://openrouter.ai/api/v1/chat/completions`
   - OpenAI implementation: POST to `https://api.openai.com/v1/chat/completions`
   - Config from llm_configs table or env vars
   - Timeout: 30s, retry: 1x on network error

2. **PromptBuilderService** (`apps/api/src/modules/optimizer/prompt-builder.service.ts`)
   - Build prompt from AnalysisResult following spec template
   - Include: schema DDL, original query, all signals, GUC values, column stats, plan JSON, storage stats, index usage, WAL delta
   - Trim large plan trees to keep prompt < 8K tokens

3. **OptimizerService** (`apps/api/src/modules/optimizer/optimizer.service.ts`)
   - `suggest(workspaceId, sql, analysisResult)`:
     1. Get schema DDL context (table definitions + indexes)
     2. Build prompt via PromptBuilderService
     3. Call LLM via LlmClientService
     4. Parse JSON response, validate structure
     5. Return typed suggestions array
   - `applyDDL(workspaceId, ddl)`: validate + execute DDL in workspace
   - `applyGUC(workspaceId, guc)`: execute SET statement

4. **OptimizerController**
   - `POST /workspaces/:id/analyze/suggest` → suggest
   - `POST /workspaces/:id/analyze/apply-ddl` → applyDDL
   - `POST /workspaces/:id/analyze/apply-guc` → applyGUC

5. **CompareService** (`apps/api/src/modules/analyzer/compare.service.ts`)
   - `compare(workspaceId, sqlA, sqlB)`:
     1. Run full analyzer on both queries (can parallelize)
     2. Compute metric diffs: total cost, execution time, buffer hits/reads, WAL bytes
     3. Diff signals: in A only, in B only, in both
     4. Determine verdict per metric

6. **Compare endpoint**: `POST /workspaces/:id/analyze/compare`

7. **AI suggestion panel** (`apps/web/components/optimizer/ai-suggestion-panel.tsx`)
   - "Get AI suggestions" button (clearly labeled AI-generated)
   - Loading state while LLM processes
   - Error state if LLM fails

8. **Suggestion card** (`apps/web/components/optimizer/suggestion-card.tsx`)
   - Layer badge (e.g. "Layer 4 - Index")
   - Problem description, solution text
   - Before/after SQL diff (use `diff` npm package)
   - DDL changes code block with "Apply" button
   - GUC changes with "Apply" button
   - "Copy rewritten query" button
   - Expected improvement + tradeoffs

9. **A/B compare panel** (`apps/web/components/compare/ab-compare-panel.tsx`)
   - Two Monaco editors side by side
   - "Run Comparison" button
   - Results: side-by-side metrics table + signal diff
   - Verdict badges per metric (green check on winner)

## Todo List
- [ ] Implement LlmClientService (OpenRouter + OpenAI)
- [ ] Implement PromptBuilderService
- [ ] Implement OptimizerService (suggest, applyDDL, applyGUC)
- [ ] Implement OptimizerController
- [ ] Implement CompareService
- [ ] Build AI suggestion panel
- [ ] Build suggestion cards with SQL diff
- [ ] Build A/B compare panel with dual editors
- [ ] Build metrics comparison table
- [ ] Build signals diff view
- [ ] Test with various query optimization scenarios

## Success Criteria
- LLM returns valid JSON suggestions for common query issues
- Suggestion cards render with proper diff, DDL, GUC sections
- Apply DDL executes index creation successfully
- A/B comparison shows clear metric differences
- Verdict correctly identifies faster query

## Risk Assessment
- **LLM hallucination**: Validate DDL suggestions with SqlValidator before showing "Apply"
- **Token limits**: Trim large plan trees; keep prompt < 8K tokens
- **API key security**: Encrypt at rest, never expose in frontend

## Security Considerations
- LLM API key encrypted in DB or env-only
- DDL from AI validated before execution (same rules as user DDL)
- GUC changes session-scoped only (reset on connection release)
- No user data sent to LLM beyond schema structure and query

## Next Steps
- Phase 10: Write path (WAL data improves optimizer suggestions for DML)
