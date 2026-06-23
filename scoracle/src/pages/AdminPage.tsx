import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/useAuth'
import type { AdminProfileRow } from '../types/auth'

export function AdminPage() {
  const { user, isAdmin, isLoading } = useAuth()
  const [users, setUsers] = useState<AdminProfileRow[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setIsFetching(true)
    setMessage(null)

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, role, is_disabled, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setMessage(error.message)
    } else {
      setUsers((data ?? []) as AdminProfileRow[])
    }

    setIsFetching(false)
  }, [])

  useEffect(() => {
    if (!isAdmin) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void fetchUsers()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [fetchUsers, isAdmin])

  async function toggleDisabled(target: AdminProfileRow) {
    if (target.id === user?.id) {
      setMessage('Admins cannot disable themselves.')
      return
    }

    setUpdatingUserId(target.id)
    setMessage(null)

    const { data, error } = await supabase.rpc('admin_set_user_disabled', {
      target_user_id: target.id,
      disabled: !target.is_disabled,
    })

    if (error) {
      setMessage(error.message)
    } else {
      const updated = Array.isArray(data) ? data[0] : null
      setUsers((current) =>
        current.map((row) =>
          updated && row.id === updated.id
            ? ({ ...row, ...updated } as AdminProfileRow)
            : row,
        ),
      )
    }

    setUpdatingUserId(null)
  }

  if (isLoading) {
    return <AdminShell message="Checking admin access..." />
  }

  if (!user) {
    return (
      <AdminShell message="Log in to access Scoracle admin tools.">
        <Link
          to="/"
          className="mt-4 inline-flex rounded-lg bg-[#F45B5B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3CC8A5]"
        >
          Return home
        </Link>
      </AdminShell>
    )
  }

  if (!isAdmin) {
    return <AdminShell message="Access denied." />
  }

  return (
    <main className="min-h-screen bg-[#F9F9F9] px-4 py-6 text-[#333333] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl rounded-lg border border-[#DADADA] bg-white p-5 shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <img
              src="/scoracle-lettering.png"
              alt="Scoracle"
              className="h-6 w-auto object-contain"
            />
            <h1 className="text-3xl font-bold">Admin</h1>
            <p className="mt-1 text-sm text-[#5f6664]">
              Disable or enable accounts. Emails and passwords are not shown.
            </p>
          </div>
          <Link
            to="/"
            className="rounded-lg border border-[#3CC8A5] px-4 py-2 text-center text-sm font-semibold text-[#3CC8A5] transition hover:bg-[#3CC8A5]/10"
          >
            Home
          </Link>
        </div>

        {message ? (
          <div className="mt-4 rounded-lg border border-[#F45B5B] bg-[#F45B5B]/10 px-3 py-2 text-sm font-semibold text-[#8a2626]">
            {message}
          </div>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-lg border border-[#DADADA]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#E8F4FA] text-[#333333]">
              <tr>
                <th className="px-3 py-3 font-semibold">Username</th>
                <th className="px-3 py-3 font-semibold">Role</th>
                <th className="px-3 py-3 font-semibold">Status</th>
                <th className="px-3 py-3 font-semibold">Created</th>
                <th className="px-3 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DADADA]">
              {users.map((profile) => (
                <tr key={profile.id}>
                  <td className="px-3 py-3 font-semibold">
                    {profile.username}
                  </td>
                  <td className="px-3 py-3">{profile.role}</td>
                  <td className="px-3 py-3">
                    {profile.is_disabled ? 'Disabled' : 'Active'}
                  </td>
                  <td className="px-3 py-3">
                    {new Date(profile.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleDisabled(profile)}
                      disabled={
                        profile.id === user.id || updatingUserId === profile.id
                      }
                      className="rounded-lg border border-[#DADADA] px-3 py-2 text-sm font-semibold transition hover:bg-[#E8F4FA] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {profile.is_disabled ? 'Enable user' : 'Disable user'}
                    </button>
                  </td>
                </tr>
              ))}
              {!isFetching && users.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-[#5f6664]" colSpan={5}>
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

function AdminShell({
  message,
  children,
}: {
  message: string
  children?: ReactNode
}) {
  return (
    <main className="min-h-screen bg-[#F9F9F9] px-4 py-10 text-[#333333]">
      <section className="mx-auto max-w-md rounded-lg border border-[#DADADA] bg-white p-6 text-center shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
        <img
          src="/scoracle-logo.png"
          alt=""
          className="mx-auto h-16 w-16 rounded-lg object-contain"
        />
        <h1 className="mt-4 flex flex-col items-center gap-2 text-2xl font-bold">
          <img
            src="/scoracle-lettering.png"
            alt="Scoracle"
            className="h-7 w-auto object-contain"
          />
          <span>Admin</span>
        </h1>
        <p className="mt-2 text-sm text-[#5f6664]">{message}</p>
        {children}
      </section>
    </main>
  )
}
