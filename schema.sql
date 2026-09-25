create extension if not exists pgcrypto;
create extension if not exists postgis;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (
    type in ('DEFENSA_CIVIL', 'SALUD', '107', 'MUNICIPIO', 'POLICIA', 'BOMBEROS', 'CRUZ_ROJA', 'HIGIENE_SEGURIDAD', 'OTRO')
  ),
  created_at timestamptz not null default now()
);

create table jurisdictions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('PROVINCIA', 'DEPARTAMENTO', 'MUNICIPIO', 'LOCALIDAD', 'ZONA_CRITICA')),
  parent_id uuid references jurisdictions(id),
  geom geometry(MultiPolygon, 4326),
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  jurisdiction_id uuid references jurisdictions(id),
  full_name text not null,
  email text unique,
  phone text,
  role text not null check (
    role in ('SUPER_ADMIN', 'ADMIN', 'USUARIO_OPERATIVO', 'VISUALIZADOR')
  ),
  mfa_required boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table facilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  jurisdiction_id uuid not null references jurisdictions(id),
  name text not null,
  type text not null check (type in ('HOSPITAL', 'CAPS', 'BASE_107', 'REFUGIO', 'CENTRO_OPERATIVO', 'OTRO')),
  geom geometry(Point, 4326),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table alert_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null check (source_type in ('SMN', 'SINAME', 'DEFENSA_CIVIL', 'MANUAL', 'OTRO')),
  base_url text,
  created_at timestamptz not null default now()
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references alert_sources(id),
  external_id text not null,
  level text not null check (level in ('VERDE', 'AMARILLO', 'NARANJA', 'ROJO')),
  phenomenon text not null,
  title text not null,
  description text,
  issued_at timestamptz not null,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  raw_payload jsonb not null,
  status text not null default 'DETECTED' check (
    status in ('DETECTED', 'VALIDATED', 'DISTRIBUTED', 'MONITORING', 'FINISHED', 'CANCELLED')
  ),
  created_at timestamptz not null default now(),
  unique (source_id, external_id)
);

create table alert_areas (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references alerts(id) on delete cascade,
  geom geometry(MultiPolygon, 4326) not null,
  created_at timestamptz not null default now()
);

create table alert_impacts (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references alerts(id) on delete cascade,
  jurisdiction_id uuid not null references jurisdictions(id),
  organization_id uuid references organizations(id),
  impact_level text not null check (impact_level in ('VERDE', 'AMARILLO', 'NARANJA', 'ROJO')),
  created_at timestamptz not null default now(),
  unique (alert_id, jurisdiction_id, organization_id)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references alerts(id) on delete cascade,
  channel text not null check (channel in ('WHATSAPP', 'PUSH', 'EMAIL', 'SMS')),
  message text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'QUEUED', 'SENT', 'FAILED', 'CANCELLED')),
  created_at timestamptz not null default now()
);

create table notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id uuid not null references users(id),
  provider_message_id text,
  status text not null check (status in ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED')),
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_reason text
);

create table acknowledgements (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references alerts(id) on delete cascade,
  user_id uuid not null references users(id),
  organization_id uuid not null references organizations(id),
  jurisdiction_id uuid references jurisdictions(id),
  acknowledged_at timestamptz not null default now(),
  note text,
  unique (alert_id, user_id)
);

create table escalations (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references alerts(id) on delete cascade,
  jurisdiction_id uuid references jurisdictions(id),
  reason text not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'NOTIFIED', 'RESOLVED', 'CANCELLED')),
  triggered_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index jurisdictions_geom_gix on jurisdictions using gist (geom);
create index facilities_geom_gix on facilities using gist (geom);
create index alert_areas_geom_gix on alert_areas using gist (geom);
create index alerts_status_valid_until_idx on alerts (status, valid_until);
create index alert_impacts_alert_idx on alert_impacts (alert_id);
create index alert_impacts_jurisdiction_idx on alert_impacts (jurisdiction_id);
create index notifications_alert_status_idx on notifications (alert_id, status);
create index deliveries_notification_status_idx on notification_deliveries (notification_id, status);
create index acknowledgements_alert_idx on acknowledgements (alert_id);
create index escalations_alert_status_idx on escalations (alert_id, status);
create index audit_log_entity_idx on audit_log (entity_type, entity_id);
create index audit_log_created_at_idx on audit_log (created_at desc);
