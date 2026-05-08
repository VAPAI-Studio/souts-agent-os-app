'use client';
/**
 * Phase 7 / Plan 07-03 — Drive Shared Drives section on the Agent Edit page.
 *
 * Drive IDs are opaque strings (e.g., "0AaBcDe...") found in the URL when opening
 * a shared drive in Google Drive. Unlike Slack channels (fetched via API), Drive
 * shared drive IDs must be entered manually by the admin — Google Drive has no
 * "list accessible shared drives" endpoint accessible without a pre-configured service
 * account. Free-text input pattern mirrors GmailLabelsSection (Plan 07-02).
 *
 * UI-SPEC:
 *   - Free-text input: add shared drive IDs one at a time.
 *   - Remove button per chip (ID shown in monospace).
 *   - Save button persists agents.config.drive_shared_drive_ids[] via saveDriveSharedDrives.
 *
 * testid contract: drive-drives-section, drive-id-input (new-id input), add-drive-id-btn,
 *   drive-id-chip-{id}, save-drive-drives-btn.
 */
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { saveDriveSharedDrives } from '../_actions';

export interface DriveSharedDrivesSectionProps {
  agentId: string;
  /** Pre-populated from agents.config.drive_shared_drive_ids. */
  initialDriveIds: string[];
}

export function DriveSharedDrivesSection({
  agentId,
  initialDriveIds,
}: DriveSharedDrivesSectionProps) {
  const [driveIds, setDriveIds] = useState<string[]>(initialDriveIds);
  const [newId, setNewId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const addDriveId = () => {
    const trimmed = newId.trim();
    if (!trimmed) return;
    if (driveIds.includes(trimmed)) {
      setError('Drive ID already in list.');
      return;
    }
    setDriveIds((prev) => [...prev, trimmed]);
    setNewId('');
    setError(null);
  };

  const removeDriveId = (id: string) => {
    setDriveIds((prev) => prev.filter((d) => d !== id));
  };

  const onSave = () => {
    setError(null);
    setOkMessage(null);
    startTransition(async () => {
      const res = await saveDriveSharedDrives(agentId, driveIds);
      if (!res.ok) {
        setError(res.error);
      } else {
        setOkMessage('Shared drives saved.');
      }
    });
  };

  return (
    <section data-testid="drive-drives-section" className="mt-xl">
      <h2 className="text-18 font-semibold">Google Drive</h2>
      <p className="text-13 text-text-muted">
        Shared drive IDs this agent can access. The agent is blocked from My Drive
        entirely — only shared drives in this list are reachable.
        <br />
        <span className="font-medium">How to find a shared drive ID:</span> Open a
        shared drive in Google Drive, copy the ID from the URL:{' '}
        <code className="text-12">
          drive.google.com/drive/folders/<strong>0AABCD...</strong>
        </code>
      </p>

      {driveIds.length > 0 && (
        <ul className="mt-sm flex flex-col gap-1">
          {driveIds.map((id) => (
            <li
              key={id}
              data-testid={`drive-id-chip-${id}`}
              className="flex items-center gap-sm"
            >
              <span className="flex-1 font-mono text-13 bg-surface-secondary px-sm py-1 rounded">
                {id}
              </span>
              <Button
                intent="secondary"
                size="sm"
                onClick={() => removeDriveId(id)}
                type="button"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-sm flex gap-sm items-end">
        <div className="flex-1">
          <Input
            id="new-drive-id"
            type="text"
            data-testid="drive-id-input"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="0AaBcDeFgHiJkLmN..."
            onKeyDown={(e) => e.key === 'Enter' && addDriveId()}
          />
        </div>
        <Button
          intent="secondary"
          size="sm"
          onClick={addDriveId}
          type="button"
          data-testid="add-drive-id-btn"
        >
          Add
        </Button>
      </div>

      {error && (
        <p className="text-destructive mt-sm text-13" role="alert">
          {error}
        </p>
      )}
      {okMessage && (
        <p className="text-13 mt-sm" role="status">
          {okMessage}
        </p>
      )}
      <div className="mt-sm">
        <Button
          intent="primary"
          size="sm"
          onClick={onSave}
          disabled={isPending}
          data-testid="save-drive-drives-btn"
        >
          {isPending ? 'Saving…' : 'Save shared drives'}
        </Button>
      </div>
    </section>
  );
}
