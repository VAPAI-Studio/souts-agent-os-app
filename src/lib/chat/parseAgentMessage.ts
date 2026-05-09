/**
 * Parse a Claude Agent SDK message envelope into user-facing display parts.
 *
 * Input shapes (all observed in agentos.run_logs.content and agentos.agent_runs.output):
 *
 *   1. JSON string:          '{"type":"assistant","blocks":[...]}'
 *   2. Object envelope:      { type: "assistant", blocks: [...] }
 *   3. Array of envelopes:   [ {type:"assistant",blocks:[...]}, {type:"assistant",blocks:[...]} ]
 *   4. Plain string:         "Hello world"  (pre-SDK rows or simple outputs)
 *   5. null / undefined
 *
 * Block shapes inside envelope.blocks:
 *
 *   - { type: "text", text: "actual text" }                        → text part (KEEP)
 *   - { type: "tool_use", name, input, id }                        → tool part (KEEP, rendered as chip)
 *   - { type: "thinking", thinking: "..." }                        → FILTER (internal reasoning)
 *   - { type: "unknown", repr: "ThinkingBlock(thinking=...)" }     → FILTER (older SDK shape)
 *   - { type: "tool_result", ... }                                 → FILTER (matched to tool_use by id)
 *
 * Two public functions:
 *   - parseAgentMessageParts(content) → MessagePart[]    ← preferred for rendering
 *   - parseAgentMessage(content)      → string           ← legacy, text-only (kept for compat)
 */

export type MessagePart =
  | { kind: 'text'; text: string }
  | { kind: 'tool_use'; name: string; input: unknown; id?: string };

type Block = {
  type?: string;
  text?: unknown;
  thinking?: unknown;
  repr?: unknown;
  // tool_use shape
  name?: unknown;
  input?: unknown;
  id?: unknown;
};

type Envelope = {
  type?: string;
  blocks?: Block[];
};

function extractPartsFromBlocks(blocks: Block[] | undefined): MessagePart[] {
  if (!Array.isArray(blocks)) return [];
  const parts: MessagePart[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'text' && typeof b.text === 'string') {
      parts.push({ kind: 'text', text: b.text });
    } else if (b.type === 'tool_use' && typeof b.name === 'string') {
      parts.push({
        kind: 'tool_use',
        name: b.name,
        input: b.input,
        id: typeof b.id === 'string' ? b.id : undefined,
      });
    }
    // Drop thinking / unknown / tool_result blocks.
  }
  return parts;
}

function partsFromEnvelope(env: Envelope): MessagePart[] {
  // Only render assistant envelopes (filters out user/system/tool result envelopes).
  if (env.type === 'assistant' && env.blocks) {
    return extractPartsFromBlocks(env.blocks);
  }
  if (env.blocks) {
    return extractPartsFromBlocks(env.blocks);
  }
  return [];
}

/**
 * Public API: convert any chat-message content shape into ordered display parts.
 * Returns [] for unrecognized / empty / non-text content.
 */
export function parseAgentMessageParts(content: unknown): MessagePart[] {
  if (content === null || content === undefined) return [];

  // Plain string — could be raw text OR a serialised envelope JSON.
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return parseAgentMessageParts(JSON.parse(trimmed));
      } catch {
        return [{ kind: 'text', text: content }];
      }
    }
    return content ? [{ kind: 'text', text: content }] : [];
  }

  // Array of envelopes — concat in order.
  if (Array.isArray(content)) {
    return content.flatMap((c) => parseAgentMessageParts(c));
  }

  // Object — could be an Envelope or a wrapped output.
  if (typeof content === 'object') {
    const obj = content as Envelope & {
      report_markdown?: string;
      output?: unknown;
      messages?: unknown;
    };

    // COO daily report shape — render the markdown directly.
    if (typeof obj.report_markdown === 'string' && obj.report_markdown) {
      return [{ kind: 'text', text: obj.report_markdown }];
    }

    if (obj.messages !== undefined) return parseAgentMessageParts(obj.messages);
    if (obj.output !== undefined) return parseAgentMessageParts(obj.output);

    return partsFromEnvelope(obj);
  }

  return [];
}

/**
 * Legacy text-only API — keeps backward compatibility with code that just
 * needs a flat string (e.g. plain-text fallback, search indexing).
 */
export function parseAgentMessage(content: unknown): string {
  return parseAgentMessageParts(content)
    .filter((p): p is Extract<MessagePart, { kind: 'text' }> => p.kind === 'text')
    .map((p) => p.text)
    .join('\n\n');
}
