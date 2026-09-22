-- ============================================================================
--  Migración 0002 — Funciones, triggers de negocio y auditoría
-- ============================================================================

-- ─── Helpers de rol ─────────────────────────────────────────────────────────
-- SECURITY DEFINER para poder leer public.profiles sin caer en recursión de RLS.
create or replace function public.rol_actual()
returns rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select p.rol from public.profiles p where p.id = auth.uid() and p.activo;
$$;

create or replace function public.es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.rol_actual() = 'admin', false);
$$;

create or replace function public.es_funcionario() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.rol_actual() in ('funcionario', 'admin'), false);
$$;

-- ─── updated_at automático ──────────────────────────────────────────────────
create or replace function public.tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.tocar_updated_at();

drop trigger if exists trg_tutores_updated on public.tutores;
create trigger trg_tutores_updated before update on public.tutores
  for each row execute function public.tocar_updated_at();

drop trigger if exists trg_beneficiarios_updated on public.beneficiarios;
create trigger trg_beneficiarios_updated before update on public.beneficiarios
  for each row execute function public.tocar_updated_at();

drop trigger if exists trg_configuracion_updated on public.configuracion;
create trigger trg_configuracion_updated before update on public.configuracion
  for each row execute function public.tocar_updated_at();

-- ─── Alta automática del perfil al registrarse un vecino ────────────────────
-- Importante: el rol SIEMPRE se fuerza a 'tutor'. Nadie puede auto-asignarse
-- 'funcionario' o 'admin' mandando metadatos en el signUp; los usuarios
-- internos se crean desde la Edge Function con la service role key.
create or replace function public.manejar_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nombre, rol)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    'tutor'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_auth_usuario_nuevo on auth.users;
create trigger trg_auth_usuario_nuevo
  after insert on auth.users
  for each row execute function public.manejar_nuevo_usuario();

-- ─── Edad del beneficiario y ventana de postulación ─────────────────────────
create or replace function public.edad_al_corte(p_fecha_nacimiento date)
returns integer
language sql
stable
as $$
  select extract(year from age((select fecha_corte_edad from public.configuracion where id = 1),
                               p_fecha_nacimiento))::int;
$$;

create or replace function public.validar_beneficiario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg public.configuracion%rowtype;
  edad integer;
begin
  select * into cfg from public.configuracion where id = 1;

  -- Regla de edad máxima (configurable por el admin).
  edad := extract(year from age(cfg.fecha_corte_edad, new.fecha_nacimiento))::int;
  if edad > cfg.edad_maxima then
    raise exception 'El beneficiario supera la edad máxima permitida (% años al %).',
      cfg.edad_maxima, to_char(cfg.fecha_corte_edad, 'DD-MM-YYYY')
      using errcode = 'check_violation';
  end if;
  if new.fecha_nacimiento > current_date then
    raise exception 'La fecha de nacimiento no puede ser futura.' using errcode = 'check_violation';
  end if;

  -- Ventana de postulación: solo aplica a los vecinos; el personal municipal
  -- puede registrar o corregir fuera de plazo.
  if tg_op = 'INSERT' and not public.es_funcionario() then
    if current_date < cfg.fecha_apertura or current_date > cfg.fecha_cierre then
      raise exception 'El proceso de postulación está cerrado (del % al %).',
        to_char(cfg.fecha_apertura, 'DD-MM-YYYY'), to_char(cfg.fecha_cierre, 'DD-MM-YYYY')
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_beneficiarios_validar on public.beneficiarios;
create trigger trg_beneficiarios_validar
  before insert or update of fecha_nacimiento on public.beneficiarios
  for each row execute function public.validar_beneficiario();

-- ─── Folio correlativo al aprobar ───────────────────────────────────────────
create or replace function public.asignar_folio()
returns trigger
language plpgsql as $$
begin
  if new.estado = 'aprobado' and new.folio is null then
    new.folio := 'NAV-' || to_char(now(), 'YYYY') || '-' ||
                 lpad(nextval('public.folio_seq')::text, 6, '0');
  end if;
  -- Al aprobar/rechazar/observar se deja constancia de quién revisó.
  if tg_op = 'UPDATE' and new.estado is distinct from old.estado then
    new.revisado_por := coalesce(auth.uid(), new.revisado_por);
    new.revisado_at  := now();
    -- Si vuelve a "pendiente" (el tutor corrigió), se limpia el motivo.
    if new.estado = 'pendiente' then
      new.motivo_estado := null;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_beneficiarios_folio on public.beneficiarios;
