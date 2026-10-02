'use client';

import { FormMessage, SubmitButton, useAdminAction } from '@/modules/admin';
import { generateDailyReportNow } from '../server/actions';

/** Guarda el informe del día con el resumen del asistente. */
export function GenerateReportButton({
  day,
  label,
}: {
  day: string;
  label: string;
}) {
  const { state, pending, onSubmit } = useAdminAction(generateDailyReportNow);
  return (
    <form onSubmit={onSubmit} className="flex flex-col items-start gap-3">
      <input type="hidden" name="day" value={day} />
      <SubmitButton
        pending={pending}
        pendingLabel="Preparando el informe…"
        variant="ghost"
      >
        {label}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
