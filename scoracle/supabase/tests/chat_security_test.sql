begin;
select plan(10);

select has_table('public', 'chat_rooms', 'chat rooms table exists');
select has_table('public', 'chat_messages', 'chat messages table exists');
select has_function(
  'public',
  'get_chat_display_names',
  array['uuid[]'],
  'display-name-only chat lookup exists'
);
select has_function(
  'public',
  'prune_chat_messages',
  array[]::text[],
  '30-day chat cleanup function exists'
);
select policies_are(
  'public',
  'chat_rooms',
  array['Active users can read chat rooms'],
  'chat room RLS is read-only for active users'
);
select policies_are(
  'public',
  'chat_messages',
  array[
    'Active users can read retained chat messages',
    'Active users can send their own chat messages',
    'Admins can delete chat messages'
  ],
  'chat message RLS enforces active-user reads/inserts and admin deletion'
);
select function_privs_are(
  'public',
  'get_chat_display_names',
  array['uuid[]'],
  'anon',
  array[]::text[],
  'anonymous users cannot resolve chat display names'
);
select function_privs_are(
  'public',
  'get_chat_display_names',
  array['uuid[]'],
  'authenticated',
  array['EXECUTE'],
  'authenticated users can resolve chat display names'
);
select function_privs_are(
  'public',
  'prune_chat_messages',
  array[]::text[],
  'authenticated',
  array[]::text[],
  'normal users cannot invoke retention cleanup'
);
select results_eq(
  $$select count(*)::bigint from public.chat_rooms where room_type = 'general'$$,
  array[1::bigint],
  'exactly one General Chat room is seeded'
);

select * from finish();
rollback;
