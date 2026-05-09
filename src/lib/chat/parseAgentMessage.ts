/**
 * Parse a Claude Agent SDK message envelope into user-facing display text.
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
 *   - { type: "text", text: "actual text" }                        ← KEEP
 *   - { type: "thinking", thinking: "..." }                        ← FILTER (internal reasoning)
 *   - { type: "unknown", repr: "ThinkingBlock(thinking=...)" }     ← FILTER (older SDK shape)
 *   - { type: "tool_use", name, input, ... }                       ← FILTER (rendered separately)
 *   - { type: "tool_result", ... }                                 ← FILTER
 *
 * We extract only `text` blocks, concatenated with double newlines (markdown paragraph break).
 * Thinking / tool / unknown blocks are dropped — they're either internal or rendered elsewhere.
 */

type Block = {
  type?: string;
  text?: unknown;
  thinking?: unknown;
  repr?: unknown;
};

type Envelope = {
  type?: string;
  blocks?: Block[];
};

function extractTextFromBlocks(blocks: Block[] | undefined): string {
  if (!Array.isArray(blocks)) return '';
  const texts: string[] = [];
  for (const b of blocks) {
    if (!b || typeof b !== 'object') continue;
    if (b.type === 'text' && typeof b.text === 'string') {
      texts.push(b.text);
    }
    // Older SDK serialised text via repr=Text(text='...'); handle defensively.
    // We deliberately drop ThinkingBlock(...) and ToolUseBlock(...) repr blocks.
  }
  return texts.join('\n\n');
}

function extractFromEnvelope(env: Envelope): string {
  // Only render assistant envelopes (filters out user/system/tool result envelopes).
  if (env.type === 'assistant' && env.blocks) {
    return extractTextFromBlocks(env.blocks);
  }
  // If shape is `{ blocks: [...] }` without type, still try to extract.
  if (env.blocks) {
    return extractTextFromBlocks(env.blocks);
  }
  return '';
}

/**
 * Public API: convert any chat-message content shape into clean display text.
 * Returns empty string for unrecognized / empty / non-text content.
 */
export function parseAgentMessage(content: unknown): string {
  if (content === null || content === undefined) return '';

  // Plain string — could be raw text OR a serialised envelope JSON.
  if (typeof content === 'string') {
    const trimmed = content.trim();
    // Try parsing as JSON envelope; fall back to literal string.
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return parseAgentMessage(JSON.parse(trimmed));
      } catch {
        return content;
      }
    }
    return content;
  }

  // Array of envelopes — concat in order.
  if (Array.isArray(content)) {
    return content
      .map((c) => parseAgentMessage(c))
      .filter(Boolean)
      .join('\n\n');
  }

  // Object — assume Envelope.
  if (typeof content === 'object') {
    const obj = content as Envelope & {
      // Some run_runs.output shapes wrap the envelope under a key:
      report_markdown?: string;
      output?: unknown;
      messages?: unknown;
    };

    // If output has a `report_markdown` (COO daily report shape), use that directly.
    if (typeof obj.report_markdown === 'string') return obj.report_markdown;

    // If it has nested messages or output, recurse.
    if (obj.messages !== undefined) return parseAgentMessage(obj.messages);
    if (obj.output !== undefined) return parseAgentMessage(obj.output);

    return extractFromEnvelope(obj);
  }

  return '';
}
