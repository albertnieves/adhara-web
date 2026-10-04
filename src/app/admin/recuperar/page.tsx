import Link from 'next/link';
import { AuthError, AuthScreen } from '@/modules/admin';
import { requestPasswordRecovery } from '@/modules/auth/server/recovery';
import { buttonClass, Field, Input } from '@/components/ui';

export default async function Recovery({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthScreen title="Recuperar acceso">
      <p className="text-fg-muted text-sm">
        Te enviaremos un enlace para fijar una contraseña nueva. La verificación
        en dos pasos seguirá siendo necesaria.
      </p>
      {params.error && (
        <AuthError>
          {params.error === 'email'
            ? 'Escribe un email válido.'
            : 'El acceso no está disponible en este momento.'}
        </AuthError>
      )}
      {params.enviado ? (
        <p role="status">
          Si la cuenta puede recuperar el acceso, recibirás un enlace por
          correo. Revisa también la carpeta de spam.
        </p>
      ) : (
        <form action={requestPasswordRecovery} className="flex flex-col gap-5">
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <button type="submit" className={buttonClass('primary', 'lg')}>
            Enviar enlace
          </button>
        </form>
      )}
      <Link href="/admin/acceso" className="link-underline text-sm">
        Volver al acceso
      </Link>
    </AuthScreen>
  );
}
