import { describe, expect, it } from 'vitest'
import { isChatEnabled } from './chatConfig'

describe('chat feature flag', () => {
  it('is enabled by default', () => {
    expect(isChatEnabled(undefined)).toBe(true)
  })

  it('supports an immediate UI and subscription rollback', () => {
    expect(isChatEnabled('false')).toBe(false)
  })
})
