# Navidad 2026 · Ilustre Municipalidad de Tocopilla

Plataforma web de **inscripción de tutores y registro de beneficiarios** para la entrega municipal
de regalos de Navidad. Incluye el portal público, el panel de las funcionarias y funcionarios
municipales y la administración del proceso.

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS 4 + React Router
- **Backend:** Supabase (Auth, Postgres con RLS, Storage privado y Edge Functions)
- **Deploy:** Vercel (frontend) + Supabase (backend)
- **Librerías:** SheetJS (`xlsx`), jsPDF + jspdf-autotable, `qrcode`, react-hook-form + zod,
  Cloudflare Turnstile

Todo el sistema —interfaz, mensajes, correos y documentos— está en español de Chile.

---

## 1. Qué hace el sistema

| Rol | Puede |
|---|---|
| **tutor** (vecino) | Registrarse, cargar su cartola RSH, inscribir a sus hijas e hijos, adjuntar documentos, ver el estado y la línea de tiempo de su postulación, corregir y reenviar |
| **funcionario** | Ver el dashboard, revisar postulaciones, aprobar / rechazar / observar (con motivo), registrar observaciones y opinión profesional, exportar a Excel y PDF, imprimir fichas de retiro, registrar entregas |
| **admin** | Todo lo anterior + crear y administrar usuarios internos, configurar el proceso, importación masiva, respaldo completo y bitácora de auditoría |

Reglas principales que el sistema aplica **en el servidor** (no solo en el navegador):

- RUT chileno validado con dígito verificador (módulo 11); **RUT de tutor único** y **RUT de beneficiario único a nivel global**.
- Tutores chilenos: tramo RSH y cartola obligatorios. Tutores extranjeros: campos de RSH ocultos y deshabilitados; se identifican con RUT chileno o documento extranjero.
- Edad máxima configurable (por defecto 12 años al 25-12-2026); fuera del rango, se bloquea la inscripción.
- Fuera del período de postulación el formulario público avisa y no permite inscribir.
- Documentos: solo PDF, JPG o PNG, máximo 5 MB, en un bucket **privado** con URLs firmadas de 5 minutos.
- Folio correlativo `NAV-2026-000123` generado automáticamente al aprobar.
- Una sola entrega por beneficiario (restricción `UNIQUE` + validación por trigger).
- Bitácora `audit_log` alimentada por triggers de Postgres.

---

## 2. Puesta en marcha (pasos exactos)

### a. Crear el proyecto en Supabase

1. Entre a <https://supabase.com/dashboard> y cree un proyecto (región sugerida: `South America (São Paulo)`).
2. Guarde la contraseña de la base de datos que le pide el asistente.
3. En **Project Settings → API** copie:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` → `VITE_SUPABASE_ANON_KEY`
   - `service_role` → **solo** para las Edge Functions y los scripts locales. **Nunca** en el frontend.

### b. Aplicar las migraciones y el seed

Opción 1 — con la CLI de Supabase (recomendada):

```bash
npm install -g supabase
supabase login
supabase link --project-ref <ref-del-proyecto>
supabase db push                       # aplica supabase/migrations/*.sql en orden
psql "$DATABASE_URL" -f supabase/seed.sql   # datos de demostración
```

Opción 2 — desde el SQL Editor del panel de Supabase: pegue y ejecute, en este orden,
`supabase/migrations/0001_esquema.sql`, `0002_funciones_triggers.sql`, `0003_rls.sql` y,
si quiere la demo, `supabase/seed.sql`.

`DATABASE_URL` está en **Project Settings → Database → Connection string → URI**.

> El seed **borra** tutores, beneficiarios, documentos, observaciones, entregas y auditoría.
> No lo ejecute en producción con datos reales.

### c. Configurar Storage y Auth

**Storage.** La migración `0003_rls.sql` ya crea el bucket privado `documentos` con límite de 5 MB
y los tipos PDF/JPG/PNG, junto con sus políticas. Solo verifique en **Storage → documentos** que
aparezca como *Private*.

**Auth** (**Authentication → Providers / Settings**):

1. **Email** habilitado, con *Confirm email*:
   - **Desactivado** para la demostración: el vecino entra de inmediato tras registrarse.
   - **Activado** en producción: la aplicación muestra el aviso «revise su correo» y completa el
     registro después de la confirmación (pantalla *Completar mis datos*).
2. **Site URL**: la URL de Vercel (por ejemplo `https://navidad-tocopilla.vercel.app`).
3. **Redirect URLs**: agregue `https://<su-dominio>/ingresar` y `https://<su-dominio>/nueva-clave`
   (y `http://localhost:5173/*` para desarrollo).
4. En **Email Templates** puede traducir al español los correos de confirmación y de recuperación.

### d. Configurar Cloudflare Turnstile

1. En <https://dash.cloudflare.com/?to=/:account/turnstile> cree un *site* con su dominio
   (agregue también `localhost` para desarrollo).
2. Copie la **Site Key** a `VITE_TURNSTILE_SITE_KEY` y la **Secret Key** al secreto de las funciones:

```bash
supabase secrets set TURNSTILE_SECRET_KEY=0x4AAAAAAA...
supabase functions deploy verificar-turnstile     # pública: no exige JWT
supabase functions deploy crear-usuario-interno   # exige JWT y valida que sea admin
```

Claves de prueba de Cloudflare: site key `1x00000000000000000000AA` y secret `1x0000000000000000000000000000000AA`
(siempre aprueban). Si deja `VITE_TURNSTILE_SITE_KEY` vacía, el widget no se muestra y el formulario
sigue funcionando: útil solo para desarrollo local.

