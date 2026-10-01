'use client';

import {
  Field,
  FormMessage,
  SubmitButton,
  useAdminAction,
} from '@/modules/admin';
import { ROLE_LABELS } from '../domain/labels';
import { STAFF_ROLES } from '../domain/permissions';
import { inviteStaff } from '../server/invitations';
import { grantStaff, setStaffActive } from '../server/staff';

export function GrantStaffForm({ invite = false }: { invite?: boolean }) {
  const { state, pending, onSubmit } = useAdminAction(
    invite ? inviteStaff : grantStaff,
  );
  return (
    <form onSubmit={onSubmit} className="panel-card grid gap-4 md:grid-cols-3">
      <Field label="Email de la cuenta">
        <input name="email" type="email" required className="input" />
      </Field>
      <Field label="Nombre visible">
        <input name="displayName" maxLength={80} className="input" />
      </Field>
      <Field label="Rol">
        <select name="role" defaultValue="store_admin" className="input">
          {STAFF_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex flex-wrap items-center gap-3 md:col-span-3">
        <SubmitButton pending={pending}>
          {invite ? 'Enviar invitación' : 'Dar acceso'}
        </SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export function StaffToggle({
  userId,
  active,
}: {
  userId: string;
  active: boolean;
}) {
  const { state, pending, onSubmit } = useAdminAction(setStaffActive);
  return (
    <form onSubmit={onSubmit} className="flex items-center justify-end gap-3">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="active" value={active ? 'false' : 'true'} />
      <FormMessage state={state} />
      <SubmitButton
        variant={active ? 'danger' : 'ghost'}
        pending={pending}
        pendingLabel="…"
        className="min-h-9 px-3"
      >
        {active ? 'Desactivar' : 'Reactivar'}
      </SubmitButton>
    </form>
  );
}
