import { describe, expect, it } from 'vitest'
import { validatePassword } from './passwordValidation'

describe('password validation', () => {
  it('requires length, letters, numbers, and a special character', () => {
    expect(validatePassword('short')).not.toMatchObject({ isValid: true })
    expect(validatePassword('lettersOnly!')).not.toMatchObject({ isValid: true })
    expect(validatePassword('Letters123')).not.toMatchObject({ isValid: true })
    expect(validatePassword('Letters1!')).toMatchObject({ isValid: true })
  })
})
