import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router'
import App from '../App'

const ProfilePage = lazy(() =>
  import('../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })),
)
const LeaderboardPage = lazy(() =>
  import('../pages/LeaderboardPage').then((module) => ({ default: module.LeaderboardPage })),
)
const AdminPage = lazy(() =>
  import('../pages/AdminPage').then((module) => ({ default: module.AdminPage })),
)
const AuthCallbackPage = lazy(() =>
  import('../pages/AuthCallbackPage').then((module) => ({ default: module.AuthCallbackPage })),
)
const ResetPasswordPage = lazy(() =>
  import('../pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })),
)

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/admin-soodlabs" element={<AdminPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>
    </Suspense>
  )
}

function RouteLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F5FF] text-sm font-bold text-[#555B7A]">
      Loading Scoracle...
    </main>
  )
}
