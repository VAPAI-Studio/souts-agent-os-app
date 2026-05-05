'use client';

import * as React from 'react';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { ToolInputEditor, isToolEditable } from './ToolInputEditor';
import { approveApproval, rejectApproval, editAndApproveApproval } from '../_actions';

interface Props {
  approval_id: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
}

export function ApprovalDecisionPanel({ approval_id, tool_name, tool_input }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draftInput, setDraftInput] = useState<Record<string, unknown>>({ ...tool_input });
  const [rejectReason, setRejectReason] = useState('');
  const editable = isToolEditable(tool_name);

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const res = await approveApproval(approval_id, null);
      if (!res.ok) { setError(res.error); return; }
      router.push('/agentos/approvals');
    });
  };

  const handleReject = () => {
    setError(null);
    startTransition(async () => {
      const res = await rejectApproval(approval_id, rejectReason || null);
      if (!res.ok) { setError(res.error); return; }
      router.push('/agentos/approvals');
    });
  };

  const handleEditAndApprove = () => {
    setError(null);
    startTransition(async () => {
      const res = await editAndApproveApproval(approval_id, draftInput);
      if (!res.ok) { setError(res.error); return; }
      router.push('/agentos/approvals');
    });
  };

  return (
    <Card>
      <CardBody>
        <div className="flex flex-col gap-md" data-testid="decision-panel">
          {error && (
            <div className="text-destructive text-[13px]" data-testid="decision-error" role="alert">
              {error}
            </div>
          )}

          {editMode && editable && (
            <div className="flex flex-col gap-md">
              <h3 className="text-[14px] font-semibold">Edit tool input</h3>
              <ToolInputEditor tool_name={tool_name} input={tool_input} onChange={setDraftInput} />
            </div>
          )}

          <FormField label="Reject reason (optional)">
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why this should not run"
              data-testid="reject-reason-input"
              disabled={isPending}
            />
          </FormField>

          <div className="flex gap-sm flex-wrap">
            <Button
              intent="primary"
              size="md"
              data-testid="approve-btn"
              onClick={handleApprove}
              disabled={isPending || editMode}
            >
              {isPending ? '...' : 'Approve'}
            </Button>
            {editable && !editMode && (
              <Button
                intent="secondary"
                size="md"
                data-testid="open-edit-btn"
                onClick={() => setEditMode(true)}
                disabled={isPending}
              >
                Edit and approve
              </Button>
            )}
            {editable && editMode && (
              <Button
                intent="primary"
                size="md"
                data-testid="edit-approve-btn"
                onClick={handleEditAndApprove}
                disabled={isPending}
              >
                {isPending ? '...' : 'Save & Approve'}
              </Button>
            )}
            <Button
              intent="destructive"
              size="md"
              data-testid="reject-btn"
              onClick={handleReject}
              disabled={isPending}
            >
              {isPending ? '...' : 'Reject'}
            </Button>
            {editMode && (
              <Button
                intent="ghost"
                size="md"
                data-testid="cancel-edit-btn"
                onClick={() => { setEditMode(false); setDraftInput({ ...tool_input }); }}
                disabled={isPending}
              >
                Cancel edit
              </Button>
            )}
          </div>

          {!editable && (
            <div className="text-[12px] text-text-muted" data-testid="edit-unavailable-notice">
              Edit-and-approve is not supported for {tool_name}. Use Approve or Reject.
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
