'use client';

import { useEffect } from 'react';
import { reportDiagnostic } from '@/lib/diagnostics';

function scalarFields(value: unknown): { name?: string; message?: string } {
  if (typeof value !== 'object' || value === null) {
    return {};
  }
  const record = value as { name?: unknown; message?: string };
  const fields: { name?: string; message?: string } = {};
  if (typeof record.name === 'string') {
    fields.name = record.name;
  }
  if (typeof record.message === 'string') {
    fields.message = record.message;
  }
  return fields;
}

/**
 * Forwards window `error` and `unhandledrejection` to the diagnostic log.
 * Renders nothing. Does not cancel the browser's default handling.
 *
 * @returns null
 */
export function DiagnosticsListener(): null {
  useEffect(() => {
    const path = window.location.pathname;
    const onError = (event: ErrorEvent): void => {
      reportDiagnostic({
        event: 'client.unhandled',
        stage: 'unhandled',
        path,
        ...scalarFields(event.error),
      });
    };
    const onRejection = (event: PromiseRejectionEvent): void => {
      reportDiagnostic({
        event: 'client.unhandled',
        stage: 'unhandled',
        path,
        ...scalarFields(event.reason),
      });
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
