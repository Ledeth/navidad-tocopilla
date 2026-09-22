// ============================================================================
//  Rutas de la aplicación.
// ============================================================================
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import { SesionProvider, useSesion } from './contexto/SesionProvider'
import { NotificacionProvider } from './contexto/NotificacionProvider'
import { Layout } from './componentes/Layout'
import { RutaProtegida } from './componentes/RutaProtegida'
import { Alerta } from './componentes/ui'
import { supabaseConfigurado } from './lib/supabase'

import { Portada } from './paginas/publico/Portada'
import { Ingresar } from './paginas/publico/Ingresar'
import { Registro } from './paginas/publico/Registro'
import { NuevaClave } from './paginas/publico/NuevaClave'
import { Privacidad } from './paginas/publico/Privacidad'

import { MiPostulacion } from './paginas/tutor/MiPostulacion'
import { DatosTutor } from './paginas/tutor/DatosTutor'
import { BeneficiarioForm } from './paginas/tutor/BeneficiarioForm'

import { Dashboard } from './paginas/funcionario/Dashboard'
import { Postulaciones } from './paginas/funcionario/Postulaciones'
import { DetallePostulacion } from './paginas/funcionario/DetallePostulacion'
import { Listados } from './paginas/funcionario/Listados'
import { Entregas } from './paginas/funcionario/Entregas'

import { Usuarios } from './paginas/admin/Usuarios'
import { Configuracion } from './paginas/admin/Configuracion'
import { Importacion } from './paginas/admin/Importacion'
import { Auditoria } from './paginas/admin/Auditoria'

/** Aviso cuando faltan las variables de entorno de Supabase. */
function AvisoConfiguracion() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <Alerta tipo="error" titulo="Falta configurar Supabase">
        Copie el archivo <code>.env.example</code> a <code>.env</code> y complete
        <code> VITE_SUPABASE_URL</code> y <code> VITE_SUPABASE_ANON_KEY</code>. Luego reinicie el servidor.
      </Alerta>
    </div>
  )
}

function NoEncontrada() {
  const { perfil } = useSesion()
  return (
    <div className="mx-auto max-w-xl">
      <Alerta tipo="aviso" titulo="Página no encontrada">
        La dirección que abrió no existe.{' '}
        <a href={perfil ? (perfil.rol === 'tutor' ? '/tutor' : '/panel') : '/'} className="font-semibold underline">
          Volver al inicio
        </a>
      </Alerta>
    </div>
  )
}

export default function App() {
  if (!supabaseConfigurado) return <AvisoConfiguracion />

  return (
    <BrowserRouter>
      <NotificacionProvider>
        <SesionProvider>
          <Layout>
            <Routes>
              {/* Públicas */}
              <Route path="/" element={<Portada />} />
              <Route path="/ingresar" element={<Ingresar />} />
              <Route path="/registro" element={<Registro />} />
              <Route path="/nueva-clave" element={<NuevaClave />} />
              <Route path="/privacidad" element={<Privacidad />} />

              {/* Tutor */}
              <Route path="/tutor" element={
                <RutaProtegida roles={['tutor', 'funcionario', 'admin']}><MiPostulacion /></RutaProtegida>
              } />
              <Route path="/tutor/datos" element={
                <RutaProtegida roles={['tutor', 'funcionario', 'admin']}><DatosTutor /></RutaProtegida>
              } />
              <Route path="/tutor/beneficiarios/nuevo" element={
                <RutaProtegida roles={['tutor', 'funcionario', 'admin']}><BeneficiarioForm /></RutaProtegida>
              } />
              <Route path="/tutor/beneficiarios/:id" element={
                <RutaProtegida roles={['tutor', 'funcionario', 'admin']}><BeneficiarioForm /></RutaProtegida>
              } />

              {/* Panel municipal */}
              <Route path="/panel" element={
                <RutaProtegida roles={['funcionario', 'admin']}><Dashboard /></RutaProtegida>
              } />
              <Route path="/panel/postulaciones" element={
                <RutaProtegida roles={['funcionario', 'admin']}><Postulaciones /></RutaProtegida>
              } />
              <Route path="/panel/postulaciones/:id" element={
                <RutaProtegida roles={['funcionario', 'admin']}><DetallePostulacion /></RutaProtegida>
              } />
              <Route path="/panel/listados" element={
                <RutaProtegida roles={['funcionario', 'admin']}><Listados /></RutaProtegida>
              } />
              <Route path="/panel/entregas" element={
                <RutaProtegida roles={['funcionario', 'admin']}><Entregas /></RutaProtegida>
              } />

              {/* Administración */}
              <Route path="/admin" element={<Navigate to="/admin/usuarios" replace />} />
              <Route path="/admin/usuarios" element={
                <RutaProtegida roles={['admin']}><Usuarios /></RutaProtegida>
              } />
              <Route path="/admin/configuracion" element={
                <RutaProtegida roles={['admin']}><Configuracion /></RutaProtegida>
              } />
              <Route path="/admin/importacion" element={
                <RutaProtegida roles={['admin']}><Importacion /></RutaProtegida>
              } />
              <Route path="/admin/auditoria" element={
                <RutaProtegida roles={['admin']}><Auditoria /></RutaProtegida>
              } />

              <Route path="*" element={<NoEncontrada />} />
            </Routes>
          </Layout>
        </SesionProvider>
      </NotificacionProvider>
    </BrowserRouter>
  )
}
