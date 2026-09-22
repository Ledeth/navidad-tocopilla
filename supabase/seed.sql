-- ============================================================================
--  Navidad 2026 · Ilustre Municipalidad de Tocopilla
--  SEED DE DEMOSTRACIÓN — datos ficticios generados con scripts/generar-seed.mjs
--  NO EJECUTAR EN PRODUCCIÓN: borra los datos existentes de las tablas.
-- ============================================================================

begin;

-- ─── 1. Limpieza de los datos anteriores ────────────────────────────────────
truncate table public.audit_log restart identity cascade;
truncate table public.entregas, public.observaciones, public.documentos,
              public.beneficiarios, public.tutores restart identity cascade;
alter sequence public.folio_seq restart with 1;

-- ─── 2. Ventana de postulación abierta para la demostración ─────────────────
update public.configuracion set
  fecha_apertura = current_date - interval '30 days',
  fecha_cierre   = current_date + interval '60 days',
  edad_maxima    = 12,
  fecha_corte_edad = date '2026-12-25',
  certificado_estudios_obligatorio = false,
  texto_bienvenida = 'Bienvenido y bienvenida al proceso de inscripción para la entrega de regalos de Navidad 2026 de la Ilustre Municipalidad de Tocopilla. Complete el formulario, adjunte sus documentos y siga el estado de su postulación en línea.'
where id = 1;

-- ─── 3. Cuentas de demostración (los tres roles) ────────────────────────────
--  Contraseña de todas: Demo2026!
--  Se crean directamente en auth.users con bcrypt (extensión pgcrypto).
do $$
declare
  v_id uuid;
  v_cuenta record;
begin
  for v_cuenta in
    select * from (values
      ('tutor.demo@navidadtocopilla.cl',        'María Fernanda Rojas Díaz', 'tutor'),
      ('funcionario.demo@navidadtocopilla.cl',  'Carolina Herrera Núñez',    'funcionario'),
      ('admin.demo@navidadtocopilla.cl',        'Rodrigo Salinas Pérez',     'admin')
    ) as t(email, nombre, rol)
  loop
    delete from auth.users where email = v_cuenta.email;
    v_id := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      -- Estas columnas de token deben ir vacías, nunca NULL: si quedan
      -- nulas, el servicio de autenticación falla al iniciar sesión.
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_cuenta.email, crypt('Demo2026!', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('nombre', v_cuenta.nombre), now(), now(),
      '', '', '', ''
    );
    -- Identidad de correo (necesaria para el inicio de sesión con contraseña).
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
    values (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_cuenta.email, 'email_verified', true),
      'email', now(), now(), now()
    );
    -- El trigger crea el perfil como tutor; aquí se ajusta el rol real.
    update public.profiles
       set rol = v_cuenta.rol::rol_usuario, nombre = v_cuenta.nombre, activo = true
     where id = v_id;
  end loop;
end $$;

-- ─── 4. Tutores ficticios ───────────────────────────────────────────────────
insert into public.tutores
  (id, profile_id, nombre_completo, nacionalidad, rut, documento_extranjero,
   telefono, email, direccion, comuna, tramo_rsh, consentimiento, created_at)
