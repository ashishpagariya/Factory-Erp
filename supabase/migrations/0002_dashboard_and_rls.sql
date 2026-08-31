-- =========================================================================
-- Dashboard / reconciliation aggregation functions.
-- These mirror the formulas validated in the click-through prototype,
-- including the double-counting fix: "Gold With Karigars" must be computed
-- from Total Issued − Total Received on OPEN jobs only (via fn_compute_settlement),
-- never as a naive per-material outstanding balance — otherwise gold already
-- embodied in a returned Dhodi/finished product gets counted twice.
-- =========================================================================

create or replace function fn_total_fine_by_category(p_category material_category) returns numeric
language sql stable as $$
  select coalesce(round(sum(fn_bin_get('FactoryBin', m.id, '') * m.purity/100),4),0)
  from materials m where m.category = p_category;
$$;

create or replace function fn_karigar_wip_fine() returns numeric
language plpgsql stable as $$
declare v_sum numeric := 0; v_job record; v_s jsonb;
begin
  for v_job in select id from job_cards where status = 'Open' loop
    v_s := fn_compute_settlement(v_job.id);
    v_sum := v_sum + greatest(0, (v_s->>'totalIssued')::numeric - (v_s->>'totalReceived')::numeric) * 0.917;
  end loop;
  return round(v_sum, 4);
end;
$$;

create or replace function fn_settled_job_realized_loss_fine() returns numeric
language plpgsql stable as $$
declare v_sum numeric := 0; v_job record;
begin
  for v_job in select settlement from job_cards where status = 'Settled' loop
    v_sum := v_sum + ((v_job.settlement->>'totalIssued')::numeric - (v_job.settlement->>'totalReceived')::numeric) * 0.917;
  end loop;
  return round(v_sum, 4);
end;
$$;

create or replace function fn_process_wip_fine() returns numeric
language sql stable as $$
  select round((
    coalesce((select sum(weight) from balances where location='DhodiWIP'),0) +
    coalesce((select sum(weight) from balances where location='PolishWIP'),0) +
    coalesce((select sum(weight) from balances where location='GeruWIP'),0)
  ) * 91.70/100, 4);
$$;

create or replace function fn_finished_tagged_fine() returns numeric
language sql stable as $$
  select round(coalesce((select sum(weight) from balances where location='FinishedTagged'),0) * 91.70/100, 4);
$$;

create or replace function fn_transit_fine(p_dir text) returns numeric
language plpgsql stable as $$
declare v_loc text; v_sum numeric := 0; r record;
begin
  v_loc := case when p_dir='O2F' then 'Transit_O2F' else 'Transit_F2O' end;
  for r in select b.material_id, b.weight from balances b where b.location = v_loc loop
    if exists (select 1 from materials where id = r.material_id and category='NonGold') then
      continue;
    elsif exists (select 1 from materials where id = r.material_id) then
      v_sum := v_sum + r.weight * (select purity from materials where id=r.material_id) / 100;
    else
      v_sum := v_sum + r.weight * 91.70/100; -- tag_no key
    end if;
  end loop;
  return round(v_sum, 4);
end;
$$;

create or replace function fn_total_melt_loss_fine() returns numeric language sql stable as $$
  select coalesce(round(sum(melt_loss) * 0.917, 4), 0) from melts;
$$;
create or replace function fn_total_polish_loss_fine() returns numeric language sql stable as $$
  select coalesce(round(sum(loss) * 0.917, 4), 0) from polish_records where status='Closed';
$$;

create or replace function fn_current_accountable_fine() returns numeric
language sql stable as $$
  select round(
    fn_total_fine_by_category('Bullion') + fn_total_fine_by_category('SemiFinished') + fn_total_fine_by_category('Manufacturing')
    + fn_karigar_wip_fine() + fn_process_wip_fine() + fn_finished_tagged_fine() + fn_transit_fine('O2F') + fn_transit_fine('F2O')
  , 4);
$$;

create or replace function fn_office_investment_fine() returns numeric language sql stable as $$
  select coalesce(round(sum(fine),4),0) from ledger where type in ('Office Dispatch','Opening Balance');
$$;
create or replace function fn_office_received_fine() returns numeric language sql stable as $$
  select coalesce(round(sum(fine),4),0) from ledger where type = 'Office Accept';
$$;
create or replace function fn_stock_adjustments_fine() returns numeric language sql stable as $$
  select coalesce(round(sum(fine),4),0) from ledger where type = 'Stock Adjustment';
$$;

