# Authenticated General Chat

## Implementation

- Pre-change Git commit: `6790605ab861ea8bf3f41472ff13228bf0e2080e`.
- Apply `supabase/migrations/20260701230000_authenticated_general_chat.sql` before deploying the frontend.
- The migration creates and secures General Chat, adds it to Supabase Realtime, and installs the service-role-only 30-day cleanup RPC.
- The existing daily GitHub maintenance workflow calls the cleanup RPC and writes its result to `system_job_runs`.
- No manual room creation is required. The migration seeds General Chat.

## Feature-flag rollback

Set `VITE_CHAT_ENABLED=false` in Netlify and redeploy. This restores the right-column stats for authenticated users and prevents the chat component, queries, and Realtime channel from mounting. The database can remain installed, allowing a quick re-enable by removing the variable or setting it to `true`.

## Destructive database rollback

Only remove the database objects if the feature-flag rollback is insufficient:

1. Set `VITE_CHAT_ENABLED=false` and redeploy.
2. Verify authenticated users see the stats column and that no `chat-room:*` Realtime channel is opened.
3. Back up chat data if it must be retained.
4. Run `supabase/rollbacks/20260701230000_authenticated_general_chat_rollback.sql` in the Supabase SQL editor.
5. Verify login, predictions, fixtures, leaderboard, admin, and the daily maintenance workflow.

The rollback SQL permanently deletes all chat messages and rooms. It does not touch profiles, fixtures, predictions, or other application data. The maintenance workflow treats the missing cleanup RPC as a safe skip.

To restore chat after destructive rollback, create and apply a new forward migration; do not edit an already-applied migration.

<!-- TODO: add admin moderation/reporting UI if community usage requires it. -->