values
  ('11111111-0000-4000-8000-000000000001', (select id from public.profiles where email = 'tutor.demo@navidadtocopilla.cl'), 'María Fernanda Rojas Díaz', 'chilena', '16482357-1', null, '+56 9 7763 8353', 'tutor.demo@navidadtocopilla.cl', 'Pasaje Los Pescadores 1572', 'Tocopilla', 40, true, now() - interval '30 days'),
  ('11111111-0000-4000-8000-000000000002', null, 'Ignacio Rivas Araya', 'chilena', '9109435-5', null, '+56 9 6334 4917', 'tutor2.demo@navidadtocopilla.cl', 'Pasaje Los Pescadores 1801', 'Tocopilla', 70, true, now() - interval '30 days'),
  ('11111111-0000-4000-8000-000000000003', null, 'Valentina Castro Castro', 'chilena', '9110941-7', null, '+56 9 8679 8317', 'tutor3.demo@navidadtocopilla.cl', 'Av. Arturo Prat 997', 'Tocopilla', 100, true, now() - interval '29 days'),
  ('11111111-0000-4000-8000-000000000004', null, 'Nayarett Fuentes Quispe', 'extranjera', '9118726-4', null, '+56 9 6733 9446', 'tutor4.demo@navidadtocopilla.cl', 'Pasaje Los Pescadores 2443', 'Tocopilla', null, true, now() - interval '28 days'),
  ('11111111-0000-4000-8000-000000000005', null, 'Vicente Rojas Araya', 'chilena', '9121194-7', null, '+56 9 6987 1397', 'tutor5.demo@navidadtocopilla.cl', 'Villa Gabriela Mistral 710', 'Tocopilla', 50, true, now() - interval '28 days'),
  ('11111111-0000-4000-8000-000000000006', null, 'Paola Ramírez Alarcón', 'chilena', '9129008-1', null, '+56 9 7253 7363', 'tutor6.demo@navidadtocopilla.cl', 'Pasaje Los Pescadores 420', 'Tocopilla', 50, true, now() - interval '27 days'),
  ('11111111-0000-4000-8000-000000000007', null, 'Yasna Castro Cortés', 'chilena', '9133137-3', null, '+56 9 4423 2048', 'tutor7.demo@navidadtocopilla.cl', 'Calle Sucre 545', 'Tocopilla', 50, true, now() - interval '26 days'),
  ('11111111-0000-4000-8000-000000000008', null, 'Paola Godoy Mamani', 'extranjera', '9138409-4', null, '+56 9 5914 5092', 'tutor8.demo@navidadtocopilla.cl', 'Calle Sucre 1549', 'Tocopilla', null, true, now() - interval '26 days'),
  ('11111111-0000-4000-8000-000000000009', null, 'Nicolás Mamani Quispe', 'chilena', '9146513-2', null, '+56 9 5658 9329', 'tutor9.demo@navidadtocopilla.cl', 'Calle Sucre 174', 'Tocopilla', 100, true, now() - interval '25 days'),
  ('11111111-0000-4000-8000-000000000010', null, 'Gladys Rivas Tapia', 'chilena', '9154354-0', null, '+56 9 8896 4005', 'tutor10.demo@navidadtocopilla.cl', 'Av. Serrano 871', 'Tocopilla', 70, true, now() - interval '24 days'),
  ('11111111-0000-4000-8000-000000000011', null, 'María Rivas Tapia', 'chilena', '9157803-4', null, '+56 9 6016 5769', 'tutor11.demo@navidadtocopilla.cl', 'Población Covadonga 474', 'Tocopilla', 40, true, now() - interval '23 days'),
  ('11111111-0000-4000-8000-000000000012', null, 'Rodrigo Choque Vega', 'extranjera', null, 'DNI 45.887.120', '+56 9 8579 2936', 'tutor12.demo@navidadtocopilla.cl', 'Av. Serrano 2160', 'Tocopilla', null, true, now() - interval '23 days'),
  ('11111111-0000-4000-8000-000000000013', null, 'Ignacio Ramírez Muñoz', 'chilena', '9167062-3', null, '+56 9 9886 7864', 'tutor13.demo@navidadtocopilla.cl', 'Villa Gabriela Mistral 1634', 'Tocopilla', 90, true, now() - interval '22 days'),
  ('11111111-0000-4000-8000-000000000014', null, 'Héctor Ramírez Mamani', 'chilena', '9172842-7', null, '+56 9 4445 2932', 'tutor14.demo@navidadtocopilla.cl', 'Calle 21 de Mayo 1792', 'Tocopilla', 70, true, now() - interval '21 days'),
  ('11111111-0000-4000-8000-000000000015', null, 'Fernanda Salinas Ramírez', 'chilena', '9177600-6', null, '+56 9 6417 5006', 'tutor15.demo@navidadtocopilla.cl', 'Av. Bernardo O’Higgins 344', 'Tocopilla', 70, true, now() - interval '21 days'),
  ('11111111-0000-4000-8000-000000000016', null, 'Gladys Ramírez Ramírez', 'extranjera', null, 'Cédula E-8.991.244', '+56 9 6464 1623', 'tutor16.demo@navidadtocopilla.cl', 'Calle 21 de Mayo 574', 'Tocopilla', null, true, now() - interval '20 days'),
  ('11111111-0000-4000-8000-000000000017', null, 'Camila Vega Castro', 'chilena', '9191926-5', null, '+56 9 4586 9505', 'tutor17.demo@navidadtocopilla.cl', 'Calle Colón 1108', 'Tocopilla', 50, true, now() - interval '19 days'),
  ('11111111-0000-4000-8000-000000000018', null, 'Patricio Rojas Rojas', 'chilena', '9197457-6', null, '+56 9 8780 8780', 'tutor18.demo@navidadtocopilla.cl', 'Calle Colón 1029', 'Tocopilla', 80, true, now() - interval '19 days'),
  ('11111111-0000-4000-8000-000000000019', null, 'Nayarett Quispe Vega', 'chilena', '9199458-5', null, '+56 9 4668 3152', 'tutor19.demo@navidadtocopilla.cl', 'Calle Sucre 842', 'Tocopilla', 60, true, now() - interval '18 days'),
  ('11111111-0000-4000-8000-000000000020', null, 'Benjamín Quispe Rivas', 'extranjera', null, 'Pasaporte AB1234567', '+56 9 6161 6152', 'tutor20.demo@navidadtocopilla.cl', 'Pasaje Los Pescadores 231', 'Tocopilla', null, true, now() - interval '17 days'),
  ('11111111-0000-4000-8000-000000000021', null, 'Valentina Castro Rivas', 'chilena', '9214075-K', null, '+56 9 4286 3324', 'tutor21.demo@navidadtocopilla.cl', 'Calle Colón 313', 'Tocopilla', 70, true, now() - interval '16 days'),
  ('11111111-0000-4000-8000-000000000022', null, 'Héctor Vega Rivas', 'chilena', '9219848-0', null, '+56 9 8272 5128', 'tutor22.demo@navidadtocopilla.cl', 'Calle 21 de Mayo 475', 'Tocopilla', 70, true, now() - interval '16 days'),
  ('11111111-0000-4000-8000-000000000023', null, 'Paola Choque Tapia', 'chilena', '9222718-9', null, '+56 9 8201 1450', 'tutor23.demo@navidadtocopilla.cl', 'Av. Arturo Prat 359', 'Tocopilla', 70, true, now() - interval '15 days'),
  ('11111111-0000-4000-8000-000000000024', null, 'Sebastián Pizarro Cortés', 'extranjera', '9230029-3', null, '+56 9 8794 8233', 'tutor24.demo@navidadtocopilla.cl', 'Calle Sucre 2018', 'Tocopilla', null, true, now() - interval '14 days'),
  ('11111111-0000-4000-8000-000000000025', null, 'Javiera Castro Mamani', 'chilena', '9237558-7', null, '+56 9 5582 4369', 'tutor25.demo@navidadtocopilla.cl', 'Av. Serrano 654', 'Tocopilla', 80, true, now() - interval '14 days'),
  ('11111111-0000-4000-8000-000000000026', null, 'Emilio Mamani Mamani', 'chilena', '9243700-0', null, '+56 9 9285 9860', 'tutor26.demo@navidadtocopilla.cl', 'Población Covadonga 1063', 'Tocopilla', 80, true, now() - interval '13 days'),
  ('11111111-0000-4000-8000-000000000027', null, 'Antonia Salinas Contreras', 'chilena', '9249105-6', null, '+56 9 9966 7300', 'tutor27.demo@navidadtocopilla.cl', 'Pasaje Los Pescadores 842', 'Tocopilla', 40, true, now() - interval '12 days'),
  ('11111111-0000-4000-8000-000000000028', null, 'Luis Godoy Pizarro', 'extranjera', '9254209-2', null, '+56 9 5200 5049', 'tutor28.demo@navidadtocopilla.cl', 'Av. Serrano 1269', 'Tocopilla', null, true, now() - interval '12 days'),
  ('11111111-0000-4000-8000-000000000029', null, 'Yasna Ramírez Contreras', 'chilena', '9255860-6', null, '+56 9 8395 3036', 'tutor29.demo@navidadtocopilla.cl', 'Población Covadonga 780', 'Tocopilla', 100, true, now() - interval '11 days'),
  ('11111111-0000-4000-8000-000000000030', null, 'Marisol Fuentes Mamani', 'chilena', '9261211-2', null, '+56 9 6189 9118', 'tutor30.demo@navidadtocopilla.cl', 'Av. Bernardo O’Higgins 1163', 'Tocopilla', 90, true, now() - interval '10 days'),
  ('11111111-0000-4000-8000-000000000031', null, 'Valentina Contreras Pizarro', 'chilena', '9265900-3', null, '+56 9 9281 6423', 'tutor31.demo@navidadtocopilla.cl', 'Villa Gabriela Mistral 2273', 'Tocopilla', 40, true, now() - interval '9 days'),
  ('11111111-0000-4000-8000-000000000032', null, 'Marisol Godoy Rojas', 'extranjera', '9274117-6', null, '+56 9 9808 6847', 'tutor32.demo@navidadtocopilla.cl', 'Calle Baquedano 826', 'Tocopilla', null, true, now() - interval '9 days'),
  ('11111111-0000-4000-8000-000000000033', null, 'Benjamín Muñoz Muñoz', 'chilena', '9280405-4', null, '+56 9 8784 9506', 'tutor33.demo@navidadtocopilla.cl', 'Población Covadonga 1519', 'Tocopilla', 90, true, now() - interval '8 days'),
  ('11111111-0000-4000-8000-000000000034', null, 'Nicolás Quispe Muñoz', 'chilena', '9287188-6', null, '+56 9 7733 3414', 'tutor34.demo@navidadtocopilla.cl', 'Av. Bernardo O’Higgins 1644', 'Tocopilla', 100, true, now() - interval '7 days'),
  ('11111111-0000-4000-8000-000000000035', null, 'Héctor Villalobos Salinas', 'chilena', '9294284-8', null, '+56 9 8509 6459', 'tutor35.demo@navidadtocopilla.cl', 'Av. Serrano 693', 'Tocopilla', 100, true, now() - interval '7 days'),
  ('11111111-0000-4000-8000-000000000036', null, 'Cristian Cortés Alarcón', 'extranjera', '9299177-6', null, '+56 9 6551 4917', 'tutor36.demo@navidadtocopilla.cl', 'Av. Serrano 324', 'Tocopilla', null, true, now() - interval '6 days'),
  ('11111111-0000-4000-8000-000000000037', null, 'Yasna Castro Pizarro', 'chilena', '9302480-K', null, '+56 9 4432 2139', 'tutor37.demo@navidadtocopilla.cl', 'Población Covadonga 886', 'Tocopilla', 50, true, now() - interval '5 days'),
  ('11111111-0000-4000-8000-000000000038', null, 'Patricio Rivas Pizarro', 'chilena', '9308393-8', null, '+56 9 5364 7710', 'tutor38.demo@navidadtocopilla.cl', 'Calle Sucre 1917', 'Tocopilla', 60, true, now() - interval '5 days'),
  ('11111111-0000-4000-8000-000000000039', null, 'Nicolás Contreras Muñoz', 'chilena', '9317155-1', null, '+56 9 7568 9418', 'tutor39.demo@navidadtocopilla.cl', 'Calle Baquedano 2208', 'Tocopilla', 60, true, now() - interval '4 days'),
  ('11111111-0000-4000-8000-000000000040', null, 'Rodrigo Rojas Cortés', 'extranjera', null, 'DNI 45.887.120', '+56 9 4442 7395', 'tutor40.demo@navidadtocopilla.cl', 'Av. Bernardo O’Higgins 292', 'Tocopilla', null, true, now() - interval '3 days');

