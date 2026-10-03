import {
  Checkbox,
  Field,
  Fieldset,
  Input,
  Radio,
  SearchField,
  Select,
  Text,
  Textarea,
} from '@/components/ui';
import { FormPlayground } from '../FormPlayground';
import { Example } from '../Example';
import { SubTitle } from '../Section';

/**
 * Formularios (Fase 2, DS-07): cada control con sus estados. Los nombres
 * llevan el prefijo `demo-` y nada se envía.
 */
export function FormComponents() {
  return (
    <div id="formularios" className="scroll-mt-8">
      <SubTitle>Field</SubTitle>
      <Text size="small" tone="muted" className="mb-4 max-w-3xl">
        Etiqueta, control, ayuda y error. Field une la etiqueta con el control y
        le pone aria-describedby (primero el error, luego la ayuda) y, si hay
        error, aria-invalid. Todos los controles miden 44 px y usan letra de 16
        px para que el móvil no amplíe la página.
      </Text>
      <ul className="divide-border border-border divide-y border-y">
        <Example
          code={'<Field label hint><Input /></Field>'}
          use="Con ayuda bajo el control."
        >
          <Field label="Nombre" hint="Como figura en el pedido.">
            <Input name="demo-nombre" autoComplete="off" />
          </Field>
        </Example>
        <Example
          code={'<Field label error>'}
          use="Error: borde rojo, icono y mensaje; el control queda inválido."
        >
          <Field label="Correo" error="Escribe un correo con @ y dominio.">
            <Input
              type="email"
              name="demo-correo"
              defaultValue="nombre.ejemplo"
              autoComplete="off"
            />
          </Field>
        </Example>
        <Example
          code={'<Input disabled>'}
          use="Deshabilitado: fuera del tabulador y atenuado."
        >
          <Field label="Referencia" hint="La asigna el sistema.">
            <Input name="demo-referencia" defaultValue="Bloqueado" disabled />
          </Field>
        </Example>
        <Example
          code={'<Input readOnly>'}
          use="Solo lectura: se enfoca y se copia, no se edita. Fondo hundido y borde discontinuo."
        >
          <Field label="Creado">
            <Input name="demo-creado" defaultValue="03/10/2026" readOnly />
          </Field>
        </Example>
        <Example
          code={'<Textarea rows={4}>'}
          use="Varias líneas; crece solo en vertical."
        >
          <Field label="Nota interna" hint="Solo la ve el equipo.">
            <Textarea name="demo-nota" />
          </Field>
        </Example>
        <Example
          code={'<Select>'}
          use="Desplegable nativo: teclado y lista del sistema en el móvil."
        >
          <Field label="Idioma">
            <Select name="demo-idioma" defaultValue="es">
              <option value="es">Español</option>
              <option value="ca">Català</option>
              <option value="en">English</option>
            </Select>
          </Field>
        </Example>
      </ul>
      <SubTitle>Checkbox y Radio</SubTitle>
      <Text size="small" tone="muted" className="mb-4 max-w-3xl">
        Caja de 24 px dibujada con los semánticos y toda la etiqueta como
        objetivo táctil de 44 px. Espacio marca la casilla; en un grupo de
        radios, las flechas cambian la elección y Tab sale del grupo.
      </Text>
      <ul className="divide-border border-border divide-y border-y">
        <Example
          code={'<Checkbox label hint>'}
          use="Casillas: sin marcar, marcada, con ayuda, con error y deshabilitada."
        >
          <div className="flex flex-col">
            <Checkbox name="demo-aviso" label="Avisarme por correo" />
            <Checkbox
              name="demo-marcada"
              label="Mostrar en la portada"
              defaultChecked
            />
            <Checkbox
              name="demo-ayuda"
              label="Destacar en la colección"
              hint="Aparece primero en su línea."
            />
            <Checkbox
              name="demo-error"
              label="Confirmo la revisión"
              error="Marca la casilla para seguir."
            />
            <Checkbox name="demo-off" label="No disponible" disabled />
          </div>
        </Example>
        <Example
          code={'<Fieldset legend><Radio name … /></Fieldset>'}
          use="Grupo con leyenda; una opción deshabilitada."
        >
          <Fieldset legend="Vista" hint="Cambia cómo se presenta la lista.">
            <Radio
              name="demo-vista"
              value="tabla"
              label="Tabla"
              defaultChecked
            />
            <Radio name="demo-vista" value="tarjetas" label="Tarjetas" />
            <Radio name="demo-vista" value="mapa" label="Mapa" disabled />
          </Fieldset>
        </Example>
      </ul>
      <SubTitle>SearchField</SubTitle>
      <ul className="divide-border border-border divide-y border-y">
        <Example
          code={'<SearchField label placeholder>'}
          use="Lupa y nombre propio para el lector de pantalla; la usa el panel en catálogo e inventario."
        >
          <SearchField
            name="demo-buscar"
            label="Buscar en la demostración"
            placeholder="Buscar…"
          />
        </Example>
        <Example
          code={'<SearchField pending>'}
          use="Mientras llegan los resultados, la estrella titila."
        >
          <SearchField
            name="demo-buscando"
            label="Búsqueda en curso"
            defaultValue="ámbar"
            pending
          />
        </Example>
      </ul>
      <SubTitle>Prueba con teclado</SubTitle>
      <Text size="small" tone="muted" className="mb-4 max-w-3xl">
        Al validar, cada error sale bajo su campo y el foco va al primero que
        falla.
      </Text>
      <FormPlayground />
    </div>
  );
}
