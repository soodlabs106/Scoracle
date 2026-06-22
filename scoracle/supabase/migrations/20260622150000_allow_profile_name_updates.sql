create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
    or current_setting('app.allow_profile_admin_update', true) = 'true' then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.is_disabled is distinct from old.is_disabled
    or new.created_at is distinct from old.created_at then
    raise exception 'Only username, first name, last name, favorite club, and avatar can be updated';
  end if;

  return new;
end;
$$;
