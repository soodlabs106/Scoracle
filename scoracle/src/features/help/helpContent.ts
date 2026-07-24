export type HelpSection = {
  id: string
  title: string
  summary: string
  items: string[]
  keywords: string[]
}

export const helpSections: HelpSection[] = [
  {
    id: 'getting-started',
    title: 'Getting started',
    summary: 'Use Scoracle in fixture mode without an account, or sign in to make predictions.',
    items: [
      'Fixture mode shows the Premier League table, upcoming fixtures, and leading players.',
      'Select a club name or crest to view recent results, the current top scorer, and the squad.',
      'Create an account with email and password, or continue with Google.',
      'After signing in, use the profile button to manage your name, avatar, and favorite club.',
    ],
    keywords: ['start', 'login', 'signup', 'google', 'fixtures', 'profile'],
  },
  {
    id: 'filters',
    title: 'Finding fixtures',
    summary: 'Narrow the fixture list without changing any saved predictions.',
    items: [
      'Use Club to show fixtures involving one team.',
      'Use Match week to select a round of fixtures.',
      'Use Month to show fixtures scheduled in that month.',
      'Filters can be combined and reset to All at any time.',
    ],
    keywords: ['filter', 'club', 'match week', 'month', 'all'],
  },
  {
    id: 'predictions',
    title: 'Adding and updating predictions',
    summary: 'Predictions are saved only when you explicitly select Save Predictions.',
    items: [
      'Sign in and choose an unlocked match week in Prediction mode.',
      'Enter both home and away scores for every prediction you want to save. Scores must be from 0 to 99.',
      'Select Save Predictions. A confirmation message appears when the database accepts the changes.',
      'To update a prediction, change either score and save again before the match week locks.',
      'Saved predictions have an orange outline until the match has been scored.',
    ],
    keywords: ['prediction', 'score', 'save', 'update', 'edit', 'orange'],
  },
  {
    id: 'deleting-locks',
    title: 'Deleting predictions and lock time',
    summary: 'Each fixture locks when kickoff starts.',
    items: [
      'Use the trash icon beside Your prediction or in profile history to delete an unlocked prediction.',
      'Deletion is permanent and requires confirmation from the profile page.',
      'When the lock icon appears, predictions can no longer be created, changed, or deleted.',
      'Locking is enforced by the database as well as the screen, so refreshing cannot bypass it.',
    ],
    keywords: ['delete', 'trash', 'lock', 'kickoff', 'start'],
  },
  {
    id: 'scoring',
    title: 'Scoring and call quality',
    summary: 'Points are calculated after an actual result is available.',
    items: [
      'Exact score: 5 points.',
      'Great call - correct result and goal difference, but not the exact score: 3 points.',
      'Close - correct result, but not the score or goal difference: 2 points.',
      'Near miss or Miss: 0 points.',
      'TBP or Not scored means the match result is pending and currently awards 0 points.',
    ],
    keywords: ['points', 'exact', 'great', 'close', 'near miss', 'miss', 'tbp'],
  },
  {
    id: 'history-leaderboard',
    title: 'History and leaderboard',
    summary: 'Review your calls in Profile and compare ranked results on the Leaderboard.',
    items: [
      'Profile history groups predictions by match week and shows prediction, actual result, call quality, and points.',
      'Overall leaderboard ranks total scored points. Match week shows the selected week only.',
      'Rank movement compares cumulative rank with the previous scored match week.',
      'Use Replay tour in your expanded profile details to see the guided introduction again.',
    ],
    keywords: ['history', 'leaderboard', 'rank', 'movement', 'profile', 'tour'],
  },
]
