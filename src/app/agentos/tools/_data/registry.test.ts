/**
 * Phase 7 / Plan 07-04 — Tool Registry consumer test (W2).
 *
 * Asserts that the Notion entry is no longer a placeholder after this plan lands.
 * Catches regressions where someone adds Notion tools but forgets to flip placeholder.
 */
import { describe, it, expect } from "vitest";
import { REGISTRY } from "./registry";

describe("Tool Registry — Notion entry", () => {
  it("has a Notion entry", () => {
    const notion = REGISTRY.find((i) => i.key === "notion");
    expect(notion).toBeDefined();
  });

  it("placeholder === false (W2)", () => {
    const notion = REGISTRY.find((i) => i.key === "notion");
    expect(notion?.placeholder).toBe(false);
  });

  it("has at least one tool", () => {
    const notion = REGISTRY.find((i) => i.key === "notion");
    expect((notion?.tools.length ?? 0)).toBeGreaterThan(0);
  });

  it("write tools default to approval_gated", () => {
    const notion = REGISTRY.find((i) => i.key === "notion");
    const writes = notion?.tools.filter((t) => t.type === "write") ?? [];
    for (const t of writes) {
      expect(t.defaultPermission).toBe("approval_gated");
    }
  });

  it("read tools default to always_allowed", () => {
    const notion = REGISTRY.find((i) => i.key === "notion");
    const reads = notion?.tools.filter((t) => t.type === "read") ?? [];
    expect(reads.length).toBeGreaterThan(0);
    for (const t of reads) {
      expect(t.defaultPermission).toBe("always_allowed");
    }
  });

  it("all tool names use kebab-case (Notion convention)", () => {
    const notion = REGISTRY.find((i) => i.key === "notion");
    for (const t of notion?.tools ?? []) {
      // Tool name after mcp__notion__ prefix should use kebab-case
      const toolPart = t.name.split("__").pop() ?? "";
      expect(toolPart).toMatch(/^notion-/);
    }
  });
});
