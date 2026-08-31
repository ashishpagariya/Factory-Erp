-- =========================================================================
-- AurumTemple / JJJ Factory ERP — production schema
-- Ported 1:1 from the validated click-through prototype's business logic.
-- All mutating operations are Postgres functions (SECURITY DEFINER where
-- noted) so that balance updates + ledger inserts happen atomically —
-- per the blueprint's own rule: "users should never directly type stock
-- balances; all reports are generated from posted transactions."
-- =========================================================================

-- ---------- extensions ----------
create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type material_category as enum ('Bullion','SemiFinished','Manufacturing','NonGold');
create type user_role as enum ('Owner / Admin','Office Manager','Factory Manager','Supervisor','Tagged Product Receiver');
create type dispatch_status as enum ('Pending','Accepted','Discrepancy');
create type process_status as enum ('Open','Closed');
create type job_status as enum ('Open','Settled');
create type opening_entry_type as enum ('Issue','Receipt');
create type return_type as enum ('Dhodi','Material');
create type factory_dispatch_status as enum ('Pending','Accepted');
create type stock_take_status as enum ('Pending','Approved');

-- =========================================================================
-- MASTERS
-- =========================================================================
create table materials (
  id text primary key,
  name text not null,
  category material_category not null,
  purity numeric(6,3),                 -- null for NonGold
  locked boolean not null default false,
  wastage_applicable boolean not null default false
);

create table karigars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  wastage_pct numeric(6,3) not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- profiles mirrors auth.users 1:1, carries the role used throughout the app
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'Factory Manager',
  created_at timestamptz not null default now()
);

-- simple counters table backing the same ID formats as the blueprint's
-- worked examples (OMD-000241, JC-1042, POL-000512, GER-000174, KR-26-008521 ...)
create table id_counters (
  prefix text primary key,
  next_value bigint not null
);
insert into id_counters (prefix, next_value) values
  ('OMD',241),('FD',1),('MEL',1),('JC',1042),('POL',512),('GER',174),
  ('SET',1),('TAG',8521),('STK',41),('ISS',1),('RET',1);

create or replace function fn_next_id(p_prefix text)
returns text
language plpgsql
security definer
as $$
declare v_n bigint;
begin
  update id_counters set next_value = next_value + 1
    where prefix = p_prefix
    returning next_value - 1 into v_n;
  if v_n is null then
    insert into id_counters(prefix, next_value) values (p_prefix, 2);
    v_n := 1;
  end if;
  if p_prefix = 'TAG' then
    return 'KR-26-' || lpad(v_n::text, 6, '0');
  elsif p_prefix = 'JC' then
    return 'JC-' || v_n::text;              -- matches the blueprint's "JC-1042" style, unpadded
  else
    return p_prefix || '-' || lpad(v_n::text, 6, '0');
  end if;
end;
$$;

-- =========================================================================
-- BALANCES  (a location/material/ref keyed live balance, kept in sync with
-- the ledger inside the same transaction as every posting function below)
-- =========================================================================
-- location: 'OfficeStock' | 'Transit_O2F' | 'FactoryBin' | 'KarigarWIP' |
--           'DhodiWIP' | 'PolishWIP' | 'GeruWIP' | 'FinishedTagged' | 'Transit_F2O'
-- ref_id:   '' for global bins; job_id for KarigarWIP/DhodiWIP; polish/geru id;
--           tag_no for FinishedTagged/Transit_F2O finished-goods lines
create table balances (
  id bigint generated always as identity primary key,
  location text not null,
  material_id text not null,           -- material id, or a tag_no for finished-goods lines
  ref_id text not null default '',
  weight numeric(14,4) not null default 0,
  unique (location, material_id, ref_id)
);

create or replace function fn_bin_get(p_location text, p_material_id text, p_ref_id text default '')
returns numeric language sql stable as $$
  select coalesce((select weight from balances
    where location=p_location and material_id=p_material_id and ref_id=p_ref_id), 0);
$$;

create or replace function fn_bin_add(p_location text, p_material_id text, p_ref_id text, p_amt numeric)
returns void language plpgsql as $$
begin
  insert into balances(location, material_id, ref_id, weight)
    values (p_location, p_material_id, coalesce(p_ref_id,''), p_amt)
  on conflict (location, material_id, ref_id)
    do update set weight = round(balances.weight + excluded.weight, 4);
end;
$$;

-- =========================================================================
-- LEDGER — immutable, append-only. Every posting function below writes here.
-- =========================================================================
create table ledger (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  type text not null,
  ref text,
  material text,
  gross numeric(14,4),
  purity numeric(6,3),
  fine numeric(14,4),
  from_location text,
  to_location text,
  user_id uuid
);

create or replace function fn_ledger(p_type text, p_ref text, p_material text, p_gross numeric,
  p_purity numeric, p_fine numeric, p_from text, p_to text, p_user uuid)
returns void language sql as $$
  insert into ledger(type,ref,material,gross,purity,fine,from_location,to_location,user_id)
  values (p_type,p_ref,p_material,p_gross,p_purity,p_fine,p_from,p_to,p_user);
$$;

create or replace function fn_fine(p_weight numeric, p_purity numeric)
returns numeric language sql immutable as $$
  select case when p_purity is null then null else round(p_weight * p_purity / 100, 4) end;
$$;

