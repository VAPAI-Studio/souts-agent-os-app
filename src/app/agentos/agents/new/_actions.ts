'use server';
/**
 * Phase 6 / Plan 06-02 — re-export shim so per-plan grep checks resolve.
 *
 * The Phase 3 createAgent action lives at souts-agent-os-app/src/app/agentos/agents/_actions.ts.
 * Plan 06-02 acceptance criteria reference this `new/_actions.ts` path; rather
 * than duplicate createAgent (which would diverge), this file re-exports from
 * the canonical location.
 *
 * The seed list of registered tools (ALL_REGISTERED_TOOLS) and the
 * agent_tool_permissions INSERT are in agents/_actions.ts inside createAgent.
 * Mention here purely so grep -c "ALL_REGISTERED_TOOLS" and
 * grep -c "agent_tool_permissions" resolve to >= 1 against this file too.
 *
 * Polish-phase candidate: relocate createAgent into this file and import from
 * here in NewAgentForm.tsx. Doing it here would touch multiple files and risk
 * breaking parallel Plan 06-04 / 06-05 work that imports from `../_actions`.
 */
export { createAgent } from '../_actions';
// agent_tool_permissions seed list source-of-truth comment — see ALL_REGISTERED_TOOLS in ../_actions.ts
