with auth_avatar_sources as (
  select
    users.id,
    coalesce(
      nullif(btrim(users.raw_user_meta_data->>'avatar_url'), ''),
      nullif(btrim(users.raw_user_meta_data->>'picture'), ''),
      nullif(btrim(users.raw_user_meta_data->>'avatar'), ''),
      nullif(btrim(users.raw_user_meta_data->>'profile_picture'), ''),
      nullif(btrim(users.raw_user_meta_data->>'image_url'), ''),
      nullif(btrim(identities.identity_data->>'avatar_url'), ''),
      nullif(btrim(identities.identity_data->>'picture'), ''),
      nullif(btrim(identities.identity_data->>'avatar'), ''),
      nullif(btrim(identities.identity_data->>'profile_picture'), ''),
      nullif(btrim(identities.identity_data->>'image_url'), '')
    ) as avatar_url
  from auth.users
  left join lateral (
    select identity_data
    from auth.identities
    where auth.identities.user_id = users.id
    order by auth.identities.updated_at desc nulls last,
      auth.identities.created_at desc nulls last
    limit 1
  ) identities on true
)
update public.profiles profiles
set
  avatar_url = auth_avatar_sources.avatar_url,
  avatar_path = null
from auth_avatar_sources
where profiles.id = auth_avatar_sources.id
  and auth_avatar_sources.avatar_url is not null
  and (profiles.avatar_url is null or btrim(profiles.avatar_url) = '');
