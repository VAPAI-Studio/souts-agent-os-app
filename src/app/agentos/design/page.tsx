import { requireAdmin } from '@/lib/supabase/agentos';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Label } from '@/components/ui/Label';
import { FormField } from '@/components/ui/FormField';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/ui/Table';

/**
 * /agentos/design — Phase 03.1 Plan 05 design showcase gallery.
 *
 * Admin-only Server Component that renders every Plan 02 primitive with
 * all variants and states defined in UI-SPEC.md. The single source of
 * truth for downstream phase agents to discover what UI atoms already
 * exist before reinventing.
 *
 * Auth contract: requireAdmin('/agentos/design') — non-admin redirects
 * to /agentos/no-access; signed-out users go to /login.
 *
 * Note on path: the plan originally specified `/agentos/_design`, but
 * Next.js App Router treats underscore-prefixed folders as private
 * (non-routable). Renamed to `design` to make the route reachable;
 * security is unchanged (requireAdmin gate at the top of the page).
 *
 * The ONE legitimate use of inline style={{ background: '...' }} in this
 * codebase lives in Section 2 (Color), where we render BOTH light AND
 * dark theme tokens regardless of the user's prefers-color-scheme so
 * downstream agents can compare them side-by-side.
 */

// ---- Color token data (Plan 01 globals.css; verbatim values) -------------

const LIGHT_TOKENS: Array<{ name: string; hex: string }> = [
  { name: '--color-surface', hex: '#ffffff' },
  { name: '--color-surface-raised', hex: '#f7f7f7' },
  { name: '--color-border', hex: '#e5e5e5' },
  { name: '--color-border-subtle', hex: '#f0f0f0' },
  { name: '--color-text', hex: '#111111' },
  { name: '--color-text-muted', hex: '#666666' },
  { name: '--color-text-placeholder', hex: '#999999' },
  { name: '--color-accent', hex: '#4f46e5' },
  { name: '--color-accent-fg', hex: '#ffffff' },
  { name: '--color-accent-subtle', hex: '#eef2ff' },
  { name: '--color-destructive', hex: '#dc2626' },
  { name: '--color-destructive-subtle', hex: '#fef2f2' },
  { name: '--color-success', hex: '#16a34a' },
  { name: '--color-success-subtle', hex: '#f0fdf4' },
  { name: '--color-warning', hex: '#d97706' },
  { name: '--color-warning-subtle', hex: '#fffbeb' },
];

const DARK_TOKENS: Array<{ name: string; hex: string }> = [
  { name: '--color-surface', hex: '#0a0a0a' },
  { name: '--color-surface-raised', hex: '#141414' },
  { name: '--color-border', hex: '#262626' },
  { name: '--color-border-subtle', hex: '#1a1a1a' },
  { name: '--color-text', hex: '#ededed' },
  { name: '--color-text-muted', hex: '#888888' },
  { name: '--color-text-placeholder', hex: '#555555' },
  { name: '--color-accent', hex: '#6366f1' },
  { name: '--color-accent-fg', hex: '#ffffff' },
  { name: '--color-accent-subtle', hex: '#1e1b4b' },
  { name: '--color-destructive', hex: '#ef4444' },
  { name: '--color-destructive-subtle', hex: '#450a0a' },
  { name: '--color-success', hex: '#22c55e' },
  { name: '--color-success-subtle', hex: '#052e16' },
  { name: '--color-warning', hex: '#f59e0b' },
  { name: '--color-warning-subtle', hex: '#451a03' },
];

