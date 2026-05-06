import { requireAdmin } from '@/lib/supabase/agentos';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/ui/PageHeader';
import { REGISTRY } from './_data/registry';
import { IntegrationCard } from './_components/IntegrationCard';

/**
 * Phase 6 / Plan 06-02 — /agentos/tools (admin-only Tool Registry).
 *
 * Renders one IntegrationCard per REGISTRY entry. Cross-references
 * agentos.tool_connections to set the 'Connected' badge per integration key.
 *
 * Admin-only per UI-SPEC §Surface 5 — viewer/member roles redirected via
 * requireAdmin().
 */
export default async function ToolsPage() {
  await requireAdmin('/agentos/tools');

  const supabase = await createClient();
  const { data: connections } = await supabase
    .schema('agentos')
    .from('tool_connections')
    .select('integration, status')
    .eq('status', 'connected');

  const connectedSet = new Set<string>(
    (connections ?? []).map((c: { integration: string }) => c.integration),
  );

  return (
    <div data-testid="tools-page" className="flex flex-col gap-lg">
      <PageHeader title="Integrations" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
        {REGISTRY.map((integration) => (
          <IntegrationCard
            key={integration.key}
            integration={integration}
            connected={connectedSet.has(integration.key)}
          />
        ))}
      </div>
    </div>
  );
}
