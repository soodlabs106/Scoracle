import { describe, expect, it } from 'vitest'
import rollback from '../../../supabase/rollbacks/20260701230000_authenticated_general_chat_rollback.sql?raw'

describe('chat rollback script', () => {
  it('removes realtime before dropping chat objects in dependency order', () => {
    const realtimeRemoval = rollback.indexOf(
      'alter publication supabase_realtime drop table public.chat_messages',
    )
    const messageDrop = rollback.indexOf('drop table if exists public.chat_messages')
    const roomDrop = rollback.indexOf('drop table if exists public.chat_rooms')

    expect(rollback).toContain('DESTRUCTIVE EMERGENCY ROLLBACK')
    expect(realtimeRemoval).toBeGreaterThan(-1)
    expect(messageDrop).toBeGreaterThan(realtimeRemoval)
    expect(roomDrop).toBeGreaterThan(messageDrop)
  })
})
