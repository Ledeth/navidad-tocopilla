-- ============================================================================
--  Navidad 2026 · Ilustre Municipalidad de Tocopilla
--  Migración 0001 — Esquema base: tipos, tablas, índices y restricciones
-- ============================================================================

create extension if not exists "pgcrypto";

-- ─── Tipos enumerados ───────────────────────────────────────────────────────
do $$ begin
  create type rol_usuario as enum ('tutor', 'funcionario', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type nacionalidad_tipo as enum ('chilena', 'extranjera');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sexo_tipo as enum ('femenino', 'masculino', 'otro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_postulacion as enum ('pendiente', 'aprobado', 'rechazado', 'observado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_documento as enum ('rsh', 'identidad', 'estudios', 'discapacidad');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_nota as enum ('observacion', 'opinion_profesional');
exception when duplicate_object then null; end $$;

-- ─── profiles ───────────────────────────────────────────────────────────────
-- Espejo de auth.users con el rol de la persona. Se crea automáticamente al
-- registrarse un vecino (ver trigger en 0003) o desde la Edge Function que
-- da de alta usuarios internos.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  nombre      text not null default '',
  rol         rol_usuario not null default 'tutor',
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists profiles_rol_idx on public.profiles (rol);

-- ─── tutores ────────────────────────────────────────────────────────────────
create table if not exists public.tutores (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid unique references public.profiles (id) on delete set null,
  nombre_completo       text not null,
  nacionalidad          nacionalidad_tipo not null,
  -- RUT normalizado sin puntos y con guión (ej. 12345678-9). Único: un tutor
  -- solo puede inscribirse una vez en el proceso.
  rut                   text unique,
  -- Documento de identidad extranjero (pasaporte, DNI, cédula de identidad
  -- para extranjeros). Solo para nacionalidad = 'extranjera'.
  documento_extranjero  text,
  telefono              text not null,
  email                 text not null,
  direccion             text not null,
  comuna                text not null default 'Tocopilla',
  -- Tramo del Registro Social de Hogares: 40, 50, 60, 70, 80, 90 o 100.
  -- Obligatorio solo para tutores chilenos.
  tramo_rsh             smallint,
  consentimiento        boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint tutores_identificacion_chk check (
    (nacionalidad = 'chilena'    and rut is not null)
    or
    (nacionalidad = 'extranjera' and (rut is not null or documento_extranjero is not null))
  ),
  constraint tutores_tramo_rsh_chk check (
    tramo_rsh is null or tramo_rsh in (40, 50, 60, 70, 80, 90, 100)
  ),
  -- Un tutor chileno debe declarar su tramo RSH.
  constraint tutores_rsh_obligatorio_chk check (
    nacionalidad <> 'chilena' or tramo_rsh is not null
  ),
  constraint tutores_consentimiento_chk check (consentimiento is true)
);
create index if not exists tutores_nacionalidad_idx on public.tutores (nacionalidad);
create index if not exists tutores_nombre_idx on public.tutores (lower(nombre_completo));

-- ─── Folios de retiro (NAV-2026-000123) ─────────────────────────────────────
create sequence if not exists public.folio_seq start 1;

-- ─── beneficiarios ──────────────────────────────────────────────────────────
create table if not exists public.beneficiarios (
  id                 uuid primary key default gen_random_uuid(),
  tutor_id           uuid not null references public.tutores (id) on delete cascade,
  -- Único a nivel global: un niño o niña no puede ser inscrito por dos tutores.
  rut                text not null unique,
  nombre_completo    text not null,
  sexo               sexo_tipo not null,
  fecha_nacimiento   date not null,
  discapacidad       boolean not null default false,
  observaciones      text,
  estado             estado_postulacion not null default 'pendiente',
  -- Motivo obligatorio cuando se rechaza u observa (ver constraint).
  motivo_estado      text,
  folio              text unique,
  revisado_por       uuid references public.profiles (id) on delete set null,
  revisado_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint beneficiarios_motivo_chk check (
    estado not in ('rechazado', 'observado')
    or (motivo_estado is not null and length(btrim(motivo_estado)) >= 5)
  )
);
create index if not exists beneficiarios_tutor_idx  on public.beneficiarios (tutor_id);
create index if not exists beneficiarios_estado_idx on public.beneficiarios (estado);
create index if not exists beneficiarios_nombre_idx on public.beneficiarios (lower(nombre_completo));
create index if not exists beneficiarios_folio_idx  on public.beneficiarios (folio);

-- ─── documentos ─────────────────────────────────────────────────────────────
-- Metadatos de los archivos guardados en el bucket privado "documentos".
create table if not exists public.documentos (
  id               uuid primary key default gen_random_uuid(),
  tutor_id         uuid not null references public.tutores (id) on delete cascade,
  beneficiario_id  uuid references public.beneficiarios (id) on delete cascade,
  tipo             tipo_documento not null,
  ruta             text not null unique,   -- {tutor_id}/{beneficiario_id}/{tipo}-{timestamp}.{ext}
  nombre_original  text not null,
  mime             text not null,
  tamano_bytes     integer not null,
  subido_por       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),

  constraint documentos_mime_chk check (mime in ('application/pdf', 'image/jpeg', 'image/png')),
  constraint documentos_tamano_chk check (tamano_bytes > 0 and tamano_bytes <= 5242880),
  -- La cartola RSH cuelga del tutor; el resto de los documentos, del beneficiario.
  constraint documentos_destino_chk check (
    (tipo = 'rsh' and beneficiario_id is null)
    or (tipo <> 'rsh' and beneficiario_id is not null)
  )
);
create index if not exists documentos_tutor_idx on public.documentos (tutor_id);
create index if not exists documentos_beneficiario_idx on public.documentos (beneficiario_id);

-- ─── observaciones / opinión profesional ────────────────────────────────────
create table if not exists public.observaciones (
  id               uuid primary key default gen_random_uuid(),
  beneficiario_id  uuid not null references public.beneficiarios (id) on delete cascade,
  autor_id         uuid references public.profiles (id) on delete set null,
  autor_nombre     text not null default '',
  tipo             tipo_nota not null default 'observacion',
  texto            text not null,
  created_at       timestamptz not null default now(),
  constraint observaciones_texto_chk check (length(btrim(texto)) >= 3)
);
create index if not exists observaciones_beneficiario_idx on public.observaciones (beneficiario_id, created_at desc);

-- ─── entregas ───────────────────────────────────────────────────────────────
-- Una fila por beneficiario: la restricción UNIQUE evita la doble entrega.
create table if not exists public.entregas (
  id               uuid primary key default gen_random_uuid(),
  beneficiario_id  uuid not null unique references public.beneficiarios (id) on delete cascade,
  entregado_por    uuid references public.profiles (id) on delete set null,
  entregado_nombre text not null default '',
  entregado_at     timestamptz not null default now(),
  nota             text
);

-- ─── configuracion (fila única) ─────────────────────────────────────────────
create table if not exists public.configuracion (
  id                          smallint primary key default 1,
  fecha_apertura              date not null default '2026-11-01',
  fecha_cierre                date not null default '2026-12-10',
  edad_maxima                 smallint not null default 12,
  fecha_corte_edad            date not null default '2026-12-25',
  certificado_estudios_obligatorio boolean not null default false,
  texto_bienvenida            text not null default
    'Bienvenido y bienvenida al proceso de inscripción para la entrega de regalos de Navidad 2026 de la Ilustre Municipalidad de Tocopilla.',
  updated_at                  timestamptz not null default now(),
  constraint configuracion_fila_unica_chk check (id = 1),
  constraint configuracion_fechas_chk check (fecha_cierre >= fecha_apertura)
);
insert into public.configuracion (id) values (1) on conflict (id) do nothing;

-- ─── audit_log ──────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id              bigserial primary key,
  tabla           text not null,
  registro_id     text,
  accion          text not null,          -- INSERT | UPDATE | DELETE
  actor_id        uuid,
  actor_email     text,
  valor_anterior  jsonb,
  valor_nuevo     jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists audit_log_tabla_idx on public.audit_log (tabla, created_at desc);
create index if not exists audit_log_registro_idx on public.audit_log (registro_id);
