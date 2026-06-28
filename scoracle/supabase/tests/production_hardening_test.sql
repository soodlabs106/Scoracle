begin;
select plan(7);

select has_function('public', 'is_active_user', array[]::text[], 'active-user helper exists');
select has_function('public', 'get_rank_timeline', array[]::text[], 'rank timeline RPC exists');
select has_function('public', 'get_my_prediction_history', array[]::text[], 'prediction history RPC exists');
select has_trigger('public', 'fixtures', 'score_predictions_on_fixture_result', 'fixture scoring trigger exists');
select policies_are(
  'public',
  'predictions',
  array[
    'Active users can delete their own unlocked predictions',
    'Active users can insert their own unlocked predictions',
    'Active users can read their own predictions',
    'Active users can update their own unlocked predictions',
    'Admins can read all predictions'
  ],
  'prediction RLS contains only active-user and admin policies'
);
select function_privs_are(
  'public',
  'score_all_completed_predictions',
  array[]::text[],
  'postgres',
  array['EXECUTE'],
  'global scoring is not exposed to application roles'
);
select function_privs_are(
  'public',
  'prune_operational_data',
  array['integer'],
  'authenticated',
  array[]::text[],
  'operational pruning is not exposed to users'
);

select * from finish();
rollback;
