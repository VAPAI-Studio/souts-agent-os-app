'use client';

import { useState, useTransition } from 'react';
import { changeAgentosRole } from './actions';

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

  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.25rem' }}>
      <select
        value={value}
        onChange={handleChange}
        disabled={pending}
        data-testid={`role-select-${userId}`}
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {error && <span style={{ color: 'red', fontSize: '0.75rem' }} data-testid={`role-error-${userId}`}>{error}</span>}
    </span>
  );
}
