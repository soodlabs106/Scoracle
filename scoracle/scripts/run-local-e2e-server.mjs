import { execSync, spawn } from 'node:child_process'

execSync('npm run test:e2e:build', {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: true,
  windowsHide: true,
})

const previewProcess = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4173'],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
    windowsHide: true,
  },
)

const stopPreview = () => {
  if (!previewProcess.killed) {
    previewProcess.kill('SIGTERM')
  }
}

process.on('SIGINT', stopPreview)
process.on('SIGTERM', stopPreview)
process.on('exit', stopPreview)

previewProcess.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0)
})
