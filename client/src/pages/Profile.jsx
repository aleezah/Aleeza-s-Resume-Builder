import { useEffect, useState } from 'react'
import { useProfile } from '../App'
import * as api from '../api'

function Field({ label, name, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label>{label}</label>
      <input type={type} name={name} value={value || ''} onChange={onChange} placeholder={placeholder} className="w-full" />
    </div>
  )
}

export default function ProfilePage() {
  const { currentId } = useProfile()
  const [basics, setBasics] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Integration states
  const [ghToken, setGhToken] = useState('')
  const [glToken, setGlToken] = useState('')
  const [glUrl, setGlUrl] = useState('https://gitlab.com')
  const [integrating, setIntegrating] = useState(null)
  const [integMsg, setIntegMsg] = useState(null)

  useEffect(() => {
    if (!currentId) return
    api.getProfileData(currentId).then(d => setBasics(d.basics || {}))
  }, [currentId])

  function handleChange(e) {
    setBasics(b => ({ ...b, [e.target.name]: e.target.value }))
  }

  async function handleSave() {
    setSaving(true)
    await api.updateBasics(currentId, basics)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function connectGitHub() {
    if (!ghToken.trim()) return
    setIntegrating('github'); setIntegMsg(null)
    try {
      const r = await api.connectGitHub({ profile_id: currentId, token: ghToken })
      setIntegMsg({ type: 'success', text: `GitHub connected! ${r.repos_imported} projects imported, ${r.skills_added} languages added as skills.` })
      setGhToken('')
    } catch (e) {
      setIntegMsg({ type: 'error', text: e.response?.data?.error || e.message })
    }
    setIntegrating(null)
  }

  async function connectGitLab() {
    if (!glToken.trim()) return
    setIntegrating('gitlab'); setIntegMsg(null)
    try {
      const r = await api.connectGitLab({ profile_id: currentId, token: glToken, base_url: glUrl })
      setIntegMsg({ type: 'success', text: `GitLab connected! ${r.projects_imported} projects imported.` })
      setGlToken('')
    } catch (e) {
      setIntegMsg({ type: 'error', text: e.response?.data?.error || e.message })
    }
    setIntegrating(null)
  }

  async function handleLinkedIn(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setIntegrating('linkedin'); setIntegMsg(null)
    try {
      const fd = new FormData()
      fd.append('profile_id', currentId)
      fd.append('file', file)
      const r = await api.importLinkedIn(fd)
      const { imported } = r
      const skipped = r.imported.skipped || 0
      setIntegMsg({ type: 'success', text: `LinkedIn imported: ${imported.experiences} experiences, ${imported.education} education, ${imported.skills} skills, ${imported.certifications} certifications.${skipped ? ` (${skipped} duplicates skipped)` : ''}` })
    } catch (e) {
      setIntegMsg({ type: 'error', text: e.response?.data?.error || e.message })
    }
    setIntegrating(null)
    e.target.value = ''
  }

  return (
    <div className="page">
      <h1 className="page-title">Profile</h1>
      <p className="page-subtitle">Your personal information used across all generated documents.</p>

      {/* Basic info */}
      <div className="card mb-6">
        <p className="section-heading">Basic Information</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Full Name" name="full_name" value={basics.full_name} onChange={handleChange} placeholder="Jane Smith" />
          <Field label="Email" name="email" type="email" value={basics.email} onChange={handleChange} placeholder="jane@example.com" />
          <Field label="Phone" name="phone" value={basics.phone} onChange={handleChange} placeholder="+1 555-000-0000" />
          <Field label="Location" name="location" value={basics.location} onChange={handleChange} placeholder="City, Province/State" />
          <Field label="LinkedIn URL" name="linkedin_url" value={basics.linkedin_url} onChange={handleChange} placeholder="https://linkedin.com/in/..." />
          <Field label="GitHub URL" name="github_url" value={basics.github_url} onChange={handleChange} placeholder="https://github.com/..." />
          <Field label="GitLab URL" name="gitlab_url" value={basics.gitlab_url} onChange={handleChange} placeholder="https://gitlab.com/..." />
          <Field label="Personal Website" name="website" value={basics.website} onChange={handleChange} placeholder="https://..." />
        </div>
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="mb-0">Professional Summary</label>
            <button onClick={handleSave} disabled={saving} className="btn-sm btn-secondary">
              {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
          <textarea name="summary" value={basics.summary || ''} onChange={handleChange} rows={4}
            placeholder="Write a brief professional summary…"
            className="w-full resize-none" />
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>

      {/* Integrations */}
      <div className="card">
        <p className="section-heading">Integrations</p>

        {integMsg && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${integMsg.type === 'success' ? 'bg-green-900/40 text-green-300 border border-green-800' : 'bg-red-900/40 text-red-300 border border-red-800'}`}>
            {integMsg.text}
          </div>
        )}

        <div className="space-y-6">
          {/* GitHub */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">GitHub</label>
            <p className="text-xs text-gray-500 mb-2">Connect with a Personal Access Token (Settings → Developer settings → Personal access tokens → Fine-grained → repo read access).</p>
            <div className="flex gap-2">
              <input type="password" value={ghToken} onChange={e => setGhToken(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxx" className="flex-1" />
              <button onClick={connectGitHub} disabled={integrating === 'github'} className="btn-secondary whitespace-nowrap">
                {integrating === 'github' ? 'Connecting…' : 'Connect GitHub'}
              </button>
            </div>
          </div>

          {/* GitLab */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">GitLab</label>
            <p className="text-xs text-gray-500 mb-2">Use a Personal Access Token with <code className="bg-gray-800 px-1 rounded">read_api</code> scope.</p>
            <div className="grid grid-cols-3 gap-2">
              <input value={glUrl} onChange={e => setGlUrl(e.target.value)} placeholder="https://gitlab.com" className="col-span-1" />
              <input type="password" value={glToken} onChange={e => setGlToken(e.target.value)} placeholder="glpat-xxxx" className="col-span-1" />
              <button onClick={connectGitLab} disabled={integrating === 'gitlab'} className="btn-secondary">
                {integrating === 'gitlab' ? 'Connecting…' : 'Connect GitLab'}
              </button>
            </div>
          </div>

          {/* LinkedIn */}
          <div>
            <label className="text-sm font-medium text-white mb-2 block">LinkedIn Data Export</label>
            <p className="text-xs text-gray-500 mb-2">
              On LinkedIn: <strong>Me → Settings → Data Privacy → Get a copy of your data</strong> → select "The works" → request archive → download the ZIP → upload it here.
            </p>
            <div className="flex items-center gap-2">
              <label className="btn-secondary cursor-pointer">
                {integrating === 'linkedin' ? 'Importing…' : 'Upload LinkedIn ZIP'}
                <input type="file" accept=".zip" onChange={handleLinkedIn} className="hidden" disabled={integrating === 'linkedin'} />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
