import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import * as api from './api'

import { Navigate } from 'react-router-dom'
import Dashboard       from './pages/Dashboard'
import ProfilePage     from './pages/Profile'
import DocumentsPage   from './pages/Documents'
import ExperiencesPage from './pages/Experiences'
import JobsPage        from './pages/Jobs'
import GeneratePage    from './pages/Generate'
import SettingsPage    from './pages/Settings'

// ── Profile context ───────────────────────────────────────────────────────────

const ProfileCtx = createContext(null)
export function useProfile() { return useContext(ProfileCtx) }

// ── Sidebar nav ───────────────────────────────────────────────────────────────

const NAV = [
  { to: '/',           label: 'Dashboard',   icon: '⊞' },
  { to: '/profile',    label: 'Profile',     icon: '◎' },
  { to: '/documents',  label: 'Documents',   icon: '◧' },
  { to: '/experiences',label: 'My Profile',  icon: '◈' },
  { to: '/jobs',       label: 'Jobs',        icon: '◆' },
  { to: '/generate',   label: 'Generate',    icon: '⚡' },
  { to: '/settings',   label: 'Settings',    icon: '⚙' },
]

function ProfileSwitcher({ profiles, currentId, onSwitch, onRefresh }) {
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState(null)
  const [renameVal, setRenameVal] = useState('')

  async function handleCreate() {
    const n = newName.trim()
    if (!n) return
    await api.createProfile(n)
    setNewName(''); setCreating(false)
    onRefresh()
  }

  async function handleDelete(p) {
    if (!confirm(`Delete "${p.name}"? All data for this profile will be removed.`)) return
    await api.deleteProfile(p.id)
    if (p.id === currentId) {
      const remaining = profiles.filter(x => x.id !== p.id)
      if (remaining.length) await api.setCurrentProfile(remaining[0].id).then(() => onSwitch(remaining[0].id))
    }
    onRefresh()
  }

  async function commitRename() {
    if (renamingId && renameVal.trim()) {
      await api.renameProfile(renamingId, renameVal.trim())
      onRefresh()
    }
    setRenamingId(null)
  }

  return (
    <div className="px-3 mb-2">
      <p className="section-heading">Profile</p>
      <div className="space-y-0.5">
        {profiles.map(p => (
          <div key={p.id} className="flex items-center gap-1 group">
            {renamingId === p.id ? (
              <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
                onBlur={commitRename}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenamingId(null) }}
                className="flex-1 text-xs px-2 py-1.5" />
            ) : (
              <button onClick={() => { api.setCurrentProfile(p.id); onSwitch(p.id) }}
                onDoubleClick={() => { setRenamingId(p.id); setRenameVal(p.name) }}
                title="Double-click to rename"
                className={`flex-1 text-left px-2 py-1.5 rounded-md text-sm truncate transition-colors ${
                  p.id === currentId ? 'bg-brand-600 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}>
                {p.name}
              </button>
            )}
            {renamingId !== p.id && (
              <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                <button onClick={() => { setRenamingId(p.id); setRenameVal(p.name) }} className="text-gray-600 hover:text-gray-300 text-xs px-1">✎</button>
                {profiles.length > 1 && (
                  <button onClick={() => handleDelete(p)} className="text-gray-600 hover:text-red-400 text-xs px-1">✕</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {creating ? (
        <div className="mt-2 flex gap-1">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
            placeholder="Name…" className="flex-1 text-xs px-2 py-1" />
          <button onClick={handleCreate} className="text-xs text-brand-400 hover:text-brand-300 px-1">Add</button>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="mt-2 text-xs text-gray-600 hover:text-gray-400 transition-colors">
          + Add profile
        </button>
      )}
    </div>
  )
}

// ── Root App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [profiles, setProfiles] = useState([])
  const [currentId, setCurrentId] = useState(null)

  const refreshProfiles = useCallback(async () => {
    const [list, cur] = await Promise.all([api.listProfiles(), api.getCurrentProfile()])
    setProfiles(list)
    setCurrentId(cur.id)
  }, [])

  useEffect(() => { refreshProfiles() }, [refreshProfiles])

  const ctx = { profiles, currentId, refreshProfiles }

  return (
    <ProfileCtx.Provider value={ctx}>
      <BrowserRouter>
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <nav className="w-52 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col py-5 gap-1 overflow-y-auto">
            <div className="px-4 mb-4">
              <h1 className="text-brand-400 font-bold text-sm tracking-widest uppercase">Job Application Tool</h1>
            </div>

            <ProfileSwitcher profiles={profiles} currentId={currentId}
              onSwitch={setCurrentId} onRefresh={refreshProfiles} />

            <div className="border-t border-gray-800 pt-3 px-2 space-y-0.5">
              {NAV.map(({ to, label, icon }) => (
                <NavLink key={to} to={to} end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}>
                  <span className="text-base leading-none">{icon}</span>
                  {label}
                </NavLink>
              ))}
            </div>
          </nav>

          {/* Content */}
          <main className="flex-1 overflow-y-auto">
            {currentId ? (
              <Routes>
                <Route path="/"            element={<Dashboard />} />
                <Route path="/profile"     element={<ProfilePage />} />
                <Route path="/summary"     element={<Navigate to="/experiences" replace />} />
                <Route path="/documents"   element={<DocumentsPage />} />
                <Route path="/experiences" element={<ExperiencesPage />} />
                <Route path="/jobs/*"      element={<JobsPage />} />
                <Route path="/generate/*"  element={<GeneratePage />} />
                <Route path="/settings"    element={<SettingsPage />} />
              </Routes>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600">Loading…</div>
            )}
          </main>
        </div>
      </BrowserRouter>
    </ProfileCtx.Provider>
  )
}
