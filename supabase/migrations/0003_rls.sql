-- ============================================================================
--  Migración 0003 — Row Level Security, permisos y Storage
--  Regla general:
--    · tutor       → solo sus propios registros (y solo edita mientras no esté aprobado)
--    · funcionario → lee todo; edita estados, observaciones y entregas
--    · admin       → todo, incluidos usuarios, configuración y auditoría
-- ============================================================================

-- La vista debe respetar las políticas de quien consulta, no las del dueño.
alter view public.v_postulaciones set (security_invoker = on);

alter table public.profiles       enable row level security;
alter table public.tutores        enable row level security;
alter table public.beneficiarios  enable row level security;
alter table public.documentos     enable row level security;
alter table public.observaciones  enable row level security;
alter table public.entregas       enable row level security;
alter table public.configuracion  enable row level security;
alter table public.audit_log      enable row level security;

-- Helper: ¿el tutor indicado pertenece al usuario autenticado?
create or replace function public.es_mi_tutor(p_tutor_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.tutores t
    where t.id = p_tutor_id and t.profile_id = auth.uid()
  );
$$;

-- ─── profiles ───────────────────────────────────────────────────────────────
drop policy if exists profiles_select_propio on public.profiles;
create policy profiles_select_propio on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.es_funcionario());

drop policy if exists profiles_update_propio on public.profiles;
create policy profiles_update_propio on public.profiles
  for update to authenticated
  using (id = auth.uid())
  -- El vecino puede cambiar su nombre, nunca su rol ni su estado de activación.
  with check (id = auth.uid() and rol = public.rol_actual() and activo);

drop policy if exists profiles_admin_todo on public.profiles;
create policy profiles_admin_todo on public.profiles
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ─── tutores ────────────────────────────────────────────────────────────────
drop policy if exists tutores_select on public.tutores;
create policy tutores_select on public.tutores
  for select to authenticated
  using (profile_id = auth.uid() or public.es_funcionario());

drop policy if exists tutores_insert_propio on public.tutores;
create policy tutores_insert_propio on public.tutores
  for insert to authenticated
  with check (profile_id = auth.uid() or public.es_funcionario());

drop policy if exists tutores_update_propio on public.tutores;
create policy tutores_update_propio on public.tutores
  for update to authenticated
  using (profile_id = auth.uid() or public.es_funcionario())
  with check (profile_id = auth.uid() or public.es_funcionario());

drop policy if exists tutores_delete_admin on public.tutores;
create policy tutores_delete_admin on public.tutores
  for delete to authenticated using (public.es_admin());

-- ─── beneficiarios ──────────────────────────────────────────────────────────
drop policy if exists beneficiarios_select on public.beneficiarios;
create policy beneficiarios_select on public.beneficiarios
  for select to authenticated
  using (public.es_mi_tutor(tutor_id) or public.es_funcionario());

drop policy if exists beneficiarios_insert on public.beneficiarios;
create policy beneficiarios_insert on public.beneficiarios
  for insert to authenticated
  with check (
    (public.es_mi_tutor(tutor_id) and estado = 'pendiente')
    or public.es_funcionario()
  );

-- El tutor puede corregir mientras la postulación no esté aprobada o rechazada.
drop policy if exists beneficiarios_update on public.beneficiarios;
create policy beneficiarios_update on public.beneficiarios
  for update to authenticated
  using (
    (public.es_mi_tutor(tutor_id) and estado in ('pendiente', 'observado'))
    or public.es_funcionario()
  )
  with check (
    (public.es_mi_tutor(tutor_id) and estado = 'pendiente')
    or public.es_funcionario()
  );

drop policy if exists beneficiarios_delete on public.beneficiarios;
create policy beneficiarios_delete on public.beneficiarios
  for delete to authenticated
  using (
    (public.es_mi_tutor(tutor_id) and estado in ('pendiente', 'observado'))
    or public.es_admin()
  );

-- ─── documentos ─────────────────────────────────────────────────────────────
drop policy if exists documentos_select on public.documentos;
create policy documentos_select on public.documentos
  for select to authenticated
  using (public.es_mi_tutor(tutor_id) or public.es_funcionario());