create trigger trg_beneficiarios_folio
  before insert or update on public.beneficiarios
  for each row execute function public.asignar_folio();

-- ─── Evitar la doble entrega ────────────────────────────────────────────────
create or replace function public.validar_entrega()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  est estado_postulacion;
begin
  select estado into est from public.beneficiarios where id = new.beneficiario_id;
  if est is null then
    raise exception 'El beneficiario no existe.' using errcode = 'check_violation';
  end if;
  if est <> 'aprobado' then
    raise exception 'Solo se puede registrar la entrega de beneficiarios aprobados.'
      using errcode = 'check_violation';
  end if;
  new.entregado_por := coalesce(new.entregado_por, auth.uid());
  return new;
end $$;

drop trigger if exists trg_entregas_validar on public.entregas;
create trigger trg_entregas_validar before insert on public.entregas
  for each row execute function public.validar_entrega();

-- ─── Auditoría genérica ─────────────────────────────────────────────────────
create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anterior jsonb;
  v_nuevo    jsonb;
  v_id       text;
begin
  if tg_op = 'INSERT' then
    v_nuevo := to_jsonb(new);
    v_id := v_nuevo ->> 'id';
  elsif tg_op = 'UPDATE' then
    v_anterior := to_jsonb(old);
    v_nuevo := to_jsonb(new);
    v_id := v_nuevo ->> 'id';
    -- No se registra si no cambió nada relevante.
    if v_anterior - 'updated_at' = v_nuevo - 'updated_at' then
      return new;
    end if;
  else
    v_anterior := to_jsonb(old);
    v_id := v_anterior ->> 'id';
  end if;

  insert into public.audit_log (tabla, registro_id, accion, actor_id, actor_email, valor_anterior, valor_nuevo)
  values (
    tg_table_name,
    v_id,
    tg_op,
    auth.uid(),
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', 'sistema'),
    v_anterior,
    v_nuevo
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists trg_audit_beneficiarios on public.beneficiarios;
create trigger trg_audit_beneficiarios
  after insert or update or delete on public.beneficiarios
  for each row execute function public.registrar_auditoria();

drop trigger if exists trg_audit_tutores on public.tutores;
create trigger trg_audit_tutores
  after insert or update or delete on public.tutores
  for each row execute function public.registrar_auditoria();

drop trigger if exists trg_audit_observaciones on public.observaciones;
create trigger trg_audit_observaciones
  after insert or update or delete on public.observaciones
  for each row execute function public.registrar_auditoria();

drop trigger if exists trg_audit_entregas on public.entregas;
create trigger trg_audit_entregas
  after insert or update or delete on public.entregas
  for each row execute function public.registrar_auditoria();

drop trigger if exists trg_audit_configuracion on public.configuracion;
create trigger trg_audit_configuracion
  after update on public.configuracion
  for each row execute function public.registrar_auditoria();

drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles
  after insert or update or delete on public.profiles
  for each row execute function public.registrar_auditoria();

drop trigger if exists trg_audit_documentos on public.documentos;
create trigger trg_audit_documentos
  after insert or delete on public.documentos
  for each row execute function public.registrar_auditoria();

-- ─── Vista de apoyo para el panel municipal ─────────────────────────────────
create or replace view public.v_postulaciones as
select
  b.id                as beneficiario_id,
  b.rut               as beneficiario_rut,
  b.nombre_completo   as beneficiario_nombre,
  b.sexo,
  b.fecha_nacimiento,
  public.edad_al_corte(b.fecha_nacimiento) as edad,
  b.discapacidad,
  b.estado,
  b.motivo_estado,
  b.folio,
  b.created_at,
  b.updated_at,
  t.id                as tutor_id,
  t.nombre_completo   as tutor_nombre,
  coalesce(t.rut, t.documento_extranjero) as tutor_rut,
  t.nacionalidad,
  t.tramo_rsh,
  t.telefono,
  t.email,
  t.direccion,
  t.comuna,
  (e.id is not null)  as entregado,
  e.entregado_at
from public.beneficiarios b
join public.tutores t on t.id = b.tutor_id
left join public.entregas e on e.beneficiario_id = b.id;
