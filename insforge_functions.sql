-- Function: award_points
create or replace function award_points(
  p_org_id text,
  p_user_id text,
  p_event_key text,
  p_ref_table text default null,
  p_ref_id text default null
) returns json as $$
declare
  v_rule record;
  v_points int;
  v_exists boolean;
  v_total_id text;
  v_current_total int;
  v_new_total int;
begin
  -- Get rule
  select * into v_rule from points_rules where id = p_event_key;
  
  if v_rule is null or v_rule.is_active = false or v_rule.points <= 0 then
    return 0;
  end if;
  
  v_points := v_rule.points;

  -- Check duplicate if ref provided
  if p_ref_table is not null and p_ref_id is not null then
    select exists(
      select 1 from points_events 
      where user_id = p_user_id 
      and event_key = p_event_key 
      and ref_table = p_ref_table 
      and ref_id = p_ref_id
    ) into v_exists;
    
    if v_exists then
      return 0;
    end if;
  end if;

  -- Insert event
  insert into points_events (org_id, user_id, event_key, points, ref_table, ref_id)
  values (p_org_id, p_user_id, p_event_key, v_points, p_ref_table, p_ref_id);

  -- Upsert totals
  select id, total_points into v_total_id, v_current_total 
  from points_totals 
  where org_id = p_org_id and user_id = p_user_id;

  if v_total_id is not null then
    update points_totals 
    set total_points = (v_current_total + v_points), updated_at = now()
    where id = v_total_id;
  else
    insert into points_totals (org_id, user_id, total_points, updated_at)
    values (p_org_id, p_user_id, v_points, now());
  end if;

  return v_points;
end;
$$ language plpgsql security definer;

-- Function: seed_default_accounts
create or replace function seed_default_accounts(
  p_org_id text,
  p_user_id text
) returns void as $$
declare
  v_exists boolean;
begin
  select exists(select 1 from accounts where user_id = p_user_id limit 1) into v_exists;
  
  if v_exists then
    return;
  end if;

  insert into accounts (user_id, org_id, name, type, currency, opening_balance)
  values (p_user_id, p_org_id, 'Efectivo', 'CASH', 'MXN', 0);
end;
$$ language plpgsql security definer;

-- Function: seed_default_categories
create or replace function seed_default_categories(
  p_org_id text,
  p_user_id text
) returns void as $$
declare
  v_exists boolean;
begin
  select exists(select 1 from categories where org_id = p_org_id and user_id = p_user_id limit 1) into v_exists;
  
  if v_exists then
    return;
  end if;

  insert into categories (org_id, user_id, kind, name, is_default, icon, color) values
  (p_org_id, p_user_id, 'INCOME', 'Salario', true, 'Wallet', '#0d9488'),
  (p_org_id, p_user_id, 'INCOME', 'Otros ingresos', true, 'DollarSign', '#0891b2'),
  (p_org_id, p_user_id, 'EXPENSE', 'Comida', true, 'UtensilsCrossed', '#e11d48'),
  (p_org_id, p_user_id, 'EXPENSE', 'Transporte', true, 'Car', '#2563eb'),
  (p_org_id, p_user_id, 'EXPENSE', 'Diversión', true, 'Gamepad2', '#7c3aed'),
  (p_org_id, p_user_id, 'EXPENSE', 'Renta', true, 'Home', '#16a34a'),
  (p_org_id, p_user_id, 'EXPENSE', 'Gasolina', true, 'Zap', '#ea580c'),
  (p_org_id, p_user_id, 'EXPENSE', 'Salud', true, 'HeartPulse', '#dc2626'),
  (p_org_id, p_user_id, 'EXPENSE', 'Entretenimiento', true, 'Gamepad2', '#7c3aed'),
  (p_org_id, p_user_id, 'EXPENSE', 'Streaming', true, 'Music', '#0891b2'),
  (p_org_id, p_user_id, 'EXPENSE', 'Viajes', true, 'Plane', '#0d9488'),
  (p_org_id, p_user_id, 'EXPENSE', 'Café', true, 'Coffee', '#ca8a04'),
  (p_org_id, p_user_id, 'EXPENSE', 'Libros', true, 'BookOpen', '#65a30d'),
  (p_org_id, p_user_id, 'EXPENSE', 'Regalos', true, 'Gift', '#be185d');
end;
$$ language plpgsql security definer;
