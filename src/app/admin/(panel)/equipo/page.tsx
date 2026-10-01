import { cancelInvite } from '@/modules/auth/server/invitations';
import type { Metadata } from 'next';
import { PageHeader, describeDbError } from '@/modules/admin';
import { ROLE_LABELS, STAFF_ROLES } from '@/modules/auth';
import type { StaffRole } from '@/modules/auth';
import { requirePermission } from '@/modules/auth/server';
import { GrantStaffForm, StaffToggle } from '@/modules/auth/ui/staff-forms';

export const metadata: Metadata = { title: 'Equipo' };

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeZone: 'Europe/Madrid',
});

export default async function Team() {
  const staff = await requirePermission('staff.manage');
  const [{ data, error }, invites] = await Promise.all([
    staff.supabase.rpc('admin_list_staff'),
    staff.supabase.rpc('admin_pending_invites'),
  ]);
  return (
    <main>
      <PageHeader eyebrow="Equipo" title="Personal con acceso" />
      {error ? (
        <p role="alert" className="text-danger">
          {describeDbError(error)}
        </p>
      ) : (
        <div className="mb-14 overflow-x-auto">
          <table className="data-table min-w-[40rem]">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Rol</th>
                <th>Último acceso</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((member) => (
                <tr
                  key={member.user_id}
                  className={member.active ? '' : 'opacity-50'}
                >
                  <td>
                    <p>{member.display_name ?? member.email}</p>
                    {member.display_name && (
                      <p className="text-smoke text-xs">{member.email}</p>
                    )}
                  </td>
                  <td className="text-sm">
                    {STAFF_ROLES.includes(member.role as StaffRole)
                      ? ROLE_LABELS[member.role as StaffRole]
                      : member.role}
                    {!member.active && ' · desactivado'}
                  </td>
                  <td className="text-smoke text-sm">
                    {member.last_sign_in_at
                      ? DATE.format(new Date(member.last_sign_in_at))
                      : 'Nunca'}
                  </td>
                  <td>
                    {member.user_id !== staff.userId && (
                      <StaffToggle
                        userId={member.user_id}
                        active={member.active}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <section className="mb-10 space-y-5">
        <h2 className="text-2xl">Invitar a una persona</h2>
        <p className="text-smoke text-sm">
          Recibirá un enlace para fijar contraseña y configurar MFA. Para
          reenviar, introduce de nuevo los mismos datos; espera al menos un
          minuto.
        </p>
        <GrantStaffForm invite />
        {invites.error ? (
          <p role="alert">No se pudieron leer las invitaciones.</p>
        ) : (
          invites.data.map((invite) => (
            <div
              key={invite.email}
              className="panel-card flex flex-wrap items-center justify-between gap-3"
            >
              <p>
                {invite.email} · {invite.role} · pendiente de aceptación
              </p>
              <form action={cancelInvite}>
                <input type="hidden" name="email" value={invite.email} />
                <button className="btn btn-outline">
                  Cancelar acceso pendiente
                </button>
              </form>
            </div>
          ))
        )}
      </section>
      <h2 className="mb-3 text-2xl font-light">
        Dar acceso a una cuenta existente
      </h2>
      <p className="text-smoke mb-6 max-w-2xl text-sm leading-relaxed">
        La cuenta debe existir antes en Supabase (Authentication → Users → Add
        user). Aquí se le asigna el rol; en su primer acceso configurará la
        verificación en dos pasos.
      </p>
      <GrantStaffForm />
    </main>
  );
}
