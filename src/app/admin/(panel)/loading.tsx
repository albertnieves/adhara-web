/** Mientras carga una sección del panel: estructura tenue, sin saltos. */
export default function PanelLoading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Cargando"
      className="animate-pulse"
    >
      <div className="border-line mb-10 border-b pb-8">
        <div className="bg-sand h-3 w-24" />
        <div className="bg-sand mt-4 h-10 w-72" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="panel-card h-32" />
        ))}
      </div>
    </div>
  );
}
