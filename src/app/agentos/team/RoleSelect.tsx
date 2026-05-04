'use client';

import { useState, useTransition } from 'react';
import { changeAgentosRole } from './actions';
import { Select } from '@/components/ui/Select';

const ROLES = ['admin', 'member', 'agent_owner', 'viewer'] as const;
type Role = (typeof ROLES)[number];

export function RoleSelect({ userId, currentRole }: { userId: string; currentRole: Role }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState<Role>(currentRole);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Role;
    if (next === value) return;
    setError(null);
    setValue(next);
    startTransition(async () => {
      const result = await changeAgentosRole({ user_id: userId, app_role: next });
      if ('error' in result && result.error) {
        setError(result.error);
        setValue(currentRole); // revert
      }
    });
  }

  const roleSelectTestId = 'role-select-' + userId;

  return (
    <span className="inline-flex flex-col gap-xs">
      <Select
        value={value}
        onChange={handleChange}
        disabled={pending}
        data-testid={roleSelectTestId}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Select>
      {error && (
        <span
          className="text-destructive text-[12px]"
          data-testid={`role-error-${userId}`}
        >
          {error}
        </span>
      )}
    </span>
  );
}