### e. Deploy en Vercel

1. <https://vercel.com/new> → importe este repositorio.
2. Framework: *Vite* (se detecta solo). Build: `npm run build`. Output: `dist`.
3. **Environment Variables**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_TURNSTILE_SITE_KEY` y `VITE_MODO_DEMO` (`true` para la demostración, `false` en producción).
4. Deploy. El archivo `vercel.json` ya redirige todas las rutas a `index.html` (SPA).
5. Vuelva a Supabase y ponga la URL de Vercel en **Site URL** y **Redirect URLs**.

### f. Crear los usuarios demo

El seed ya crea las tres cuentas (contraseña **`Demo2026!`**):

| Rol | Correo |
|---|---|
| Tutor (vecino) | `tutor.demo@navidadtocopilla.cl` |
| Funcionario municipal | `funcionario.demo@navidadtocopilla.cl` |
| Administrador | `admin.demo@navidadtocopilla.cl` |

Aparecen en la pantalla de ingreso mientras `VITE_MODO_DEMO=true`.

Para los **documentos PDF de ejemplo** (se ven en la previsualización del panel):

```bash
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="..."
node scripts/documentos-demo.mjs
```

En producción, el **primer administrador** se crea así: registre la cuenta desde el formulario
público y luego, en el SQL Editor, ejecute
`update public.profiles set rol = 'admin' where email = 'correo@municipalidadtocopilla.cl';`.
Desde ahí, el resto de los usuarios internos se crean en **Admin → Usuarios**.

---

## 3. Desarrollo local

```bash
cp .env.example .env     # complete VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev              # http://localhost:5173
npm test                 # pruebas de RUT, edades, validaciones, Excel y PDF
npm run typecheck        # TypeScript en modo estricto
npm run build            # build de producción
```

### Reiniciar los datos de demostración

```bash
export DATABASE_URL="postgresql://postgres:CLAVE@db.xxxx.supabase.co:5432/postgres"
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="..."
./scripts/reiniciar-demo.sh
```

`npm run seed:demo` regenera `supabase/seed.sql` (40 tutores, ~70 beneficiarios en todos los
estados, con RUT ficticios pero válidos) sin tocar la base de datos.

---

## 4. Estructura del proyecto

```
.
├── src/
│   ├── componentes/        Layout, controles de interfaz, documentos, Turnstile, rutas protegidas
│   ├── contexto/           Sesión (usuario, rol, configuración) y avisos
│   ├── lib/                RUT, formato, validaciones (zod), consultas, Storage, Excel y PDF
│   └── paginas/
│       ├── publico/        Portada, ingreso, registro, nueva clave, privacidad
│       ├── tutor/          Mi postulación, datos del tutor, beneficiarios
│       ├── funcionario/    Dashboard, postulaciones, detalle, listados, entregas
│       └── admin/          Usuarios, configuración y respaldo, importación, auditoría
├── supabase/
│   ├── migrations/         0001 esquema · 0002 funciones y triggers · 0003 RLS y Storage
│   ├── functions/          verificar-turnstile · crear-usuario-interno
│   └── seed.sql            datos de demostración (generado)
└── scripts/                generar-seed · documentos-demo · reiniciar-demo · pruebas
```

### Modelo de datos

`profiles` (rol de cada cuenta) · `tutores` · `beneficiarios` (con estado, motivo y folio) ·
`documentos` (metadatos del bucket privado) · `observaciones` (observación y opinión profesional) ·
`entregas` · `configuracion` (fila única) · `audit_log`. La vista `v_postulaciones` une
beneficiario + tutor + entrega y respeta las políticas de quien consulta (`security_invoker`).

---

## 5. Seguridad

- **RLS en todas las tablas.** El tutor solo ve y edita sus propios registros y no puede cambiar el
  estado de su postulación; el funcionario lee todo y edita estados, observaciones y entregas; solo
  el admin gestiona usuarios, configuración y auditoría.
- **La service role key nunca llega al navegador.** La creación de usuarios internos ocurre en la
  Edge Function `crear-usuario-interno`, que primero verifica con el JWT de quien llama que sea un
  administrador activo.
- **El rol se fuerza en la base de datos.** El trigger sobre `auth.users` siempre crea el perfil como
  `tutor`, así nadie puede elevarse enviando metadatos en el registro.
- **Bucket privado.** Los archivos solo se leen mediante URLs firmadas de 5 minutos, y las políticas
  de Storage comparan la carpeta (`{tutor_id}/…`) con el tutor del usuario autenticado.
- **CAPTCHA verificado en el servidor** (`verificar-turnstile`), entradas sanitizadas y límite de
  frecuencia de envío en el formulario de registro.
- **Auditoría** de altas, cambios y eliminaciones con autor, fecha, valor anterior y valor nuevo.

## 6. Accesibilidad y compatibilidad

Etiquetas en todos los campos, errores anunciados con `role="alert"`, foco visible, enlace para
saltar al contenido, tablas con `caption` y encabezados, contraste AA y diseño móvil primero.
Probado sobre navegadores Chromium (Chrome y Edge), Firefox y Safari; la lectura de códigos QR con
la cámara usa `BarcodeDetector` donde está disponible y, si no, se ingresa el folio a mano o con un
lector externo.

## 7. Datos personales

El tratamiento de datos se rige por la Ley N° 19.628 y la Ley N° 21.719. La aplicación pide
consentimiento expreso en la inscripción y publica la política de privacidad en `/privacidad`.
Los datos de la demostración son ficticios.
