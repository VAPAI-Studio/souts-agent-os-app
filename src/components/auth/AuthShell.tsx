import * as React from 'react';
import { Card, CardBody } from '@/components/ui/Card';

export interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <main className="flex-1 flex items-center justify-center bg-surface px-md py-xl">
      <div className="w-full max-w-[380px] flex flex-col gap-lg">
        <header className="flex flex-col items-center gap-xs">
          <h1 className="font-mono text-[15px] font-medium tracking-tight text-text">
            AgentOS
          </h1>
          <span className="font-mono text-[11px] text-text-muted">
            v0.1 · internal
          </span>
        </header>

        <Card>
          <CardBody className="flex flex-col gap-md">
            <div className="flex flex-col gap-xs">
              <h2 className="text-[15px] font-medium text-text leading-tight">
                {title}
              </h2>
              {subtitle && (
                <p className="text-[13px] text-text-muted leading-snug">
                  {subtitle}
                </p>
              )}
            </div>
            {children}
          </CardBody>
        </Card>

        {footer && (
          <p className="text-center text-[13px] text-text-muted">{footer}</p>
        )}
      </div>
    </main>
  );
}
