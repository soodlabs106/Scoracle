import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HelpProvider } from './HelpProvider'
import { useHelp } from './useHelp'

function OpenHelpButton() {
  const { openHelp } = useHelp()
  return <button onClick={openHelp}>Help</button>
}

describe('HelpProvider', () => {
  it('opens, searches, and closes without navigating', async () => {
    const user = userEvent.setup()
    render(
      <HelpProvider>
        <OpenHelpButton />
      </HelpProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Help' }))
    expect(screen.getByRole('dialog', { name: 'Scoracle Help' })).toBeVisible()
    expect(screen.getByText('Exact score: 5 points.')).toBeVisible()

    await user.type(screen.getByRole('searchbox', { name: 'Search help' }), 'delete')
    expect(screen.getByText('Deleting predictions and lock time')).toBeVisible()
    expect(screen.getByText('Each fixture locks 1 hour before kickoff.')).toBeVisible()
    expect(screen.queryByText('Finding fixtures')).not.toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
