import { ROLE_LABELS, ROLE_PERMISSIONS } from '@/modules/auth';
import { requireStaff } from '@/modules/auth/server';

export default async function AdminHome() {
  const staff = await requireStaff();
  return (
    <main>
      <h1>Panel de administración</h1>
      <p className="mb-4">
        Acceso verificado como {ROLE_LABELS[staff.role]}. Las secciones se
        activarán por fases (docs/ADMIN_PLAN.md).
      </p>
      <h2 className="mb-2 font-semibold">Tus permisos</h2>
      <ul className="list-disc pl-6">
        {[...ROLE_PERMISSIONS[staff.role]].map((permission) => (
          <li key={permission}>
            <code>{permission}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}