-- =========================================================================
-- OFFICE DISPATCH / FACTORY ACCEPT
-- =========================================================================
create table office_dispatches (
  id text primary key,
  material_id text not null references materials(id),
  gross numeric(14,4) not null,
  purity numeric(6,3),
  fine numeric(14,4),
  status dispatch_status not null default 'Pending',
  received_gross numeric(14,4),
  discrepancy_reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create or replace function fn_office_dispatch(p_material_id text, p_gross numeric, p_purity numeric, p_user uuid)
returns text language plpgsql security definer as $$
declare
  v_mat materials%rowtype;
  v_used_purity numeric;
  v_fine numeric;
  v_id text;
  v_avail numeric;
begin
  select * into v_mat from materials where id = p_material_id;
  if v_mat is null then raise exception 'Unknown material %', p_material_id; end if;
  if p_gross <= 0 then raise exception 'Weight must be greater than zero'; end if;

  if v_mat.category = 'Bullion' then
    if p_purity is null or p_purity <= 99 or p_purity > 100 then
      raise exception 'Bullion purity must be more than 99 up to 100';
    end if;
    v_used_purity := p_purity;
  elsif v_mat.category = 'SemiFinished' then
    v_used_purity := 91.70;  -- locked, cannot be overridden by caller
  else
    v_used_purity := null;   -- NonGold
  end if;

  v_avail := fn_bin_get('OfficeStock', p_material_id);
  if p_gross > v_avail then
    raise exception 'Office stock of % is only % g', v_mat.name, v_avail;
  end if;

  v_fine := fn_fine(p_gross, v_used_purity);
  v_id := fn_next_id('OMD');

  perform fn_bin_add('OfficeStock', p_material_id, '', -p_gross);
  perform fn_bin_add('Transit_O2F', p_material_id, '', p_gross);

  insert into office_dispatches(id, material_id, gross, purity, fine, status, created_by)
    values (v_id, p_material_id, p_gross, v_used_purity, v_fine, 'Pending', p_user);

  perform fn_ledger('Office Dispatch', v_id, v_mat.name, p_gross, v_used_purity, v_fine, 'Office', 'Transit (O→F)', p_user);
  return v_id;
end;
$$;

create or replace function fn_factory_accept_exact(p_dispatch_id text, p_user uuid)
returns void language plpgsql security definer as $$
declare v_d office_dispatches%rowtype; v_mat materials%rowtype;
begin
  select * into v_d from office_dispatches where id = p_dispatch_id for update;
  if v_d is null or v_d.status <> 'Pending' then raise exception 'Dispatch not pending'; end if;
  select * into v_mat from materials where id = v_d.material_id;

  update office_dispatches set status='Accepted', received_gross=v_d.gross, accepted_at=now() where id=p_dispatch_id;
  perform fn_bin_add('Transit_O2F', v_d.material_id, '', -v_d.gross);
  perform fn_bin_add('FactoryBin', v_d.material_id, '', v_d.gross);
  perform fn_ledger('Factory Accept', v_d.id, v_mat.name, v_d.gross, v_d.purity, v_d.fine, 'Transit (O→F)', 'Factory Bin', p_user);
end;
$$;

create or replace function fn_factory_accept_discrepancy(p_dispatch_id text, p_received_gross numeric, p_reason text, p_user uuid)
returns void language plpgsql security definer as $$
declare v_d office_dispatches%rowtype;
begin
  select * into v_d from office_dispatches where id = p_dispatch_id for update;
  if v_d is null or v_d.status <> 'Pending' then raise exception 'Dispatch not pending'; end if;
  if p_received_gross = v_d.gross then
    perform fn_factory_accept_exact(p_dispatch_id, p_user);
    return;
  end if;
  update office_dispatches set status='Discrepancy', received_gross=p_received_gross, discrepancy_reason=coalesce(p_reason,'Not specified')
    where id = p_dispatch_id;
  perform fn_ledger('Discrepancy Raised', v_d.id, v_d.material_id, v_d.gross, v_d.purity, null,
    'Sent '||v_d.gross, 'Received '||p_received_gross, p_user);
end;
$$;

create or replace function fn_resolve_discrepancy(p_dispatch_id text, p_accept_received_as_is boolean, p_user uuid)
returns void language plpgsql security definer as $$
declare v_d office_dispatches%rowtype; v_mat materials%rowtype; v_qty numeric;
begin
  select * into v_d from office_dispatches where id = p_dispatch_id for update;
  if v_d is null or v_d.status <> 'Discrepancy' then raise exception 'No open discrepancy'; end if;
  select * into v_mat from materials where id = v_d.material_id;
  v_qty := case when p_accept_received_as_is then v_d.received_gross else v_d.gross end;

  update office_dispatches set status='Accepted', accepted_at=now() where id = p_dispatch_id;
  perform fn_bin_add('Transit_O2F', v_d.material_id, '', -v_d.gross);
  perform fn_bin_add('FactoryBin', v_d.material_id, '', v_qty);
  perform fn_ledger('Discrepancy Resolved', v_d.id, v_mat.name, v_qty, v_d.purity, fn_fine(v_qty, v_d.purity),
    'Transit (O→F)', 'Factory Bin', p_user);
end;
$$;

-- =========================================================================
-- MELTING
-- =========================================================================
create table melts (
  id text primary key,
  melt_type text not null,             -- 'Bullion→91.7' | '91.7 Remelt'
  input_material text not null,
  input_weight numeric(14,4) not null,
  input_purity numeric(6,3) not null,
  expected_output numeric(14,4) not null,
  auto_alloy numeric(14,4) not null default 0,
  actual_output numeric(14,4) not null,
  melt_loss numeric(14,4) not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

create or replace function fn_melt_bullion(p_material_id text, p_input_weight numeric, p_actual_output numeric, p_user uuid)
returns text language plpgsql security definer as $$
declare
  v_mat materials%rowtype; v_avail numeric; v_fine_in numeric; v_expected numeric; v_alloy numeric;
  v_alloy_avail numeric; v_loss numeric; v_id text;
begin
  select * into v_mat from materials where id = p_material_id;
  v_avail := fn_bin_get('FactoryBin', p_material_id);
  if p_input_weight <= 0 then raise exception 'Enter an input weight'; end if;
  if p_input_weight > v_avail + 0.0005 then raise exception 'Only % g of % available in Factory Bin', v_avail, v_mat.name; end if;

  v_fine_in := round(p_input_weight * v_mat.purity/100, 4);
  v_expected := round(v_fine_in/0.917, 4);
  v_alloy := round(v_expected - p_input_weight, 4);
  v_alloy_avail := fn_bin_get('FactoryBin','ALLOY');
  if v_alloy > v_alloy_avail then raise exception 'Alloy Bin has only % g, but % g required', v_alloy_avail, v_alloy; end if;
  if p_actual_output > v_expected + 0.0005 then raise exception 'Actual output cannot exceed expected output (% g) without an approved gain reason', v_expected; end if;

  v_loss := round(v_expected - p_actual_output, 4);
  v_id := fn_next_id('MEL');

  perform fn_bin_add('FactoryBin', p_material_id, '', -p_input_weight);
  perform fn_bin_add('FactoryBin', 'ALLOY', '', -v_alloy);
  perform fn_bin_add('FactoryBin', 'MELTBAR', '', p_actual_output);

  insert into melts(id, melt_type, input_material, input_weight, input_purity, expected_output, auto_alloy, actual_output, melt_loss, created_by)
    values (v_id, 'Bullion→91.7', v_mat.name, p_input_weight, v_mat.purity, v_expected, v_alloy, p_actual_output, v_loss, p_user);
  perform fn_ledger('Melt (Bullion)', v_id, v_mat.name||' → Melt Bar', p_input_weight, v_mat.purity, v_fine_in, 'Bullion Bin', 'Melt Bar Bin', p_user);
  return v_id;
end;
$$;

create or replace function fn_remelt_917(p_material_id text, p_input_weight numeric, p_actual_output numeric, p_user uuid)
returns text language plpgsql security definer as $$
declare v_mat materials%rowtype; v_avail numeric; v_loss numeric; v_id text;
begin
  select * into v_mat from materials where id = p_material_id;
  v_avail := fn_bin_get('FactoryBin', p_material_id);
  if p_input_weight <= 0 then raise exception 'Enter an input weight'; end if;
  if p_input_weight > v_avail + 0.0005 then raise exception 'Only % g of % available', v_avail, v_mat.name; end if;
  if p_actual_output > p_input_weight + 0.0005 then raise exception 'Actual output cannot exceed input weight on a 91.7→91.7 remelt'; end if;

  v_loss := round(p_input_weight - p_actual_output, 4);
  v_id := fn_next_id('MEL');

  perform fn_bin_add('FactoryBin', p_material_id, '', -p_input_weight);
  perform fn_bin_add('FactoryBin', 'MELTBAR', '', p_actual_output);

  insert into melts(id, melt_type, input_material, input_weight, input_purity, expected_output, auto_alloy, actual_output, melt_loss, created_by)
    values (v_id, '91.7 Remelt', v_mat.name, p_input_weight, 91.70, p_input_weight, 0, p_actual_output, v_loss, p_user);
  perform fn_ledger('Melt (Remelt 91.7)', v_id, v_mat.name||' → Melt Bar', p_input_weight, 91.70, fn_fine(p_input_weight,91.70), v_mat.name||' Bin', 'Melt Bar Bin', p_user);
  return v_id;
end;
$$;

-- =========================================================================
-- KARIGAR JOB CARDS
-- =========================================================================
create table job_cards (
  id text primary key,
  karigar_id uuid not null references karigars(id),
  wastage_pct numeric(6,3) not null,       -- snapshotted at creation
  status job_status not null default 'Open',
  opening_type opening_entry_type,
  opening_amount numeric(14,4),
  opening_note text,
  settlement jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create table job_issues (
  id text primary key,
  job_id text not null references job_cards(id),
  material_id text not null references materials(id),
  weight numeric(14,4) not null,
  purity numeric(6,3),
  fine numeric(14,4),
  created_at timestamptz not null default now()
);

create table job_returns (
  id text primary key,
  job_id text not null references job_cards(id),
  return_type return_type not null,
  material_id text references materials(id),
  pieces int,
  gross numeric(14,4),
  net numeric(14,4),
  weight numeric(14,4),
  created_at timestamptz not null default now()
);

create table job_stone_issues (
  id text primary key, job_id text not null references job_cards(id),
  weight numeric(14,4) not null, created_at timestamptz not null default now()
);
create table job_stone_returns (
  id text primary key, job_id text not null references job_cards(id),
  weight numeric(14,4) not null, created_at timestamptz not null default now()
);

create or replace function fn_open_job_count(p_karigar_id uuid) returns int language sql stable as $$
  select count(*)::int from job_cards where karigar_id = p_karigar_id and status = 'Open';
$$;

create or replace function fn_create_job_card(p_karigar_id uuid, p_opening_type opening_entry_type, p_opening_amount numeric, p_opening_note text, p_user uuid)
returns text language plpgsql security definer as $$
declare v_k karigars%rowtype; v_id text;
begin
  select * into v_k from karigars where id = p_karigar_id;
  if v_k is null then raise exception 'Unknown karigar'; end if;
  if fn_open_job_count(p_karigar_id) > 0 then
    raise exception '% already has an open Job Card. Only one open Job per Karigar is allowed.', v_k.name;
  end if;
  v_id := fn_next_id('JC');
  insert into job_cards(id, karigar_id, wastage_pct, status, opening_type, opening_amount, opening_note, created_by)
    values (v_id, p_karigar_id, v_k.wastage_pct, 'Open', p_opening_type, p_opening_amount, p_opening_note, p_user);
  if p_opening_type is not null then
    perform fn_ledger('Opening '||p_opening_type, v_id, 'Carry-forward', p_opening_amount, null, null,
      case when p_opening_type='Issue' then 'Previous Job' else v_k.name end,
      case when p_opening_type='Issue' then v_k.name else 'New Job' end, p_user);
  end if;
  perform fn_ledger('Job Card Created', v_id, '—', null, null, null, '—', v_k.name, p_user);
  return v_id;
end;
$$;

create or replace function fn_issue_to_karigar(p_job_id text, p_material_id text, p_weight numeric, p_user uuid)
returns void language plpgsql security definer as $$
declare v_job job_cards%rowtype; v_mat materials%rowtype; v_avail numeric; v_id text;
begin
  select * into v_job from job_cards where id = p_job_id for update;
  if v_job is null or v_job.status <> 'Open' then raise exception 'Job Card is not open'; end if;
  select * into v_mat from materials where id = p_material_id;
  v_avail := fn_bin_get('FactoryBin', p_material_id);
  if p_weight <= 0 then raise exception 'Enter a weight'; end if;
  if p_weight > v_avail + 0.0005 then raise exception 'Only % g of % available in Factory Bin', v_avail, v_mat.name; end if;

  v_id := fn_next_id('ISS');
  perform fn_bin_add('FactoryBin', p_material_id, '', -p_weight);
  perform fn_bin_add('KarigarWIP', p_material_id, p_job_id, p_weight);
  insert into job_issues(id, job_id, material_id, weight, purity, fine)
    values (v_id, p_job_id, p_material_id, p_weight, v_mat.purity, fn_fine(p_weight, v_mat.purity));
  perform fn_ledger('Karigar Issue', p_job_id, v_mat.name, p_weight, v_mat.purity, fn_fine(p_weight, v_mat.purity),
    'Factory Bin', v_job.karigar_id::text||' ('||p_job_id||')', p_user);
end;
$$;

create or replace function fn_issue_stone_to_karigar(p_job_id text, p_weight numeric, p_user uuid)
returns void language plpgsql security definer as $$
declare v_job job_cards%rowtype; v_avail numeric; v_id text;
begin
  select * into v_job from job_cards where id = p_job_id for update;
  if v_job is null or v_job.status <> 'Open' then raise exception 'Job Card is not open'; end if;
  v_avail := fn_bin_get('FactoryBin','STONE');
  if p_weight <= 0 then raise exception 'Enter a weight'; end if;
  if p_weight > v_avail + 0.0005 then raise exception 'Only % g of Stone available', v_avail; end if;
  v_id := fn_next_id('ISS');
  perform fn_bin_add('FactoryBin','STONE','', -p_weight);
  insert into job_stone_issues(id, job_id, weight) values (v_id, p_job_id, p_weight);
  perform fn_ledger('Stone Issue', p_job_id, 'Stone', p_weight, null, null, 'Stone Bin', p_job_id, p_user);
end;
$$;

create or replace function fn_receive_dhodi(p_job_id text, p_pieces int, p_gross numeric, p_net numeric, p_user uuid)
returns void language plpgsql security definer as $$
declare v_job job_cards%rowtype; v_id text;
begin
  select * into v_job from job_cards where id = p_job_id for update;
  if v_job is null or v_job.status <> 'Open' then raise exception 'Job Card is not open'; end if;
  if p_gross < p_net then raise exception 'Dhodi Gross must be greater than or equal to Net'; end if;
  if p_gross <= 0 then raise exception 'Enter Dhodi weights'; end if;
  v_id := fn_next_id('RET');
  insert into job_returns(id, job_id, return_type, pieces, gross, net) values (v_id, p_job_id, 'Dhodi', p_pieces, p_gross, p_net);
  perform fn_bin_add('DhodiWIP', 'DHODI', p_job_id, p_gross);
  perform fn_ledger('Dhodi Return', p_job_id, 'Dhodi ('||p_pieces||' pcs)', p_gross, 91.70, fn_fine(p_net,91.70), p_job_id, 'Finished WIP', p_user);
end;
$$;

create or replace function fn_job_outstanding(p_job_id text, p_material_id text) returns numeric language sql stable as $$
  select round(
    coalesce((select sum(weight) from job_issues where job_id=p_job_id and material_id=p_material_id),0) -
    coalesce((select sum(weight) from job_returns where job_id=p_job_id and return_type='Material' and material_id=p_material_id),0)
  , 4);
$$;

create or replace function fn_receive_material_return(p_job_id text, p_material_id text, p_weight numeric, p_user uuid)
returns void language plpgsql security definer as $$
declare v_job job_cards%rowtype; v_mat materials%rowtype; v_outstanding numeric; v_id text;
begin
  select * into v_job from job_cards where id = p_job_id for update;
  if v_job is null or v_job.status <> 'Open' then raise exception 'Job Card is not open'; end if;
  select * into v_mat from materials where id = p_material_id;
  v_outstanding := fn_job_outstanding(p_job_id, p_material_id);
  if p_weight <= 0 then raise exception 'Enter a weight'; end if;
  if p_weight > v_outstanding + 0.0005 then
    raise exception 'Return (% g) cannot exceed the outstanding issued balance for % (% g)', p_weight, v_mat.name, v_outstanding;
  end if;
  v_id := fn_next_id('RET');
  insert into job_returns(id, job_id, return_type, material_id, weight) values (v_id, p_job_id, 'Material', p_material_id, p_weight);
  perform fn_bin_add('KarigarWIP', p_material_id, p_job_id, -p_weight);
  perform fn_bin_add('FactoryBin', p_material_id, '', p_weight);
  perform fn_ledger('Material Return', p_job_id, v_mat.name, p_weight, v_mat.purity, fn_fine(p_weight, v_mat.purity), p_job_id, 'Factory Bin', p_user);
end;
$$;

create or replace function fn_receive_stone_return(p_job_id text, p_weight numeric, p_user uuid)
returns void language plpgsql security definer as $$
declare v_job job_cards%rowtype; v_id text;
begin
  select * into v_job from job_cards where id = p_job_id for update;
  if v_job is null or v_job.status <> 'Open' then raise exception 'Job Card is not open'; end if;
  if p_weight <= 0 then raise exception 'Enter a weight'; end if;
  v_id := fn_next_id('RET');
  insert into job_stone_returns(id, job_id, weight) values (v_id, p_job_id, p_weight);
  perform fn_bin_add('FactoryBin','STONE','', p_weight);
  perform fn_ledger('Stone Return', p_job_id, 'Stone', p_weight, null, null, p_job_id, 'Stone Bin', p_user);
end;
$$;

-- =========================================================================
-- POLISH / GERU
-- =========================================================================
create table polish_records (
  id text primary key, job_id text not null references job_cards(id),
  issued_gross numeric(14,4) not null, returned_gross numeric(14,4), loss numeric(14,4),
  status process_status not null default 'Open',
  created_at timestamptz not null default now(), closed_at timestamptz
);
create table geru_records (
  id text primary key, job_id text not null references job_cards(id),
  issued_gross numeric(14,4) not null, returned_gross numeric(14,4), raw_variance numeric(14,4), direction text,
  status process_status not null default 'Open',
  created_at timestamptz not null default now(), closed_at timestamptz
);

create or replace function fn_polish_issue(p_job_id text, p_gross numeric, p_user uuid)
returns text language plpgsql security definer as $$
declare v_avail numeric; v_id text;
begin
  v_avail := fn_bin_get('DhodiWIP','DHODI', p_job_id);
  if p_gross <= 0 then raise exception 'Enter a weight'; end if;
  if p_gross > v_avail + 0.0005 then raise exception 'Only % g of Dhodi WIP available for %', v_avail, p_job_id; end if;
  v_id := fn_next_id('POL');
  perform fn_bin_add('DhodiWIP','DHODI', p_job_id, -p_gross);
  perform fn_bin_add('PolishWIP','DHODI', v_id, p_gross);
  insert into polish_records(id, job_id, issued_gross, status) values (v_id, p_job_id, p_gross, 'Open');
  perform fn_ledger('Polish Issue', v_id, 'Dhodi', p_gross, null, null, 'Finished WIP', 'Polish WIP', p_user);
  return v_id;
end;
$$;

create or replace function fn_polish_return(p_polish_id text, p_returned_gross numeric, p_user uuid)
returns void language plpgsql security definer as $$
declare v_rec polish_records%rowtype; v_loss numeric;
begin
  select * into v_rec from polish_records where id = p_polish_id for update;
  if v_rec is null or v_rec.status <> 'Open' then raise exception 'Polish ID is not open'; end if;
  if p_returned_gross < 0 then raise exception 'Return weight cannot be negative'; end if;
  v_loss := round(v_rec.issued_gross - p_returned_gross, 4);
  update polish_records set returned_gross=p_returned_gross, loss=v_loss, status='Closed', closed_at=now() where id = p_polish_id;
  perform fn_bin_add('PolishWIP','DHODI', p_polish_id, -v_rec.issued_gross);
  perform fn_bin_add('DhodiWIP','DHODI', v_rec.job_id, p_returned_gross);
  perform fn_ledger('Polish Return', p_polish_id, 'Dhodi', p_returned_gross, null, null, 'Polish WIP', 'Finished WIP', p_user);
end;
$$;

create or replace function fn_geru_issue(p_job_id text, p_gross numeric, p_user uuid)
returns text language plpgsql security definer as $$
declare v_avail numeric; v_id text;
begin
  v_avail := fn_bin_get('DhodiWIP','DHODI', p_job_id);
  if p_gross <= 0 then raise exception 'Enter a weight'; end if;
  if p_gross > v_avail + 0.0005 then raise exception 'Only % g of Finished WIP available for %', v_avail, p_job_id; end if;
  v_id := fn_next_id('GER');
  perform fn_bin_add('DhodiWIP','DHODI', p_job_id, -p_gross);
  perform fn_bin_add('GeruWIP','DHODI', v_id, p_gross);
  insert into geru_records(id, job_id, issued_gross, status) values (v_id, p_job_id, p_gross, 'Open');
  perform fn_ledger('Geru Issue', v_id, 'Product', p_gross, null, null, 'Finished WIP', 'Geru WIP', p_user);
  return v_id;
end;
$$;

create or replace function fn_geru_return(p_geru_id text, p_returned_gross numeric, p_user uuid)
returns void language plpgsql security definer as $$
declare v_rec geru_records%rowtype; v_var numeric; v_dir text;
begin
  select * into v_rec from geru_records where id = p_geru_id for update;
  if v_rec is null or v_rec.status <> 'Open' then raise exception 'Geru ID is not open'; end if;
  if p_returned_gross < 0 then raise exception 'Return weight cannot be negative'; end if;
  v_var := round(v_rec.issued_gross - p_returned_gross, 4);
  v_dir := case when v_var < 0 then 'Added' when v_var > 0 then 'Reduced' else 'Unchanged' end;
  update geru_records set returned_gross=p_returned_gross, raw_variance=v_var, direction=v_dir, status='Closed', closed_at=now() where id = p_geru_id;
  perform fn_bin_add('GeruWIP','DHODI', p_geru_id, -v_rec.issued_gross);
  perform fn_bin_add('DhodiWIP','DHODI', v_rec.job_id, p_returned_gross);
  perform fn_ledger('Geru Return', p_geru_id, 'Product', p_returned_gross, null, null, 'Geru WIP', 'Finished WIP', p_user);
end;
$$;

-- =========================================================================
-- BEADS / STONES SETTING  (zero-tolerance reconciliation)
-- =========================================================================
create table setting_records (
  id text primary key, job_id text not null references job_cards(id),
  product_gross numeric(14,4) not null, stones_issued numeric(14,4) not null default 0, other_material_issued numeric(14,4) not null default 0,
  final_product_gross numeric(14,4), unused_stones_returned numeric(14,4), unused_material_returned numeric(14,4), mismatch numeric(14,4),
  status process_status not null default 'Open',
  created_at timestamptz not null default now(), closed_at timestamptz
);

create or replace function fn_setting_issue(p_job_id text, p_product_gross numeric, p_stones_issued numeric, p_other_material_issued numeric, p_user uuid)
returns text language plpgsql security definer as $$
declare v_avail_product numeric; v_avail_stone numeric; v_id text;
begin
  v_avail_product := fn_bin_get('DhodiWIP','DHODI', p_job_id);
  v_avail_stone := fn_bin_get('FactoryBin','STONE');
  if p_product_gross <= 0 then raise exception 'Enter the product weight'; end if;
  if p_product_gross > v_avail_product + 0.0005 then raise exception 'Only % g of finished product available for %', v_avail_product, p_job_id; end if;
  if p_stones_issued > v_avail_stone + 0.0005 then raise exception 'Only % g of Stone available', v_avail_stone; end if;
  v_id := fn_next_id('SET');
  perform fn_bin_add('DhodiWIP','DHODI', p_job_id, -p_product_gross);
  perform fn_bin_add('FactoryBin','STONE','', -p_stones_issued);
  insert into setting_records(id, job_id, product_gross, stones_issued, other_material_issued, status)
    values (v_id, p_job_id, p_product_gross, p_stones_issued, p_other_material_issued, 'Open');
  perform fn_ledger('Setting Issue', v_id, 'Product + Stone', p_product_gross+p_stones_issued+p_other_material_issued, null, null, 'Finished WIP / Stone Bin', 'Setting WIP', p_user);
  return v_id;
end;
$$;

create or replace function fn_setting_return(p_setting_id text, p_final_product_gross numeric, p_unused_stones_returned numeric, p_unused_material_returned numeric, p_user uuid)
returns void language plpgsql security definer as $$
declare v_rec setting_records%rowtype; v_total_out numeric; v_total_back numeric; v_diff numeric;
begin
  select * into v_rec from setting_records where id = p_setting_id for update;
  if v_rec is null or v_rec.status <> 'Open' then raise exception 'Setting ID is not open'; end if;
  v_total_out := round(v_rec.product_gross + v_rec.stones_issued + v_rec.other_material_issued, 4);
  v_total_back := round(p_final_product_gross + p_unused_stones_returned + p_unused_material_returned, 4);
  v_diff := round(v_total_out - v_total_back, 4);
  update setting_records set final_product_gross=p_final_product_gross, unused_stones_returned=p_unused_stones_returned,
    unused_material_returned=p_unused_material_returned, mismatch=v_diff where id = p_setting_id;
  if abs(v_diff) > 0.0005 then
    raise exception 'BLOCKED — mismatch of % g. Total Out % g ≠ Total Back % g. No stone/beads loss is accepted.', v_diff, v_total_out, v_total_back;
  end if;
  update setting_records set status='Closed', closed_at=now() where id = p_setting_id;
  perform fn_bin_add('DhodiWIP','DHODI', v_rec.job_id, p_final_product_gross);
  perform fn_bin_add('FactoryBin','STONE','', p_unused_stones_returned);
  perform fn_ledger('Setting Return', p_setting_id, 'Finished Product', p_final_product_gross, null, null, 'Setting WIP', 'Finished WIP', p_user);
end;
$$;

-- =========================================================================
-- SETTLEMENT
-- =========================================================================
create or replace function fn_job_semi_finished_used(p_job_id text) returns numeric language sql stable as $$
  select coalesce(round(sum(greatest(0,
    coalesce((select sum(ji.weight) from job_issues ji join materials m on m.id=ji.material_id
       where ji.job_id=p_job_id and m.id = mm.id),0) -
    coalesce((select sum(jr.weight) from job_returns jr where jr.job_id=p_job_id and jr.return_type='Material' and jr.material_id=mm.id),0)
  )),4),0)
  from materials mm where mm.category='SemiFinished';
$$;

create or replace function fn_job_dhodi_net_total(p_job_id text) returns numeric language sql stable as $$
  select coalesce(round(sum(net),4),0) from job_returns where job_id=p_job_id and return_type='Dhodi';
$$;

create or replace function fn_compute_settlement(p_job_id text) returns jsonb
language plpgsql stable as $$
declare
  v_job job_cards%rowtype;
  v_opening_issue numeric := 0; v_opening_receipt numeric := 0;
  v_total_issued numeric; v_dhodi_net numeric; v_material_returns numeric; v_total_received numeric;
  v_used_semi numeric; v_wastage_base numeric; v_allowed_wastage numeric; v_variance numeric;
  v_saving numeric := 0; v_loss numeric := 0;
begin
  select * into v_job from job_cards where id = p_job_id;
  if v_job.opening_type = 'Issue' then v_opening_issue := v_job.opening_amount; end if;
  if v_job.opening_type = 'Receipt' then v_opening_receipt := v_job.opening_amount; end if;

  v_total_issued := round(coalesce((select sum(weight) from job_issues where job_id=p_job_id),0) + v_opening_issue, 4);
  v_dhodi_net := fn_job_dhodi_net_total(p_job_id);
  v_material_returns := coalesce(round((select sum(weight) from job_returns where job_id=p_job_id and return_type='Material'),4),0);
  v_total_received := round(v_dhodi_net + v_material_returns + v_opening_receipt, 4);
  v_used_semi := fn_job_semi_finished_used(p_job_id);
  v_wastage_base := round(v_dhodi_net - v_used_semi, 4);
  v_allowed_wastage := round(v_wastage_base * v_job.wastage_pct/100, 4);
  v_variance := round(v_total_issued - v_total_received - v_allowed_wastage, 4);
  if v_variance < 0 then v_saving := round(abs(v_variance),4); elsif v_variance > 0 then v_loss := v_variance; end if;

  return jsonb_build_object(
    'totalIssued', v_total_issued, 'totalReceived', v_total_received, 'dhodiNet', v_dhodi_net,
    'materialReturns', v_material_returns, 'usedSemiFinished', v_used_semi, 'wastageBase', v_wastage_base,
    'allowedWastage', v_allowed_wastage, 'variance', v_variance, 'saving', v_saving, 'loss', v_loss
  );
end;
$$;

create or replace function fn_job_gate_checks(p_job_id text) returns text[]
language plpgsql stable as $$
declare v_issues text[] := '{}';
begin
  if exists (select 1 from polish_records where job_id=p_job_id and status='Open') then
    v_issues := array_append(v_issues, 'Open Polish ID exists.');
  end if;
  if exists (select 1 from geru_records where job_id=p_job_id and status='Open') then
    v_issues := array_append(v_issues, 'Open Geru ID exists.');
  end if;
  if exists (select 1 from setting_records where job_id=p_job_id and status='Open') then
    v_issues := array_append(v_issues, 'Open Setting ID exists.');
  end if;
  if not exists (select 1 from job_returns where job_id=p_job_id and return_type='Dhodi') then
    v_issues := array_append(v_issues, 'No Dhodi has been received yet.');
  end if;
  return v_issues;
end;
$$;

create or replace function fn_settle_job(p_job_id text, p_user uuid) returns text
language plpgsql security definer as $$
declare
  v_job job_cards%rowtype; v_gates text[]; v_s jsonb; v_opening_type opening_entry_type;
  v_opening_amount numeric; v_opening_note text; v_new_id text;
begin
  select * into v_job from job_cards where id = p_job_id for update;
  if v_job is null or v_job.status <> 'Open' then raise exception 'Job is not open'; end if;
  v_gates := fn_job_gate_checks(p_job_id);
  if array_length(v_gates,1) > 0 then raise exception 'Cannot settle — %', array_to_string(v_gates,' '); end if;

  v_s := fn_compute_settlement(p_job_id);
  update job_cards set status='Settled', settlement=v_s, settled_at=now() where id=p_job_id;
  perform fn_ledger('Job Settlement', p_job_id, 'Settlement', (v_s->>'variance')::numeric, null, null,
    v_job.karigar_id::text, case when (v_s->>'saving')::numeric>0 then 'Saving' when (v_s->>'loss')::numeric>0 then 'Loss' else 'Balanced' end, p_user);

  if (v_s->>'saving')::numeric > 0 then
    v_opening_type := 'Receipt'; v_opening_amount := (v_s->>'saving')::numeric; v_opening_note := 'Old Saving from Karigar ('||p_job_id||')';
  elsif (v_s->>'loss')::numeric > 0 then
    v_opening_type := 'Issue'; v_opening_amount := (v_s->>'loss')::numeric; v_opening_note := 'Previous Loss ('||p_job_id||')';
  else
    v_opening_type := null; v_opening_amount := null; v_opening_note := null;
  end if;

  v_new_id := fn_create_job_card(v_job.karigar_id, v_opening_type, v_opening_amount, v_opening_note, p_user);
  return v_new_id;
end;
$$;

-- =========================================================================
-- TAGGING / KRAMASYA
-- =========================================================================
create table tags (
  tag_no text primary key, job_id text not null references job_cards(id),
  pieces int, gross numeric(14,4) not null, net numeric(14,4), purity numeric(6,3),
  synced boolean not null default true,
  dispatch_status text not null default 'InFactory',   -- InFactory | Transit | Delivered
  created_by uuid, created_at timestamptz not null default now()
);

create or replace function fn_tag_product(p_job_id text, p_pieces int, p_gross numeric, p_net numeric, p_purity numeric, p_user uuid)
returns text language plpgsql security definer as $$
declare v_avail numeric; v_tag text;
begin
  v_avail := fn_bin_get('DhodiWIP','DHODI', p_job_id);
  if p_gross <= 0 then raise exception 'Enter Gross weight'; end if;
  if p_gross > v_avail + 0.0005 then raise exception 'Only % g of finished product available on this Job Card to tag', v_avail; end if;
  v_tag := fn_next_id('TAG');
  perform fn_bin_add('DhodiWIP','DHODI', p_job_id, -p_gross);
  perform fn_bin_add('FinishedTagged', v_tag, '', p_gross);
  insert into tags(tag_no, job_id, pieces, gross, net, purity, synced, created_by)
    values (v_tag, p_job_id, p_pieces, p_gross, p_net, p_purity, true, p_user);
  perform fn_ledger('Tag Created', v_tag, 'Job '||p_job_id, p_gross, p_purity, fn_fine(p_net,p_purity), 'Finished WIP', 'Finished / Tagged', p_user);
  return v_tag;
end;
$$;

-- =========================================================================
-- FACTORY DISPATCH / OFFICE ACCEPT (return leg)
-- =========================================================================
create table factory_dispatches (
  id text primary key, category text not null, status factory_dispatch_status not null default 'Pending',
  created_by uuid, created_at timestamptz not null default now(), accepted_at timestamptz
);
create table factory_dispatch_items (
  id uuid primary key default gen_random_uuid(), dispatch_id text not null references factory_dispatches(id),
  tag_no text references tags(tag_no), material_id text references materials(id),
  gross numeric(14,4) not null, net numeric(14,4), purity numeric(6,3)
);

create or replace function fn_factory_dispatch_finished(p_tag_nos text[], p_user uuid) returns text
language plpgsql security definer as $$
declare v_id text; v_tag tags%rowtype; v_total numeric := 0; v_n int := 0;
begin
  v_id := fn_next_id('FD');
  insert into factory_dispatches(id, category, status, created_by) values (v_id, 'Finished Goods', 'Pending', p_user);
  for v_tag in select * from tags where tag_no = any(p_tag_nos) and dispatch_status='InFactory' loop
    insert into factory_dispatch_items(dispatch_id, tag_no, gross, net, purity) values (v_id, v_tag.tag_no, v_tag.gross, v_tag.net, v_tag.purity);
    perform fn_bin_add('FinishedTagged', v_tag.tag_no, '', -v_tag.gross);
    perform fn_bin_add('Transit_F2O', v_tag.tag_no, '', v_tag.gross);
    update tags set dispatch_status = 'Transit' where tag_no = v_tag.tag_no;
    v_total := v_total + v_tag.gross; v_n := v_n + 1;
  end loop;
  if v_n = 0 then raise exception 'Select at least one un-dispatched tag'; end if;
  perform fn_ledger('Factory Dispatch', v_id, 'Finished Goods ('||v_n||' tags)', v_total, null, null, 'Finished / Tagged', 'Transit (F→O)', p_user);
  return v_id;
end;
$$;

create or replace function fn_factory_dispatch_material(p_material_id text, p_weight numeric, p_user uuid) returns text
language plpgsql security definer as $$
declare v_mat materials%rowtype; v_avail numeric; v_id text;
begin
  select * into v_mat from materials where id = p_material_id;
  v_avail := fn_bin_get('FactoryBin', p_material_id);
  if p_weight <= 0 then raise exception 'Enter a weight'; end if;
  if p_weight > v_avail + 0.0005 then raise exception 'Only % g of % available', v_avail, v_mat.name; end if;
  v_id := fn_next_id('FD');
  perform fn_bin_add('FactoryBin', p_material_id, '', -p_weight);
  perform fn_bin_add('Transit_F2O', p_material_id, '', p_weight);
  insert into factory_dispatches(id, category, status, created_by) values (v_id, v_mat.category::text, 'Pending', p_user);
  insert into factory_dispatch_items(dispatch_id, material_id, gross, purity) values (v_id, p_material_id, p_weight, v_mat.purity);
  perform fn_ledger('Factory Dispatch', v_id, v_mat.name, p_weight, v_mat.purity, fn_fine(p_weight, v_mat.purity), 'Factory Bin', 'Transit (F→O)', p_user);
  return v_id;
end;
$$;

create or replace function fn_office_accept(p_dispatch_id text, p_user uuid) returns void
language plpgsql security definer as $$
declare v_fd factory_dispatches%rowtype; v_item record; v_fine_total numeric := 0;
begin
  select * into v_fd from factory_dispatches where id = p_dispatch_id for update;
  if v_fd is null or v_fd.status <> 'Pending' then raise exception 'Dispatch not pending'; end if;
  update factory_dispatches set status='Accepted', accepted_at=now() where id = p_dispatch_id;

  for v_item in select * from factory_dispatch_items where dispatch_id = p_dispatch_id loop
    if v_item.tag_no is not null then
      perform fn_bin_add('Transit_F2O', v_item.tag_no, '', -v_item.gross);
      update tags set dispatch_status='Delivered' where tag_no = v_item.tag_no;
      perform fn_bin_add('OfficeStock', 'FINISHED_'||v_item.tag_no, '', v_item.gross);
      v_fine_total := v_fine_total + coalesce(round(v_item.gross*91.70/100,4),0);
    else
      perform fn_bin_add('Transit_F2O', v_item.material_id, '', -v_item.gross);
      perform fn_bin_add('OfficeStock', v_item.material_id, '', v_item.gross);
      v_fine_total := v_fine_total + coalesce(fn_fine(v_item.gross, v_item.purity),0);
    end if;
  end loop;

  perform fn_ledger('Office Accept', v_fd.id, v_fd.category, null, null, v_fine_total, 'Transit (F→O)', 'Office Stock', p_user);
end;
$$;

-- =========================================================================
-- STOCK TAKE
-- =========================================================================
create table stock_takes (
  id text primary key, material_id text not null references materials(id),
  system_weight numeric(14,4) not null, physical_weight numeric(14,4) not null, variance numeric(14,4) not null,
  status stock_take_status not null default 'Pending', reason text,
  created_at timestamptz not null default now(), approved_at timestamptz
);

create or replace function fn_stock_take(p_material_id text, p_physical_weight numeric, p_user uuid) returns text
language plpgsql security definer as $$
declare v_sys numeric; v_id text;
begin
  v_sys := fn_bin_get('FactoryBin', p_material_id);
  v_id := fn_next_id('STK');
  insert into stock_takes(id, material_id, system_weight, physical_weight, variance, status)
    values (v_id, p_material_id, v_sys, p_physical_weight, round(p_physical_weight - v_sys,4), 'Pending');
  return v_id;
end;
$$;

create or replace function fn_approve_stock_take(p_stock_take_id text, p_reason text, p_user uuid) returns void
language plpgsql security definer as $$
declare v_stk stock_takes%rowtype; v_mat materials%rowtype;
begin
  select * into v_stk from stock_takes where id = p_stock_take_id for update;
  if v_stk is null or v_stk.status <> 'Pending' then raise exception 'Nothing pending'; end if;
  select * into v_mat from materials where id = v_stk.material_id;
  update stock_takes set status='Approved', reason=coalesce(p_reason,'Approved by Admin'), approved_at=now() where id = p_stock_take_id;
  perform fn_bin_add('FactoryBin', v_stk.material_id, '', v_stk.variance);
  perform fn_ledger('Stock Adjustment', v_stk.id, v_mat.name, v_stk.variance, v_mat.purity, fn_fine(v_stk.variance, v_mat.purity), 'Stock Take', 'Factory Bin', p_user);
end;
$$;

-- =========================================================================
-- SEED MASTER DATA — materials + go-live opening balances
-- =========================================================================
insert into materials (id,name,category,purity,locked,wastage_applicable) values
 ('BUL9990','Bullion 99.90%','Bullion',99.90,false,false),
 ('BUL9950','Bullion 99.50%','Bullion',99.50,false,false),
 ('EF','EF','SemiFinished',91.70,true,false),
 ('GEJJE','Gejje','SemiFinished',91.70,true,false),
 ('SCREW','Screw','SemiFinished',91.70,true,false),
 ('REPAIR','Repair','SemiFinished',91.70,true,false),
 ('MELTBAR','Melt Bar','Manufacturing',91.70,true,true),
 ('DYE','Dye','Manufacturing',91.70,true,true),
 ('KDM','KDM','Manufacturing',91.70,true,true),
 ('BALLS','Balls','Manufacturing',91.70,true,true),
 ('CHAIN','Chain','Manufacturing',91.70,true,true),
 ('STONE','Stone','NonGold',null,false,false),
 ('ALLOY','Alloy','NonGold',null,false,false);

-- Go-live opening stock. Logged as OPENING ledger rows so they are visible
-- in the "Office / Opening Gold Investment" reconciliation from day one.
do $$
declare r record; v_fine numeric;
begin
  perform fn_bin_add('FactoryBin','MELTBAR','', 500);
  perform fn_bin_add('FactoryBin','DYE','', 300);
  perform fn_bin_add('FactoryBin','KDM','', 400);
  perform fn_bin_add('FactoryBin','BALLS','', 150);
  perform fn_bin_add('FactoryBin','CHAIN','', 150);
  perform fn_bin_add('FactoryBin','ALLOY','', 200);
  perform fn_bin_add('FactoryBin','STONE','', 200);
  perform fn_bin_add('OfficeStock','BUL9990','', 5000);
  perform fn_bin_add('OfficeStock','BUL9950','', 3000);
  perform fn_bin_add('OfficeStock','EF','', 2000);
  perform fn_bin_add('OfficeStock','GEJJE','', 2000);
  perform fn_bin_add('OfficeStock','SCREW','', 1000);
  perform fn_bin_add('OfficeStock','REPAIR','', 1000);
  perform fn_bin_add('OfficeStock','STONE','', 500);
  perform fn_bin_add('OfficeStock','ALLOY','', 500);

  for r in select id, name, purity from materials where category <> 'NonGold' and fn_bin_get('FactoryBin', id) > 0 loop
    v_fine := round(fn_bin_get('FactoryBin', r.id) * r.purity/100, 4);
    perform fn_ledger('Opening Balance', 'OPENING', r.name, fn_bin_get('FactoryBin', r.id), r.purity, v_fine, 'Go-Live Migration', 'Factory Bin', null);
  end loop;
end $$;
