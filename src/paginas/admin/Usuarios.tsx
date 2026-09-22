// ============================================================================
//  Módulo 5 — Administración de usuarios internos (funcionario / admin).
//  Todas las operaciones pasan por la Edge Function "crear-usuario-interno",
//  que es la única que usa la service role key.
// ============================================================================
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { esquemaUsuarioInterno } from '../../lib/validaciones'
import { supabase, mensajeError } from '../../lib/supabase'
import { fechaHora } from '../../lib/formato'
import { useSesion } from '../../contexto/SesionProvider'
import { useNotificacion } from '../../contexto/NotificacionProvider'
import {
  Alerta, Boton, Campo, Cargando, Entrada, Insignia, Modal, Selector, Tarjeta, Vacio,
} from '../../componentes/ui'
import type { Perfil } from '../../lib/tipos'

type DatosUsuario = z.infer<typeof esquemaUsuarioInterno>

/** Llama a la Edge Function de gestión de usuarios internos. */
async function gestionarUsuario(cuerpo: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('crear-usuario-interno', { body: cuerpo })
  if (error) {
    // La función devuelve el detalle del problema en el cuerpo de la respuesta.
    const detalle = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(detalle?.error ?? error.message)
  }
  if (data?.error) throw new Error(String(data.error))
  return data as Record<string, unknown>
}

