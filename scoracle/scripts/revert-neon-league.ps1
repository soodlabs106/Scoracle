param(
  [string]$RestoreRef = "restore/pre-neon-league"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

$files = @(
  "scoracle/src/index.css",
  "scoracle/src/App.tsx",
  "scoracle/src/components/layout/Header.tsx",
  "scoracle/src/components/ui/FilterDropdown.tsx",
  "scoracle/src/components/auth/AuthModalFrame.tsx",
  "scoracle/src/components/auth/LoginModal.tsx",
  "scoracle/src/components/auth/SignupModal.tsx",
  "scoracle/src/components/auth/ForgotPasswordModal.tsx",
  "scoracle/src/components/auth/GoogleAuthButton.tsx",
  "scoracle/src/pages/ProfilePage.tsx",
  "scoracle/src/pages/LeaderboardPage.tsx",
  "scoracle/src/pages/ResetPasswordPage.tsx"
)

git rev-parse --verify $RestoreRef | Out-Null
git restore --source $RestoreRef -- $files

Write-Host "Reverted Scoracle Neon League theme files from $RestoreRef."
Write-Host "Review with: git diff --stat"
