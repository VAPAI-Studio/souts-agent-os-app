'use client';

import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import type { IntegrationDef } from '../_data/registry';

interface ToolsDrillInProps {
  integration: IntegrationDef;
}

/**
 * Phase 6 / Plan 06-02 — UI-SPEC §Surface 1 lines 162-178.
 * Drill-in panel rendered below an IntegrationCard when the user clicks "Tools".
 *
 * testid contract:
 *   - tools-drill-in-{key} on wrapper
 *   - tools-table-{key} on Table
 */
export function ToolsDrillIn({ integration }: ToolsDrillInProps) {
  return (
    <div
      data-testid={`tools-drill-in-${integration.key}`}
      className="border-t border-border rounded-b p-md mt-[-1px] bg-surface-raised"
    >
      <Table data-testid={`tools-table-${integration.key}`}>
        <THead>
          <Tr>
            <Th>Tool name</Th>
            <Th>Description</Th>
            <Th>Type</Th>
            <Th>Default permission</Th>
          </Tr>
        </THead>
        <TBody>
          {integration.tools.map((tool) => (
            <Tr key={tool.name}>
              <Td className="font-mono text-[12px]">{tool.name}</Td>
              <Td>{tool.description}</Td>
              <Td>
                <Badge tone="neutral">
                  {tool.type === 'read' ? 'Read' : 'Write'}
                </Badge>
              </Td>
              <Td>
                <Badge
                  tone={
                    tool.defaultPermission === 'always_allowed'
                      ? 'success'
                      : 'warning'
                  }
                >
                  {tool.defaultPermission === 'always_allowed'
                    ? 'Always allowed'
                    : 'Approval gated'}
                </Badge>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
