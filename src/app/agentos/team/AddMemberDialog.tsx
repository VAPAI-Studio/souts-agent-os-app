'use client';

import { useState, useTransition } from 'react';
import { grantAgentosRole, searchAuthUsers } from './actions';

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
      <button onClick={() => setOpen(true)} data-testid="open-add-member">
        Add team member
      </button>
    );
  }

  return (
    <div role="dialog" data-testid="add-member-dialog" style={{ border: '1px solid #ccc', padding: '1rem', marginTop: '1rem' }}>
      <h2>Grant agentos role</h2>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email (3+ chars)"
          data-testid="search-email"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch();
            }
          }}
        />
        <button onClick={handleSearch} disabled={pending} data-testid="search-submit">Search</button>
      </div>
      {error && <p style={{ color: 'red' }} data-testid="add-member-error">{error}</p>}
      <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
        {results.map((u) => (
          <li key={u.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid #eee' }} data-testid={`search-result-${u.id}`}>
            <strong>{u.email}</strong>
            <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.25rem' }}>
              {ROLES.map((r) => (
                <button
                  key={r}
                  disabled={pending}
                  onClick={() => handleGrant(u.id, r)}
                  data-testid={`grant-${u.id}-${r}`}
                >
                  Grant {r}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <button onClick={() => setOpen(false)} style={{ marginTop: '1rem' }}>Cancel</button>
    </div>
  );
}
