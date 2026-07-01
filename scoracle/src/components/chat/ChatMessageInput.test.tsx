import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChatMessageInput } from './ChatMessageInput'

afterEach(cleanup)

describe('ChatMessageInput', () => {
  it('blocks blank messages and sends a trimmed draft with Enter', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<ChatMessageInput isSending={false} onSend={onSend} />)

    const input = screen.getByLabelText('Message General Chat')
    await user.type(input, '   ')
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()

    await user.clear(input)
    await user.type(input, 'Hello chat{Enter}')
    expect(onSend).toHaveBeenCalledWith('Hello chat')
    expect(input).toHaveValue('')
  })

  it('uses Shift+Enter for a newline without sending', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<ChatMessageInput isSending={false} onSend={onSend} />)

    const input = screen.getByLabelText('Message General Chat')
    await user.type(input, 'First line{Shift>}{Enter}{/Shift}Second line')
    expect(input).toHaveValue('First line\nSecond line')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('opens the emoji keyboard and inserts emoji at the cursor', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<ChatMessageInput isSending={false} onSend={onSend} />)

    const input = screen.getByLabelText('Message General Chat')
    await user.type(input, 'Goal ')
    await user.click(screen.getByRole('button', { name: 'Open emoji keyboard' }))
    await user.click(screen.getByRole('button', { name: 'Insert ⚽' }))
    expect(input).toHaveValue('Goal ⚽')
  })

  it('does not send a draft longer than 500 characters', () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<ChatMessageInput isSending={false} onSend={onSend} />)
    const input = screen.getByLabelText('Message General Chat')

    fireEvent.change(input, { target: { value: 'a'.repeat(501) } })
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    expect(onSend).not.toHaveBeenCalled()
  })
})
