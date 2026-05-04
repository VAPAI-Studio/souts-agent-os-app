'use client';

import { useState, useTransition } from 'react';
import { grantAgentosRole, searchAuthUsers } from './actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

const ROLES = ['admin', 'member', 'agent_owner', 'viewer'] as const;
type Role = (typeof ROLES)[number];

export function AddMemberDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; email: string }>>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    setError(null);
    const result = await searchAuthUsers(query);
    if ('error' in result && result.error) setError(result.error);
    setResults(result.users ?? []);
  }

  function handleGrant(userId: string, role: Role) {
    startTransition(async () => {
      const result = await grantAgentosRole({ user_id: userId, app_role: role });
      if ('error' in result && result.error) {
        setError(result.error);
      } else {
        setOpen(false);
        setQuery('');
        setResults([]);
      }
    });
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        intent="secondary"
        size="sm"
        data-testid="open-add-member"
      >
        Add team member
      </Button>
    );
  }

  return (
    <Card
      role="dialog"
      aria-label="Grant agentos role"
      data-testid="add-member-dialog"
      className="p-md mt-md flex flex-col gap-sm"
    >
      <h2 className="text-[14px] font-semibold">Grant agentos role</h2>
      <div className="flex items-center gap-sm">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email (3+ chars)"
          className="flex-1"
          data-testid="search-email"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch();
            }
          }}
        />
        <Button
          onClick={handleSearch}
          intent="secondary"
          size="sm"
          disabled={pending}
          data-testid="search-submit"
        >
          Search
        </Button>
      </div>
      {error && (
        <p
          className="text-destructive text-[13px]"
          data-testid="add-member-error"
        >
          {error}
        </p>
      )}
      <ul className="list-none p-0 mt-md flex flex-col">
        {results.map((u) => (
          <li
            key={u.id}
            className="py-sm border-b border-border last:border-b-0"
            data-testid={`search-result-${u.id}`}
          >
            <strong>{u.email}</strong>
            <div className="mt-xs flex gap-xs flex-wrap">
              {ROLES.map((r) => (
                <Button
                  key={r}
                  intent="secondary"
                  size="sm"
                  disabled={pending}
                  onClick={() => handleGrant(u.id, r)}
                  data-testid={`grant-${u.id}-${r}`}
                >
                  Grant {r}
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <Button
        onClick={() => setOpen(false)}
        intent="ghost"
        size="sm"
        className="self-start mt-md"
      >
        Cancel
      </Button>
    </Card>
  );
}