export default async function DesignShowcasePage() {
  await requireAdmin('/agentos/design');

  return (
    <section className="flex flex-col gap-2xl">
      <PageHeader
        title="Design Showcase"
        meta="Phase 03.1 primitives — variants and states reference for downstream agents"
      />

      {/* SECTION 1 — Typography ------------------------------------------ */}
      <section className="flex flex-col gap-md">
        <h2 className="text-[16px] font-semibold leading-tight">
          1. Typography
        </h2>
        <p className="text-[13px] text-text-muted">
          Four roles. Body and Label share the 13px base; Heading is 16px /
          600; Display is Geist Mono for UUIDs, costs, and timestamps.
        </p>
        <div className="flex flex-col gap-sm">
          <div className="flex items-baseline gap-md flex-wrap">
            <span className="text-text-muted text-[12px] w-[100px] shrink-0">
              Body
            </span>
            <p className="text-[13px] font-sans">
              Body — Geist Sans 13px / 400 / 1.5
            </p>
            <span className="text-text-muted text-[12px] font-mono">
              text-[13px] font-sans
            </span>
          </div>
          <div className="flex items-baseline gap-md flex-wrap">
            <span className="text-text-muted text-[12px] w-[100px] shrink-0">
              Label
            </span>
            <p className="text-[13px] font-sans">
              Label — Geist Sans 13px / 400 / 1.4
            </p>
            <span className="text-text-muted text-[12px] font-mono">
              text-[13px] font-sans
            </span>
          </div>
          <div className="flex items-baseline gap-md flex-wrap">
            <span className="text-text-muted text-[12px] w-[100px] shrink-0">
              Heading
            </span>
            <h3 className="text-[16px] font-semibold leading-tight">
              Heading — Geist Sans 16px / 600 / 1.25
            </h3>
            <span className="text-text-muted text-[12px] font-mono">
              text-[16px] font-semibold leading-tight
            </span>
          </div>
          <div className="flex items-baseline gap-md flex-wrap">
            <span className="text-text-muted text-[12px] w-[100px] shrink-0">
              Display
            </span>
            <p className="text-[13px] font-mono">
              Display — Geist Mono 13px / 400 / 1.4 — UUIDs, costs, timestamps
            </p>
            <span className="text-text-muted text-[12px] font-mono">
              text-[13px] font-mono
            </span>
          </div>
        </div>
      </section>

      {/* SECTION 2 — Color ----------------------------------------------- */}
      <section className="flex flex-col gap-md">
        <h2 className="text-[16px] font-semibold leading-tight">2. Color</h2>
        <p className="text-[13px] text-text-muted">
          16 tokens × 2 themes. Light theme is rendered in its natural
          context; dark theme is rendered inside a forced-dark container so
          you can compare values regardless of your system theme.
        </p>

        {/* Light theme grid */}
        <div className="flex flex-col gap-sm">
          <h3 className="text-[13px] font-semibold">Light theme</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-sm">
            {LIGHT_TOKENS.map((t) => (
              <div
                key={t.name}
                className="flex items-center gap-sm rounded border border-border bg-surface-raised p-sm"
              >
                <div
                  className="w-12 h-12 rounded border border-border shrink-0"
                  style={{ background: t.hex }}
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-mono text-[12px] truncate">
                    {t.name}
                  </span>
                  <span className="font-mono text-[11px] text-text-muted">
                    {t.hex}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dark theme grid (forced dark surface) */}
        <div className="flex flex-col gap-sm">
          <h3 className="text-[13px] font-semibold">Dark theme</h3>
          <div
            className="rounded p-md"
            style={{ background: '#0a0a0a', color: '#ededed' }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-sm">
              {DARK_TOKENS.map((t) => (
                <div
                  key={t.name}
                  className="flex items-center gap-sm rounded p-sm"
                  style={{ background: '#141414', border: '1px solid #262626' }}
                >
                  <div
                    className="w-12 h-12 rounded shrink-0"
                    style={{ background: t.hex, border: '1px solid #262626' }}
                    aria-hidden="true"
                  />
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-mono text-[12px] truncate">
                      {t.name}
                    </span>
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: '#888888' }}
                    >
                      {t.hex}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3 — Button ---------------------------------------------- */}
      <section className="flex flex-col gap-md">
        <h2 className="text-[16px] font-semibold leading-tight">3. Button</h2>
        <p className="text-[13px] text-text-muted">
          Four intents × two sizes = eight visual states, plus disabled and
          isPending convention (label flips to ...). Focus-visible accent
          ring on every intent.
        </p>
        <div className="flex flex-col gap-sm">
          <div className="flex items-center gap-sm flex-wrap">
            <span className="text-text-muted text-[12px] w-[140px] shrink-0">
              Intents (size=md)
            </span>
            <Button intent="primary">Primary</Button>
            <Button intent="secondary">Secondary</Button>
            <Button intent="ghost">Ghost</Button>
            <Button intent="destructive">Destructive</Button>
          </div>
          <div className="flex items-center gap-sm flex-wrap">
            <span className="text-text-muted text-[12px] w-[140px] shrink-0">
              Sizes (intent=primary)
            </span>
            <Button intent="primary" size="sm">
              Small
            </Button>
            <Button intent="primary" size="md">
              Medium
            </Button>
          </div>
          <div className="flex items-center gap-sm flex-wrap">
            <span className="text-text-muted text-[12px] w-[140px] shrink-0">
              Disabled
            </span>
            <Button intent="primary" disabled>
              Disabled
            </Button>
            <Button intent="destructive" disabled>
              Disabled
            </Button>
          </div>
          <div className="flex items-center gap-sm flex-wrap">
            <span className="text-text-muted text-[12px] w-[140px] shrink-0">
              Loading (label flips to ...)
            </span>
            <Button intent="primary" disabled>
              ...
            </Button>
            <span className="text-text-muted text-[12px]">
              isPending convention — disabled + label = &apos;...&apos;
            </span>
          </div>
        </div>
      </section>

      {/* SECTION 4 — Badge ----------------------------------------------- */}
      <section className="flex flex-col gap-md">
        <h2 className="text-[16px] font-semibold leading-tight">4. Badge</h2>
        <p className="text-[13px] text-text-muted">
          Five tones for status and metadata. The bottom row maps real DB
          status values to their semantic tone (used on /agentos/agents and
          /agentos/agents/[id]).
        </p>
        <div className="flex flex-col gap-sm">
          <div className="flex items-center gap-sm flex-wrap">
            <span className="text-text-muted text-[12px] w-[140px] shrink-0">
              Tones
            </span>
            <Badge tone="neutral">neutral</Badge>
            <Badge tone="success">success</Badge>
            <Badge tone="warning">warning</Badge>
            <Badge tone="destructive">destructive</Badge>
            <Badge tone="accent">accent</Badge>
          </div>
          <div className="flex items-center gap-sm flex-wrap">
            <span className="text-text-muted text-[12px] w-[140px] shrink-0">
              Real status mapping
            </span>
            <Badge tone="success">active</Badge>
            <Badge tone="warning">paused</Badge>
            <Badge tone="warning">running</Badge>
            <Badge tone="destructive">failed</Badge>
            <Badge tone="destructive">cancelled</Badge>
          </div>
        </div>
      </section>

      {/* SECTION 5 — Input ----------------------------------------------- */}
      <section className="flex flex-col gap-md">
        <h2 className="text-[16px] font-semibold leading-tight">5. Input</h2>
        <p className="text-[13px] text-text-muted">
          Default, error (border-destructive), and disabled states. The
          error prop toggles the border color only — paired with FormField
          to render the error message below.
        </p>
        <div className="flex flex-col gap-sm max-w-md">
          <div className="flex flex-col gap-1">
            <Label htmlFor="d-input-default">Default</Label>
            <Input id="d-input-default" placeholder="Default state" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="d-input-error">Error</Label>
            <Input id="d-input-error" placeholder="Error state" error />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="d-input-disabled">Disabled</Label>
            <Input
              id="d-input-disabled"
              placeholder="Disabled"
              disabled
              defaultValue="cannot edit"
            />
          </div>
        </div>
      </section>

      {/* SECTION 6 — Textarea -------------------------------------------- */}
      <section className="flex flex-col gap-md">
        <h2 className="text-[16px] font-semibold leading-tight">
          6. Textarea
        </h2>
        <p className="text-[13px] text-text-muted">
          Same three states as Input. Min-height 80px (5 rows of 13px text).
        </p>
        <div className="flex flex-col gap-sm max-w-md">
          <div className="flex flex-col gap-1">
            <Label htmlFor="d-ta-default">Default</Label>
            <Textarea id="d-ta-default" placeholder="Default state" />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="d-ta-error">Error</Label>
            <Textarea id="d-ta-error" placeholder="Error state" error />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="d-ta-disabled">Disabled</Label>
            <Textarea
              id="d-ta-disabled"
              placeholder="Disabled"
              disabled
              defaultValue="cannot edit"
            />
          </div>
        </div>
      </section>

      {/* SECTION 7 — Select ---------------------------------------------- */}
      <section className="flex flex-col gap-md">
        <h2 className="text-[16px] font-semibold leading-tight">7. Select</h2>
        <p className="text-[13px] text-text-muted">
          Native HTML select (per CONTEXT.md scope boundary — no Radix
          Select). Same compact 32px control height as Input.
        </p>
        <div className="flex flex-col gap-sm max-w-md">
          <div className="flex flex-col gap-1">
            <Label htmlFor="d-select-default">Default</Label>
            <Select id="d-select-default" defaultValue="member">
              <option value="admin">admin</option>
              <option value="agent_owner">agent_owner</option>
              <option value="member">member</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="d-select-disabled">Disabled</Label>
            <Select id="d-select-disabled" disabled defaultValue="member">
              <option value="admin">admin</option>
              <option value="agent_owner">agent_owner</option>
              <option value="member">member</option>
            </Select>
          </div>
        </div>
      </section>

      {/* SECTION 8 — FormField ------------------------------------------- */}
      <section className="flex flex-col gap-md">
        <h2 className="text-[16px] font-semibold leading-tight">
          8. FormField
        </h2>
        <p className="text-[13px] text-text-muted">
          Wraps a Label + control + optional hint or error. Composes with
          the locked Server Action result shape — error replaces hint when
          present.
        </p>
        <div className="flex flex-col gap-md max-w-md">
          <FormField
            label="Agent name"
            htmlFor="d-ff-name"
            hint="3-50 characters"
          >
            <Input id="d-ff-name" />
          </FormField>
          <FormField
            label="Agent name"
            htmlFor="d-ff-name-err"
            error="Name must be 3-50 characters"
          >
            <Input id="d-ff-name-err" error />
          </FormField>
        </div>
      </section>

      {/* SECTION 9 — Card ------------------------------------------------ */}
      <section className="flex flex-col gap-md">
        <h2 className="text-[16px] font-semibold leading-tight">9. Card</h2>
        <p className="text-[13px] text-text-muted">
          Surface-raised background + rounded border. Three named exports:
          Card / CardHeader / CardBody. Doubles as the dialog surface for
          AddMemberDialog (per Plan 04 retrofit).
        </p>
        <div className="flex flex-col gap-sm max-w-md">
          <Card>
            <CardBody>
              Plain card body — used for grouping content with a subtle
              surface-raised background and rounded border.
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <span className="font-semibold">Card title</span>
            </CardHeader>
            <CardBody>Body content with header above.</CardBody>
          </Card>
        </div>
      </section>

      {/* SECTION 10 — Table ---------------------------------------------- */}
      <section className="flex flex-col gap-md">
        <h2 className="text-[16px] font-semibold leading-tight">10. Table</h2>
        <p className="text-[13px] text-text-muted">
          Six named exports: Table / THead / TBody / Tr / Th / Td. Linear-style
          12px uppercase column headers; row hover bg-surface-raised. Empty
          state uses a single colSpan row.
        </p>
        <div className="flex flex-col gap-md">
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Status</Th>
              </Tr>
            </THead>
            <TBody>
              <Tr>
                <Td>Alice</Td>
                <Td>admin</Td>
                <Td>
                  <Badge tone="success">active</Badge>
                </Td>
              </Tr>
              <Tr>
                <Td>Bob</Td>
                <Td>viewer</Td>
                <Td>
                  <Badge tone="warning">paused</Badge>
                </Td>
              </Tr>
            </TBody>
          </Table>
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Role</Th>
              </Tr>
            </THead>
            <TBody>
              <Tr>
                <Td
                  colSpan={2}
                  className="text-center text-text-muted p-md"
                >
                  No rows yet.
                </Td>
              </Tr>
            </TBody>
          </Table>
        </div>
      </section>

      {/* SECTION 11 — PageHeader ----------------------------------------- */}
      <section className="flex flex-col gap-md">
        <h2 className="text-[16px] font-semibold leading-tight">
          11. PageHeader
        </h2>
        <p className="text-[13px] text-text-muted">
          Page chrome with title (ReactNode), optional meta (badge slot
          below title), and optional actions (right-aligned button group).
          Wrapped in cards here so they don&apos;t collide with this page&apos;s
          own PageHeader at the top.
        </p>
        <div className="flex flex-col gap-md">
          <Card>
            <CardBody>
              <PageHeader title="Simple page title" />
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <PageHeader
                title="Page with actions"
                meta={<Badge tone="success">live</Badge>}
                actions={
                  <>
                    <Button intent="secondary" size="sm">
                      Cancel
                    </Button>
                    <Button intent="primary" size="sm">
                      Save changes
                    </Button>
                  </>
                }
              />
            </CardBody>
          </Card>
        </div>
      </section>

      {/* SECTION 12 — Nav item ------------------------------------------- */}
      <section className="flex flex-col gap-md">
        <h2 className="text-[16px] font-semibold leading-tight">
          12. Nav item
        </h2>
        <p className="text-[13px] text-text-muted">
          The recipe used by SidebarNav.tsx for inactive vs. active rows.
          The pl-[calc(var(--spacing-sm)-2px)] math compensates the 2px
          accent border so text doesn&apos;t shift horizontally on activation.
        </p>
        <div className="flex flex-col gap-1 w-[180px] bg-surface-raised p-sm rounded border border-border">
          <div className="flex items-center px-sm py-1.5 text-[13px] font-sans rounded text-text-muted border-l-2 border-transparent">
            Inactive nav item
          </div>
          <div
            className="flex items-center px-sm py-1.5 text-[13px] font-sans rounded text-accent border-l-2 border-accent"
            style={{ paddingLeft: 'calc(var(--spacing-sm) - 2px)' }}
          >
            Active nav item
          </div>
        </div>
        <p className="text-[12px] text-text-muted">
          Active state: accent left border + accent text. See SidebarNav.tsx.
        </p>
      </section>
    </section>
  );
}
