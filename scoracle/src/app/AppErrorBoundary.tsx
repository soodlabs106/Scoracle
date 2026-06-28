import { Component, type ErrorInfo, type ReactNode } from 'react'

type State = { error: Error | null }

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'client_render_failure',
        message: error.message,
        componentStack: info.componentStack,
      }),
    )
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F5FF] p-4 text-[#12163F]">
        <section className="w-full max-w-md rounded-lg border border-[#DCD5FF] bg-white p-6 text-center shadow-[0_12px_32px_rgba(18,22,63,0.08)]">
          <img src="/scoracle-logo.png" alt="" className="mx-auto h-16 w-16 object-contain" />
          <h1 className="mt-4 font-heading text-xl font-black">Scoracle needs a refresh</h1>
          <p className="mt-2 text-sm font-medium text-[#555B7A]">
            An unexpected screen error occurred. Your saved data has not been changed.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-[#5B3FFF] px-4 py-2 text-sm font-bold text-white"
          >
            Refresh Scoracle
          </button>
        </section>
      </main>
    )
  }
}
