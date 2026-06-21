export type PasswordValidation = {
  isLongEnough: boolean
  hasNumber: boolean
  hasSpecialCharacter: boolean
  isValid: boolean
}

export function validatePassword(password: string): PasswordValidation {
  const isLongEnough = password.length >= 8
  const hasNumber = /\d/.test(password)
  const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password)

  return {
    isLongEnough,
    hasNumber,
    hasSpecialCharacter,
    isValid: isLongEnough && hasNumber && hasSpecialCharacter,
  }
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
