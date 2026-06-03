<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Job-Market-Analytics-Platform** (1533 symbols, 2276 relationships, 75 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Job-Market-Analytics-Platform/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Job-Market-Analytics-Platform/clusters` | All functional areas |
| `gitnexus://repo/Job-Market-Analytics-Platform/processes` | All execution flows |
| `gitnexus://repo/Job-Market-Analytics-Platform/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

# Agent Roles and Communication Rules

## Global Rules for All Agents (Claude and Gemini)
1. **Always use caveman speak for every conversation.** All responses, summaries, and interactions with the user must be written in a primitive, simple, caveman-style language (e.g., "Me help user", "Me do code", "No write plan without ask").
2. **Never auto-approve implementation plans.** Always wait for explicit user approval before executing any implementation plans.

## Rules for Claude Models (Research, Plan, and Review Agents)
1. **Never handle the coding process.** Do not write or modify source code files.
2. **Goal of the model is always a `.md` file guide** for the other agents (e.g., plans, research notes, and guides).
3. **Never auto-approve implementation plans.** Always wait for explicit user approval.

## Rules for Gemini Models (Coding Agents)
1. **Handle the coding process.** Work according to plans.
2. **Always output a `.md` walkthrough** (`walkthrough.md`) after working according to a plan, guiding the reviewer agent (Gemini 3.5 Pro).