create or replace function fn_unreconciled_fine() returns numeric
language sql stable as $$
  select round(
    (fn_office_investment_fine() - fn_office_received_fine()) -
    (fn_current_accountable_fine() + fn_total_melt_loss_fine() + fn_total_polish_loss_fine() + fn_settled_job_realized_loss_fine() + fn_stock_adjustments_fine())
  , 4);
$$;

-- One convenience RPC the dashboard page calls once for its full set of numbers.
create or replace function fn_dashboard_snapshot() returns jsonb
language plpgsql stable as $$
declare v jsonb;
begin
  v := jsonb_build_object(
    'bullionFine', fn_total_fine_by_category('Bullion'),
    'semiFine', fn_total_fine_by_category('SemiFinished'),
    'mfgFine', fn_total_fine_by_category('Manufacturing'),
    'karigarWipFine', fn_karigar_wip_fine(),
    'processWipFine', fn_process_wip_fine(),
    'finishedTaggedFine', fn_finished_tagged_fine(),
    'transitO2F', fn_transit_fine('O2F'),
    'transitF2O', fn_transit_fine('F2O'),
    'currentAccountableFine', fn_current_accountable_fine(),
    'officeInvestmentFine', fn_office_investment_fine(),
    'officeReceivedFine', fn_office_received_fine(),
    'authorisedLossFine', round(fn_total_melt_loss_fine()+fn_total_polish_loss_fine()+fn_settled_job_realized_loss_fine(),4),
    'unreconciledFine', fn_unreconciled_fine()
  );
  return v;
end;
$$;

-- =========================================================================
-- ROW LEVEL SECURITY
-- Every table is readable by any signed-in user (factory floor staff all
-- need visibility for their dashboards/reports). Writes only ever happen
-- through the SECURITY DEFINER functions above, called from server actions
-- that check role in the app layer — so no direct-table INSERT/UPDATE/DELETE
-- policies are granted to normal roles at all.
-- =========================================================================
alter table materials enable row level security;
alter table karigars enable row level security;
alter table profiles enable row level security;
alter table office_dispatches enable row level security;
alter table melts enable row level security;
alter table job_cards enable row level security;
alter table job_issues enable row level security;
alter table job_returns enable row level security;
alter table job_stone_issues enable row level security;
alter table job_stone_returns enable row level security;
alter table polish_records enable row level security;
alter table geru_records enable row level security;
alter table setting_records enable row level security;
alter table tags enable row level security;
alter table factory_dispatches enable row level security;
alter table factory_dispatch_items enable row level security;
alter table stock_takes enable row level security;
alter table ledger enable row level security;
alter table balances enable row level security;

create policy "read all — signed in" on materials for select using (auth.role() = 'authenticated');
create policy "read all — signed in" on karigars for select using (auth.role() = 'authenticated');
create policy "read own profile" on profiles for select using (auth.uid() = id);
create policy "read all — signed in" on office_dispatches for select using (auth.role() = 'authenticated');
create policy "read all — signed in" on melts for select using (auth.role() = 'authenticated');
create policy "read all — signed in" on job_cards for select using (auth.role() = 'authenticated');
create policy "read all — signed in" on job_issues for select using (auth.role() = 'authenticated');
create policy "read all — signed in" on job_returns for select using (auth.role() = 'authenticated');
create policy "read all — signed in" on job_stone_issues for select using (auth.role() = 'authenticated');
create policy "read all — signed in" on job_stone_returns for select using (auth.role() = 'authenticated');
create policy "read all — signed in" on polish_records for select using (auth.role() = 'authenticated');
create policy "read all — signed in" on geru_records for select using (auth.role() = 'authenticated');
create policy "read all — signed in" on setting_records for select using (auth.role() = 'authenticated');
create policy "read all — signed in" on tags for select using (auth.role() = 'authenticated');
create policy "read all — signed in" on factory_dispatches for select using (auth.role() = 'authenticated');
create policy "read all — signed in" on factory_dispatch_items for select using (auth.role() = 'authenticated');
create policy "read all — signed in" on stock_takes for select using (auth.role() = 'authenticated');
create policy "read all — signed in" on ledger for select using (auth.role() = 'authenticated');
create policy "read all — signed in" on balances for select using (auth.role() = 'authenticated');

-- profile auto-created on signup, default role Factory Manager (Admin promotes via Supabase dashboard / SQL)
create or replace function fn_handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name, role) values (new.id, new.raw_user_meta_data->>'full_name', 'Factory Manager');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function fn_handle_new_user();
