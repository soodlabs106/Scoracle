export function isChatEnabled(value = import.meta.env.VITE_CHAT_ENABLED) {
  return value !== 'false'
}

