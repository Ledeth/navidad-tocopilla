// ============================================================================
//  Componentes de interfaz reutilizables (accesibles y responsivos).
// ============================================================================
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { forwardRef, useEffect, useId, useRef } from 'react'
import type { Estado } from '../lib/tipos'
import { ETIQUETA_ESTADO } from '../lib/formato'

type Variante = 'primario' | 'secundario' | 'peligro' | 'fantasma' | 'exito'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-marino-800 text-white hover:bg-marino-700 disabled:bg-marino-300',
  secundario: 'bg-white text-marino-800 border border-marino-300 hover:bg-marino-50 disabled:text-marino-300',
  peligro: 'bg-navidad-500 text-white hover:bg-navidad-600 disabled:bg-navidad-200',
  exito: 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-emerald-300',
  fantasma: 'bg-transparent text-marino-800 hover:bg-marino-50',
}

export function Boton({
  variante = 'primario', cargando = false, className = '', children, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; cargando?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || cargando}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold
        transition-colors disabled:cursor-not-allowed ${VARIANTES[variante]} ${className}`}
    >
      {cargando && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
}

export function Tarjeta({ titulo, descripcion, acciones, children, className = '' }: {
  titulo?: ReactNode; descripcion?: ReactNode; acciones?: ReactNode; children?: ReactNode; className?: string
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(titulo || acciones) && (
        <header className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            {titulo && <h2 className="text-base font-bold text-marino-900 sm:text-lg">{titulo}</h2>}
            {descripcion && <p className="mt-1 text-sm text-slate-600">{descripcion}</p>}
          </div>
          {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
        </header>
      )}
      <div className="px-4 py-4 sm:px-6 sm:py-5">{children}</div>
    </section>
  )
}

/** Envoltorio de campo de formulario: etiqueta + ayuda + error accesible. */
export function Campo({ etiqueta, error, ayuda, requerido, children, htmlFor }: {
  etiqueta: string; error?: string; ayuda?: string; requerido?: boolean; children: ReactNode; htmlFor?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-marino-900">
        {etiqueta}
        {requerido && <span className="ml-1 text-navidad-500" aria-hidden="true">*</span>}
        {requerido && <span className="sr-only"> (obligatorio)</span>}
      </label>
      {children}
      {ayuda && !error && <p className="text-xs text-slate-500">{ayuda}</p>}
      {error && <p role="alert" className="text-xs font-medium text-navidad-600">{error}</p>}
    </div>
  )
}

const CLASE_CONTROL =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:border-navidad-500'

// Los tres controles reenvían la ref: react-hook-form la necesita para leer
// el valor del campo (sin ella, el formulario llega vacío al validador).
export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Entrada({ className = '', ...props }, ref) {
    return <input ref={ref} {...props} className={`${CLASE_CONTROL} ${className}`} />
  },
)

export const Selector = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Selector({ className = '', children, ...props }, ref) {
    return <select ref={ref} {...props} className={`${CLASE_CONTROL} ${className}`}>{children}</select>
  },
)

export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function AreaTexto({ className = '', ...props }, ref) {
    return <textarea ref={ref} {...props} className={`${CLASE_CONTROL} min-h-24 ${className}`} />
  },
)

const COLOR_ESTADO: Record<Estado, string> = {
  pendiente: 'bg-amber-100 text-amber-900 border-amber-300',
  aprobado: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  rechazado: 'bg-navidad-100 text-navidad-700 border-navidad-300',
  observado: 'bg-sky-100 text-sky-900 border-sky-300',
}

export function InsigniaEstado({ estado }: { estado: Estado }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${COLOR_ESTADO[estado]}`}>
      {ETIQUETA_ESTADO[estado]}
    </span>
  )
}