-- ─── 5. Beneficiarios ───────────────────────────────────────────────────────
insert into public.beneficiarios
  (id, tutor_id, rut, nombre_completo, sexo, fecha_nacimiento, discapacidad,
   observaciones, estado, motivo_estado, revisado_por, revisado_at, created_at)
values
  ('22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000001', '24503490-3', 'Camila Choque Araya', 'otro', date '2023-03-14', true, null, 'rechazado', 'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '25 days', now() - interval '28 days'),
  ('22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000001', '24508348-3', 'Vicente Bolaños Bolaños', 'masculino', date '2021-02-11', false, null, 'observado', 'Falta el certificado de nacimiento del beneficiario.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '25 days', now() - interval '28 days'),
  ('22222222-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000001', '24511734-5', 'Karen Fuentes Vega', 'femenino', date '2025-04-17', false, null, 'rechazado', 'El beneficiario supera la edad máxima establecida para este proceso.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '25 days', now() - interval '28 days'),
  ('22222222-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000002', '24515169-1', 'Gladys Muñoz Salinas', 'femenino', date '2025-10-04', true, null, 'observado', 'El domicilio informado no coincide con el del Registro Social de Hogares.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '24 days', now() - interval '27 days'),
  ('22222222-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000002', '24519515-K', 'Rosa Alarcón Rivas', 'femenino', date '2016-11-22', false, null, 'rechazado', 'El beneficiario supera la edad máxima establecida para este proceso.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '24 days', now() - interval '27 days'),
  ('22222222-0000-4000-8000-000000000006', '11111111-0000-4000-8000-000000000003', '24521237-2', 'Benjamín Choque Alarcón', 'masculino', date '2015-11-11', false, null, 'observado', 'Falta el certificado de nacimiento del beneficiario.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '24 days', now() - interval '27 days'),
  ('22222222-0000-4000-8000-000000000007', '11111111-0000-4000-8000-000000000003', '24526121-7', 'María Muñoz Rivas', 'femenino', date '2017-08-12', false, null, 'pendiente', null, null, null, now() - interval '26 days'),
  ('22222222-0000-4000-8000-000000000008', '11111111-0000-4000-8000-000000000003', '24527859-4', 'Paola Tapia Mamani', 'otro', date '2014-11-21', false, null, 'pendiente', null, null, null, now() - interval '26 days'),
  ('22222222-0000-4000-8000-000000000009', '11111111-0000-4000-8000-000000000004', '24532898-2', 'Álvaro Choque Rojas', 'masculino', date '2018-10-18', true, null, 'rechazado', 'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '23 days', now() - interval '26 days'),
  ('22222222-0000-4000-8000-000000000010', '11111111-0000-4000-8000-000000000004', '24534992-0', 'Patricio Ramírez Fuentes', 'masculino', date '2023-06-01', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '22 days', now() - interval '25 days'),
  ('22222222-0000-4000-8000-000000000011', '11111111-0000-4000-8000-000000000005', '24538079-8', 'Héctor Mamani Alarcón', 'masculino', date '2017-12-09', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '22 days', now() - interval '25 days'),
  ('22222222-0000-4000-8000-000000000012', '11111111-0000-4000-8000-000000000005', '24542051-K', 'Sebastián Pizarro Contreras', 'masculino', date '2017-12-23', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '22 days', now() - interval '25 days'),
  ('22222222-0000-4000-8000-000000000013', '11111111-0000-4000-8000-000000000005', '24543503-7', 'Patricio Vega Salinas', 'masculino', date '2018-07-26', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '21 days', now() - interval '24 days'),
  ('22222222-0000-4000-8000-000000000014', '11111111-0000-4000-8000-000000000006', '24546687-0', 'Álvaro Bolaños Salinas', 'masculino', date '2023-04-08', false, null, 'pendiente', null, null, null, now() - interval '24 days'),
  ('22222222-0000-4000-8000-000000000015', '11111111-0000-4000-8000-000000000006', '24550404-7', 'Nayarett Villalobos Vega', 'femenino', date '2015-11-28', false, null, 'pendiente', null, null, null, now() - interval '23 days'),
  ('22222222-0000-4000-8000-000000000016', '11111111-0000-4000-8000-000000000006', '24552394-7', 'Nayarett Choque Alarcón', 'femenino', date '2023-01-02', false, null, 'rechazado', 'El beneficiario supera la edad máxima establecida para este proceso.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '20 days', now() - interval '23 days'),
  ('22222222-0000-4000-8000-000000000017', '11111111-0000-4000-8000-000000000007', '24555398-6', 'Daniela Salinas Cortés', 'femenino', date '2024-08-08', false, null, 'observado', 'Falta el certificado de nacimiento del beneficiario.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '20 days', now() - interval '23 days'),
  ('22222222-0000-4000-8000-000000000018', '11111111-0000-4000-8000-000000000007', '24559085-7', 'Nayarett Tapia Mamani', 'otro', date '2016-08-07', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '19 days', now() - interval '22 days'),
  ('22222222-0000-4000-8000-000000000019', '11111111-0000-4000-8000-000000000007', '24560883-7', 'Vicente Cortés Alarcón', 'masculino', date '2020-06-08', false, null, 'pendiente', null, null, null, now() - interval '22 days'),
  ('22222222-0000-4000-8000-000000000020', '11111111-0000-4000-8000-000000000008', '24562093-4', 'Yasna Choque Rivas', 'femenino', date '2016-04-14', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '19 days', now() - interval '22 days'),
  ('22222222-0000-4000-8000-000000000021', '11111111-0000-4000-8000-000000000009', '24566901-1', 'Antonia Muñoz Alarcón', 'femenino', date '2019-02-28', true, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '18 days', now() - interval '21 days'),
  ('22222222-0000-4000-8000-000000000022', '11111111-0000-4000-8000-000000000009', '24571605-2', 'Juan Cortés Araya', 'masculino', date '2022-02-13', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '18 days', now() - interval '21 days'),
  ('22222222-0000-4000-8000-000000000023', '11111111-0000-4000-8000-000000000009', '24575053-6', 'Gladys Quispe Muñoz', 'femenino', date '2018-11-07', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '18 days', now() - interval '21 days'),
  ('22222222-0000-4000-8000-000000000024', '11111111-0000-4000-8000-000000000010', '24579515-7', 'Yasna Rivas Bolaños', 'otro', date '2018-05-05', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '17 days', now() - interval '20 days'),
  ('22222222-0000-4000-8000-000000000025', '11111111-0000-4000-8000-000000000010', '24581866-1', 'Patricio Choque Fuentes', 'masculino', date '2017-01-10', false, null, 'observado', 'Falta el certificado de nacimiento del beneficiario.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '17 days', now() - interval '20 days'),
  ('22222222-0000-4000-8000-000000000026', '11111111-0000-4000-8000-000000000010', '24583628-7', 'Luis Mamani Fuentes', 'masculino', date '2018-08-01', false, null, 'rechazado', 'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '16 days', now() - interval '19 days'),
  ('22222222-0000-4000-8000-000000000027', '11111111-0000-4000-8000-000000000011', '24588110-K', 'Ingrid Cortés Alarcón', 'otro', date '2025-10-25', true, null, 'rechazado', 'El grupo familiar no reside en la comuna de Tocopilla.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '16 days', now() - interval '19 days'),
  ('22222222-0000-4000-8000-000000000028', '11111111-0000-4000-8000-000000000011', '24589304-3', 'Antonia Alarcón Cortés', 'otro', date '2023-07-25', false, null, 'pendiente', null, null, null, now() - interval '19 days'),
  ('22222222-0000-4000-8000-000000000029', '11111111-0000-4000-8000-000000000011', '24592672-3', 'Yasna Castro Rivas', 'femenino', date '2021-12-18', false, null, 'observado', 'La cartola del Registro Social de Hogares está ilegible. Vuelva a adjuntarla en mejor calidad.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '15 days', now() - interval '18 days'),
  ('22222222-0000-4000-8000-000000000030', '11111111-0000-4000-8000-000000000012', '24596667-9', 'María Choque Tapia', 'femenino', date '2015-12-25', false, null, 'rechazado', 'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '15 days', now() - interval '18 days'),
  ('22222222-0000-4000-8000-000000000031', '11111111-0000-4000-8000-000000000012', '24600007-7', 'Karen Villalobos Choque', 'otro', date '2023-08-22', false, null, 'observado', 'El domicilio informado no coincide con el del Registro Social de Hogares.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '15 days', now() - interval '18 days'),
  ('22222222-0000-4000-8000-000000000032', '11111111-0000-4000-8000-000000000012', '24604665-4', 'Héctor Choque Ramírez', 'masculino', date '2019-03-13', false, null, 'pendiente', null, null, null, now() - interval '17 days'),
  ('22222222-0000-4000-8000-000000000033', '11111111-0000-4000-8000-000000000013', '24609699-6', 'Javiera Vega Vega', 'femenino', date '2019-07-21', false, null, 'pendiente', null, null, null, now() - interval '17 days'),
  ('22222222-0000-4000-8000-000000000034', '11111111-0000-4000-8000-000000000013', '24612994-0', 'Nayarett Quispe Contreras', 'femenino', date '2022-09-14', false, null, 'rechazado', 'El beneficiario supera la edad máxima establecida para este proceso.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '14 days', now() - interval '17 days'),
  ('22222222-0000-4000-8000-000000000035', '11111111-0000-4000-8000-000000000013', '24615293-4', 'Gladys Salinas Fuentes', 'femenino', date '2022-02-08', false, null, 'observado', 'Falta el certificado de nacimiento del beneficiario.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '13 days', now() - interval '16 days'),
  ('22222222-0000-4000-8000-000000000036', '11111111-0000-4000-8000-000000000014', '24618770-3', 'Cristian Pizarro Rivas', 'masculino', date '2015-07-12', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '13 days', now() - interval '16 days'),
  ('22222222-0000-4000-8000-000000000037', '11111111-0000-4000-8000-000000000014', '24623593-7', 'Nayarett Rojas Godoy', 'femenino', date '2018-08-26', false, null, 'pendiente', null, null, null, now() - interval '15 days'),
  ('22222222-0000-4000-8000-000000000038', '11111111-0000-4000-8000-000000000014', '24626173-3', 'Juan Quispe Salinas', 'masculino', date '2022-08-07', false, null, 'pendiente', null, null, null, now() - interval '15 days'),
  ('22222222-0000-4000-8000-000000000039', '11111111-0000-4000-8000-000000000015', '24630543-9', 'Álvaro Pizarro Alarcón', 'masculino', date '2017-06-23', false, null, 'pendiente', null, null, null, now() - interval '15 days'),
  ('22222222-0000-4000-8000-000000000040', '11111111-0000-4000-8000-000000000015', '24635525-8', 'Ignacio Villalobos Cortés', 'masculino', date '2017-05-19', false, null, 'pendiente', null, null, null, now() - interval '14 days'),
  ('22222222-0000-4000-8000-000000000041', '11111111-0000-4000-8000-000000000016', '24637082-6', 'Fernanda Castro Pizarro', 'femenino', date '2020-04-06', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '11 days', now() - interval '14 days'),
  ('22222222-0000-4000-8000-000000000042', '11111111-0000-4000-8000-000000000016', '24639016-9', 'Ignacio Contreras Fuentes', 'masculino', date '2020-04-03', false, null, 'pendiente', null, null, null, now() - interval '14 days'),
  ('22222222-0000-4000-8000-000000000043', '11111111-0000-4000-8000-000000000016', '24642446-2', 'Marisol Quispe Alarcón', 'femenino', date '2015-04-07', false, null, 'rechazado', 'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '10 days', now() - interval '13 days'),
  ('22222222-0000-4000-8000-000000000044', '11111111-0000-4000-8000-000000000017', '24644843-4', 'Yasna Contreras Tapia', 'femenino', date '2018-12-10', false, null, 'pendiente', null, null, null, now() - interval '13 days'),
  ('22222222-0000-4000-8000-000000000045', '11111111-0000-4000-8000-000000000017', '24647553-9', 'Yasna Muñoz Villalobos', 'femenino', date '2023-02-03', true, null, 'observado', 'La cartola del Registro Social de Hogares está ilegible. Vuelva a adjuntarla en mejor calidad.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '10 days', now() - interval '13 days'),
  ('22222222-0000-4000-8000-000000000046', '11111111-0000-4000-8000-000000000018', '24650472-5', 'Ingrid Salinas Alarcón', 'femenino', date '2024-09-05', false, null, 'pendiente', null, null, null, now() - interval '12 days'),
  ('22222222-0000-4000-8000-000000000047', '11111111-0000-4000-8000-000000000019', '24653033-5', 'Héctor Alarcón Choque', 'masculino', date '2015-10-23', false, null, 'observado', 'La cartola del Registro Social de Hogares está ilegible. Vuelva a adjuntarla en mejor calidad.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '9 days', now() - interval '12 days'),
  ('22222222-0000-4000-8000-000000000048', '11111111-0000-4000-8000-000000000020', '24657052-3', 'Yasna Alarcón Villalobos', 'femenino', date '2020-05-14', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '9 days', now() - interval '12 days'),
  ('22222222-0000-4000-8000-000000000049', '11111111-0000-4000-8000-000000000020', '24658422-2', 'Ingrid Bolaños Rojas', 'femenino', date '2020-02-26', false, null, 'pendiente', null, null, null, now() - interval '11 days'),
  ('22222222-0000-4000-8000-000000000050', '11111111-0000-4000-8000-000000000021', '24662641-3', 'Camila Godoy Tapia', 'otro', date '2023-07-26', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '8 days', now() - interval '11 days'),
  ('22222222-0000-4000-8000-000000000051', '11111111-0000-4000-8000-000000000021', '24667230-K', 'Álvaro Vega Salinas', 'masculino', date '2018-03-20', false, null, 'observado', 'El domicilio informado no coincide con el del Registro Social de Hogares.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '7 days', now() - interval '10 days'),
  ('22222222-0000-4000-8000-000000000052', '11111111-0000-4000-8000-000000000021', '24670659-K', 'Patricio Tapia Salinas', 'masculino', date '2015-01-03', true, null, 'rechazado', 'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '7 days', now() - interval '10 days'),
  ('22222222-0000-4000-8000-000000000053', '11111111-0000-4000-8000-000000000022', '24671662-5', 'Nayarett Cortés Alarcón', 'femenino', date '2023-08-22', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '7 days', now() - interval '10 days'),
  ('22222222-0000-4000-8000-000000000054', '11111111-0000-4000-8000-000000000022', '24675717-8', 'Javiera Ramírez Cortés', 'femenino', date '2017-01-26', false, null, 'pendiente', null, null, null, now() - interval '9 days'),
  ('22222222-0000-4000-8000-000000000055', '11111111-0000-4000-8000-000000000022', '24676767-K', 'Emilio Choque Ramírez', 'masculino', date '2017-07-14', false, null, 'rechazado', 'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '6 days', now() - interval '9 days'),
  ('22222222-0000-4000-8000-000000000056', '11111111-0000-4000-8000-000000000023', '24678949-5', 'Cristian Choque Fuentes', 'masculino', date '2021-09-16', false, null, 'observado', 'El domicilio informado no coincide con el del Registro Social de Hogares.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '6 days', now() - interval '9 days'),
  ('22222222-0000-4000-8000-000000000057', '11111111-0000-4000-8000-000000000023', '24683285-4', 'Benjamín Araya Pizarro', 'masculino', date '2019-04-10', false, null, 'observado', 'Falta el certificado de nacimiento del beneficiario.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '5 days', now() - interval '8 days'),
  ('22222222-0000-4000-8000-000000000058', '11111111-0000-4000-8000-000000000023', '24688162-6', 'Rodrigo Bolaños Ramírez', 'masculino', date '2017-05-26', false, null, 'observado', 'La cartola del Registro Social de Hogares está ilegible. Vuelva a adjuntarla en mejor calidad.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '5 days', now() - interval '8 days'),
  ('22222222-0000-4000-8000-000000000059', '11111111-0000-4000-8000-000000000024', '24690185-6', 'Daniela Mamani Rivas', 'otro', date '2018-10-26', true, null, 'pendiente', null, null, null, now() - interval '8 days'),
  ('22222222-0000-4000-8000-000000000060', '11111111-0000-4000-8000-000000000025', '24691107-K', 'Daniela Cortés Muñoz', 'otro', date '2018-05-09', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '4 days', now() - interval '7 days'),
  ('22222222-0000-4000-8000-000000000061', '11111111-0000-4000-8000-000000000025', '24696071-2', 'Gladys Quispe Muñoz', 'femenino', date '2018-10-08', false, null, 'observado', 'La cartola del Registro Social de Hogares está ilegible. Vuelva a adjuntarla en mejor calidad.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '4 days', now() - interval '7 days'),
  ('22222222-0000-4000-8000-000000000062', '11111111-0000-4000-8000-000000000025', '24699449-8', 'Daniela Salinas Quispe', 'femenino', date '2014-03-21', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '3 days', now() - interval '6 days'),
  ('22222222-0000-4000-8000-000000000063', '11111111-0000-4000-8000-000000000026', '24704466-3', 'Yasna Castro Castro', 'femenino', date '2017-06-09', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '3 days', now() - interval '6 days'),
  ('22222222-0000-4000-8000-000000000064', '11111111-0000-4000-8000-000000000027', '24706400-1', 'Ignacio Contreras Fuentes', 'masculino', date '2020-04-03', false, null, 'pendiente', null, null, null, now() - interval '6 days'),
  ('22222222-0000-4000-8000-000000000065', '11111111-0000-4000-8000-000000000027', '24709830-5', 'Marisol Quispe Alarcón', 'femenino', date '2015-04-07', false, null, 'rechazado', 'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '2 days', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000066', '11111111-0000-4000-8000-000000000027', '24712965-0', 'Bastián Alarcón Contreras', 'masculino', date '2025-08-27', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '2 days', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000067', '11111111-0000-4000-8000-000000000028', '24713870-6', 'Luis Villalobos Rivas', 'masculino', date '2024-01-20', false, null, 'observado', 'La cartola del Registro Social de Hogares está ilegible. Vuelva a adjuntarla en mejor calidad.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '2 days', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000068', '11111111-0000-4000-8000-000000000028', '24716789-7', 'Ingrid Salinas Alarcón', 'femenino', date '2024-09-05', false, null, 'pendiente', null, null, null, now() - interval '4 days'),
  ('22222222-0000-4000-8000-000000000069', '11111111-0000-4000-8000-000000000029', '24719350-2', 'Héctor Alarcón Choque', 'masculino', date '2015-10-23', false, null, 'observado', 'La cartola del Registro Social de Hogares está ilegible. Vuelva a adjuntarla en mejor calidad.', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '1 days', now() - interval '4 days'),
  ('22222222-0000-4000-8000-000000000070', '11111111-0000-4000-8000-000000000030', '24723369-5', 'Yasna Alarcón Villalobos', 'femenino', date '2020-05-14', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '1 days', now() - interval '4 days'),
  ('22222222-0000-4000-8000-000000000071', '11111111-0000-4000-8000-000000000030', '24724739-4', 'Ingrid Bolaños Rojas', 'femenino', date '2020-02-26', false, null, 'pendiente', null, null, null, now() - interval '3 days'),
  ('22222222-0000-4000-8000-000000000072', '11111111-0000-4000-8000-000000000031', '24728958-5', 'Camila Godoy Tapia', 'otro', date '2023-07-26', false, null, 'aprobado', null, (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), now() - interval '1 days', now() - interval '3 days');

-- ─── 6. Observaciones y opinión profesional ─────────────────────────────────
insert into public.observaciones (beneficiario_id, autor_id, autor_nombre, tipo, texto, created_at)
values
  ('22222222-0000-4000-8000-000000000001', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000002', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'Falta el certificado de nacimiento del beneficiario.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000003', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'El beneficiario supera la edad máxima establecida para este proceso.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000004', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'El domicilio informado no coincide con el del Registro Social de Hogares.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000005', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'El beneficiario supera la edad máxima establecida para este proceso.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000006', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'Falta el certificado de nacimiento del beneficiario.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000009', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000016', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'El beneficiario supera la edad máxima establecida para este proceso.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000017', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'Falta el certificado de nacimiento del beneficiario.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000021', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'opinion_profesional', 'Se sugiere priorizar la entrega considerando la condición de discapacidad acreditada del beneficiario.', now() - interval '4 days'),
  ('22222222-0000-4000-8000-000000000025', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'Falta el certificado de nacimiento del beneficiario.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000026', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000027', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'El grupo familiar no reside en la comuna de Tocopilla.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000029', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'La cartola del Registro Social de Hogares está ilegible. Vuelva a adjuntarla en mejor calidad.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000030', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000031', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'El domicilio informado no coincide con el del Registro Social de Hogares.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000034', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'El beneficiario supera la edad máxima establecida para este proceso.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000035', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'Falta el certificado de nacimiento del beneficiario.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000043', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000045', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'La cartola del Registro Social de Hogares está ilegible. Vuelva a adjuntarla en mejor calidad.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000047', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'La cartola del Registro Social de Hogares está ilegible. Vuelva a adjuntarla en mejor calidad.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000051', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'El domicilio informado no coincide con el del Registro Social de Hogares.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000052', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000055', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000056', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'El domicilio informado no coincide con el del Registro Social de Hogares.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000057', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'Falta el certificado de nacimiento del beneficiario.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000058', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'La cartola del Registro Social de Hogares está ilegible. Vuelva a adjuntarla en mejor calidad.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000061', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'La cartola del Registro Social de Hogares está ilegible. Vuelva a adjuntarla en mejor calidad.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000065', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'La postulación está duplicada: el beneficiario ya fue inscrito por otro tutor.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000067', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'La cartola del Registro Social de Hogares está ilegible. Vuelva a adjuntarla en mejor calidad.', now() - interval '5 days'),
  ('22222222-0000-4000-8000-000000000069', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', 'observacion', 'La cartola del Registro Social de Hogares está ilegible. Vuelva a adjuntarla en mejor calidad.', now() - interval '5 days');

-- ─── 7. Entregas ya realizadas ──────────────────────────────────────────────
insert into public.entregas (beneficiario_id, entregado_por, entregado_nombre, entregado_at)
values
  ('22222222-0000-4000-8000-000000000010', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', now() - interval '2 days'),
  ('22222222-0000-4000-8000-000000000022', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', now() - interval '2 days'),
  ('22222222-0000-4000-8000-000000000024', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', now() - interval '2 days'),
  ('22222222-0000-4000-8000-000000000036', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', now() - interval '2 days'),
  ('22222222-0000-4000-8000-000000000041', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', now() - interval '2 days'),
  ('22222222-0000-4000-8000-000000000048', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', now() - interval '2 days'),
  ('22222222-0000-4000-8000-000000000050', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', now() - interval '2 days'),
  ('22222222-0000-4000-8000-000000000053', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', now() - interval '2 days'),
  ('22222222-0000-4000-8000-000000000060', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', now() - interval '2 days'),
  ('22222222-0000-4000-8000-000000000070', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', now() - interval '2 days'),
  ('22222222-0000-4000-8000-000000000072', (select id from public.profiles where email = 'funcionario.demo@navidadtocopilla.cl'), 'Carolina Herrera Núñez', now() - interval '2 days');

commit;

-- ============================================================================
--  Credenciales de demostración (contraseña: Demo2026!)
--    tutor.demo@navidadtocopilla.cl        → vecino
--    funcionario.demo@navidadtocopilla.cl  → funcionario municipal
--    admin.demo@navidadtocopilla.cl        → administrador
-- ============================================================================