drop policy if exists documentos_insert on public.documentos;
create policy documentos_insert on public.documentos
  for insert to authenticated
  with check (public.es_mi_tutor(tutor_id) or public.es_funcionario());

drop policy if exists documentos_delete on public.documentos;
create policy documentos_delete on public.documentos
  for delete to authenticated
  using (public.es_mi_tutor(tutor_id) or public.es_admin());

-- ─── observaciones ──────────────────────────────────────────────────────────
-- El tutor las lee (para saber qué corregir); solo el personal municipal escribe.
drop policy if exists observaciones_select on public.observaciones;
create policy observaciones_select on public.observaciones
  for select to authenticated
  using (
    public.es_funcionario()
    or exists (
      select 1 from public.beneficiarios b
      where b.id = observaciones.beneficiario_id and public.es_mi_tutor(b.tutor_id)
    )
  );

drop policy if exists observaciones_insert on public.observaciones;
create policy observaciones_insert on public.observaciones
  for insert to authenticated with check (public.es_funcionario());

drop policy if exists observaciones_delete on public.observaciones;
create policy observaciones_delete on public.observaciones
  for delete to authenticated using (public.es_admin());

-- ─── entregas ───────────────────────────────────────────────────────────────
drop policy if exists entregas_select on public.entregas;
create policy entregas_select on public.entregas
  for select to authenticated
  using (
    public.es_funcionario()
    or exists (
      select 1 from public.beneficiarios b
      where b.id = entregas.beneficiario_id and public.es_mi_tutor(b.tutor_id)
    )
  );

drop policy if exists entregas_insert on public.entregas;
create policy entregas_insert on public.entregas
  for insert to authenticated with check (public.es_funcionario());

drop policy if exists entregas_delete on public.entregas;
create policy entregas_delete on public.entregas
  for delete to authenticated using (public.es_admin());

-- ─── configuracion ──────────────────────────────────────────────────────────
-- Lectura pública (el portal necesita saber fechas y edad máxima antes del login).
drop policy if exists configuracion_select on public.configuracion;
create policy configuracion_select on public.configuracion
  for select to anon, authenticated using (true);

drop policy if exists configuracion_update_admin on public.configuracion;
create policy configuracion_update_admin on public.configuracion
  for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

-- ─── audit_log ──────────────────────────────────────────────────────────────
drop policy if exists audit_log_select_admin on public.audit_log;
create policy audit_log_select_admin on public.audit_log
  for select to authenticated using (public.es_admin());
-- Nadie escribe directamente: solo los triggers (SECURITY DEFINER).

-- ─── Storage: bucket privado "documentos" ───────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 5242880,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png'];

-- La primera carpeta de la ruta es el id del tutor: {tutor_id}/{beneficiario_id}/...
drop policy if exists documentos_storage_select on storage.objects;
create policy documentos_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documentos'
    and (public.es_funcionario() or public.es_mi_tutor(nullif((storage.foldername(name))[1], '')::uuid))
  );

drop policy if exists documentos_storage_insert on storage.objects;
create policy documentos_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and (public.es_funcionario() or public.es_mi_tutor(nullif((storage.foldername(name))[1], '')::uuid))
  );

drop policy if exists documentos_storage_delete on storage.objects;
create policy documentos_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documentos'
    and (public.es_admin() or public.es_mi_tutor(nullif((storage.foldername(name))[1], '')::uuid))
  );

-- ─── Permisos de esquema ────────────────────────────────────────────────────
grant usage on schema public to anon, authenticated;
grant select on public.configuracion to anon, authenticated;
grant select, insert, update, delete on
  public.tutores, public.beneficiarios, public.documentos,
  public.observaciones, public.entregas to authenticated;
grant select, update on public.profiles to authenticated;
grant insert, delete on public.profiles to authenticated;
grant update on public.configuracion to authenticated;
grant select on public.audit_log to authenticated;
grant select on public.v_postulaciones to authenticated;
grant usage, select on sequence public.folio_seq to authenticated;
