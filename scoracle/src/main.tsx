import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AuthProvider } from './context/AuthContext.tsx'
import './index.css'
import App from './App.tsx'
import { AdminPage } from './pages/AdminPage.tsx'
import { ProfilePage } from './pages/ProfilePage.tsx'
import { ResetPasswordPage } from './pages/ResetPasswordPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin-soodlabs" element={<AdminPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