export function Usuarios() {
  const { perfil } = useSesion()
  const { exito, error: avisarError } = useNotificacion()

  const [usuarios, setUsuarios] = useState<Perfil[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [passwordTemporal, setPasswordTemporal] = useState('')

  const { register, handleSubmit, reset, formState: { errors } } = useForm<DatosUsuario>({
    resolver: zodResolver(esquemaUsuarioInterno),
    defaultValues: { rol: 'funcionario' },
  })

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const { data, error: errorConsulta } = await supabase
        .from('profiles').select('*').in('rol', ['funcionario', 'admin']).order('created_at')
      if (errorConsulta) throw errorConsulta
      setUsuarios((data ?? []) as Perfil[])
      setError('')
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  const crear = async (datos: DatosUsuario) => {
    setGuardando(true)
    setPasswordTemporal('')
    try {
      const respuesta = await gestionarUsuario({
        accion: 'crear',
        email: datos.email,
        nombre: datos.nombre,
        rol: datos.rol,
        password: datos.password || undefined,
      })
      if (respuesta.password_temporal) setPasswordTemporal(String(respuesta.password_temporal))
      exito('Usuario interno creado.')
      reset({ rol: 'funcionario', nombre: '', email: '', password: '' })
      setAbierto(false)
      await cargar()
    } catch (e) {
      avisarError(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  const cambiarActivacion = async (usuario: Perfil) => {
    const accionTexto = usuario.activo ? 'desactivar' : 'activar'
    if (!window.confirm(`¿Desea ${accionTexto} la cuenta de ${usuario.nombre || usuario.email}?`)) return
    try {
      await gestionarUsuario({ accion: 'actualizar', user_id: usuario.id, activo: !usuario.activo })
      exito(`Cuenta ${usuario.activo ? 'desactivada' : 'activada'}.`)
      await cargar()
    } catch (e) {
      avisarError(mensajeError(e))
    }
  }

  const cambiarRol = async (usuario: Perfil, rol: string) => {
    try {
      await gestionarUsuario({ accion: 'actualizar', user_id: usuario.id, rol })
      exito('Rol actualizado.')
      await cargar()
    } catch (e) {
      avisarError(mensajeError(e))
      await cargar()
    }
  }

  const restablecerClave = async (usuario: Perfil) => {
    if (!window.confirm(`¿Generar una contraseña temporal para ${usuario.email}?`)) return
    try {
      const respuesta = await gestionarUsuario({ accion: 'password', user_id: usuario.id })
      setPasswordTemporal(`${usuario.email}: ${respuesta.password_temporal}`)
      exito('Contraseña temporal generada.')
    } catch (e) {
      avisarError(mensajeError(e))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Tarjeta
        titulo="Usuarios internos"
        descripcion="Funcionarias, funcionarios y administradores con acceso al panel municipal."
        acciones={<Boton onClick={() => setAbierto(true)}>Crear usuario</Boton>}
      >
        {error && <Alerta tipo="error">{error}</Alerta>}
        {passwordTemporal && (
          <div className="mb-4">
            <Alerta tipo="aviso" titulo="Contraseña temporal">
              <p className="break-all font-mono">{passwordTemporal}</p>
              <p className="mt-1 text-xs">
                Cópiela ahora y entréguela por un medio seguro: no volverá a mostrarse.
              </p>
            </Alerta>
          </div>
        )}

        {cargando ? <Cargando /> : !usuarios.length ? <Vacio mensaje="No hay usuarios internos." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-sm">
              <caption className="sr-only">Usuarios internos</caption>
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-2 pr-3">Nombre</th>
                  <th scope="col" className="py-2 pr-3">Correo</th>
                  <th scope="col" className="py-2 pr-3">Rol</th>
                  <th scope="col" className="py-2 pr-3">Estado</th>
                  <th scope="col" className="py-2 pr-3">Creado</th>
                  <th scope="col" className="py-2 pr-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100">
                    <td className="py-2.5 pr-3 font-semibold text-marino-900">
                      {u.nombre || '—'}
                      {u.id === perfil?.id && <span className="ml-2"><Insignia tono="azul">Usted</Insignia></span>}
                    </td>
                    <td className="py-2.5 pr-3 break-all">{u.email}</td>
                    <td className="py-2.5 pr-3">
                      <Selector
                        aria-label={`Rol de ${u.email}`}
                        value={u.rol}
                        disabled={u.id === perfil?.id}
                        onChange={(e) => cambiarRol(u, e.target.value)}
                      >
                        <option value="funcionario">Funcionario</option>
                        <option value="admin">Administrador</option>
                      </Selector>
                    </td>
                    <td className="py-2.5 pr-3">
                      {u.activo ? <Insignia tono="verde">Activa</Insignia> : <Insignia tono="rojo">Desactivada</Insignia>}
                    </td>
                    <td className="py-2.5 pr-3">{fechaHora(u.created_at)}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <Boton variante="secundario" onClick={() => restablecerClave(u)}>Contraseña</Boton>
                        <Boton
                          variante={u.activo ? 'peligro' : 'exito'}
                          disabled={u.id === perfil?.id}
                          onClick={() => cambiarActivacion(u)}
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </Boton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <Modal abierto={abierto} titulo="Crear usuario interno" onCerrar={() => setAbierto(false)}>
        <form onSubmit={handleSubmit(crear)} className="flex flex-col gap-4" noValidate>
          <Campo etiqueta="Nombre completo" requerido htmlFor="u-nombre" error={errors.nombre?.message}>
            <Entrada id="u-nombre" {...register('nombre')} />
          </Campo>
          <Campo etiqueta="Correo electrónico" requerido htmlFor="u-email" error={errors.email?.message}>
            <Entrada id="u-email" type="email" {...register('email')} />
          </Campo>
          <Campo etiqueta="Rol" requerido htmlFor="u-rol" error={errors.rol?.message}>
            <Selector id="u-rol" {...register('rol')}>
              <option value="funcionario">Funcionario</option>
              <option value="admin">Administrador</option>
            </Selector>
          </Campo>
          <Campo etiqueta="Contraseña inicial" htmlFor="u-clave" error={errors.password?.message}
                 ayuda="Opcional: si la deja vacía se generará una contraseña temporal.">
            <Entrada id="u-clave" type="text" autoComplete="off" {...register('password')} />
          </Campo>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <Boton type="submit" cargando={guardando}>Crear usuario</Boton>
            <Boton variante="secundario" type="button" onClick={() => setAbierto(false)}>Cancelar</Boton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