export function Insignia({ children, tono = 'neutro' }: { children: ReactNode; tono?: 'neutro' | 'azul' | 'rojo' | 'verde' }) {
  const tonos = {
    neutro: 'bg-slate-100 text-slate-700 border-slate-300',
    azul: 'bg-marino-100 text-marino-800 border-marino-300',
    rojo: 'bg-navidad-100 text-navidad-700 border-navidad-300',
    verde: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  }
  return <span className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${tonos[tono]}`}>{children}</span>
}

export function Alerta({ tipo = 'info', titulo, children }: {
  tipo?: 'info' | 'error' | 'exito' | 'aviso'; titulo?: string; children?: ReactNode
}) {
  const estilos = {
    info: 'border-marino-200 bg-marino-50 text-marino-900',
    error: 'border-navidad-300 bg-navidad-50 text-navidad-700',
    exito: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    aviso: 'border-amber-300 bg-amber-50 text-amber-900',
  }
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${estilos[tipo]}`}>
      {titulo && <p className="font-bold">{titulo}</p>}
      {children}
    </div>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-slate-600" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-marino-400 border-t-transparent" aria-hidden="true" />
      {texto}
    </div>
  )
}

export function Vacio({ mensaje }: { mensaje: string }) {
  return <p className="py-10 text-center text-sm text-slate-500">{mensaje}</p>
}

/** Ventana modal accesible (cierra con Escape y atrapa el foco inicial). */
export function Modal({ abierto, titulo, onCerrar, children, ancho = 'max-w-lg' }: {
  abierto: boolean; titulo: string; onCerrar: () => void; children: ReactNode; ancho?: string
}) {
  const id = useId()
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const alPresionar = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }
    document.addEventListener('keydown', alPresionar)
    contenedor.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alPresionar)
      document.body.style.overflow = ''
    }
  }, [abierto, onCerrar])

  if (!abierto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
      <div
        ref={contenedor}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${ancho}`}
      >
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 id={id} className="text-base font-bold text-marino-900">{titulo}</h2>
          <button onClick={onCerrar} aria-label="Cerrar" className="rounded p-1 text-2xl leading-none text-slate-500 hover:bg-slate-100">
            ×
          </button>
        </header>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

/** Gráfico de barras horizontal simple (sin dependencias externas). */
export function GraficoBarras({ datos, titulo }: { datos: { etiqueta: string; valor: number }[]; titulo: string }) {
  const maximo = Math.max(1, ...datos.map((d) => d.valor))
  return (
    <figure className="m-0">
      <figcaption className="mb-3 text-sm font-semibold text-marino-900">{titulo}</figcaption>
      <ul className="flex flex-col gap-2.5">
        {datos.map((d) => (
          <li key={d.etiqueta} className="grid grid-cols-[minmax(6.5rem,auto)_1fr_2.5rem] items-center gap-2 text-xs">
            <span className="truncate text-slate-700" title={d.etiqueta}>{d.etiqueta}</span>
            <span className="h-3 rounded-full bg-slate-100" aria-hidden="true">
              <span
                className="block h-3 rounded-full bg-marino-500"
                style={{ width: `${Math.round((d.valor / maximo) * 100)}%` }}
              />
            </span>
            <span className="text-right font-semibold text-marino-900">{d.valor}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

export function Indicador({ etiqueta, valor, tono = 'azul' }: {
  etiqueta: string; valor: number | string; tono?: 'azul' | 'rojo' | 'verde' | 'ambar' | 'gris'
}) {
  const tonos = {
    azul: 'border-marino-200 bg-marino-50 text-marino-900',
    rojo: 'border-navidad-200 bg-navidad-50 text-navidad-700',
    verde: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    ambar: 'border-amber-200 bg-amber-50 text-amber-900',
    gris: 'border-slate-200 bg-slate-50 text-slate-800',
  }
  return (
    <div className={`rounded-xl border px-4 py-3 ${tonos[tono]}`}>
      <p className="text-2xl font-bold tabular-nums">{valor}</p>
      <p className="mt-0.5 text-xs font-medium">{etiqueta}</p>
    </div>
  )
}

export function Paginacion({ pagina, totalPaginas, onCambiar }: {
  pagina: number; totalPaginas: number; onCambiar: (p: number) => void
}) {
  if (totalPaginas <= 1) return null
  return (
    <nav className="flex items-center justify-between gap-3 pt-4" aria-label="Paginación">
      <Boton variante="secundario" onClick={() => onCambiar(pagina - 1)} disabled={pagina <= 1}>Anterior</Boton>
      <p className="text-sm text-slate-600">Página {pagina} de {totalPaginas}</p>
      <Boton variante="secundario" onClick={() => onCambiar(pagina + 1)} disabled={pagina >= totalPaginas}>Siguiente</Boton>
    </nav>
  )
}
