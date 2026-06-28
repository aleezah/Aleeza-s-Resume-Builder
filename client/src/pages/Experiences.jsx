import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProfile } from '../App'
import * as api from '../api'

// ── Duplicate Scanner Modal ───────────────────────────────────────────────────

function DuplicateScanModal({ pairs: initialPairs, onDone }) {
  const [pairs, setPairs]       = useState(initialPairs)
  const [index, setIndex]       = useState(0)
  const [mergedText, setMergedText] = useState('')
  const [mode, setMode]         = useState(null) // 'keepA' | 'keepB' | 'merge' | 'skip'
  const [applying, setApplying] = useState(false)

  const pair = pairs[index]

  // Pre-fill merge text when entering merge mode
  function selectMode(m) {
    setMode(m)
    if (m === 'merge') {
      setMergedText([pair.a.achievements, pair.b.achievements].filter(Boolean).join('\n'))
    }
  }

  async function applyAndNext() {
    setApplying(true)
    try {
      if (mode === 'keepA') {
        await api.deleteExperience(pair.b.id)
      } else if (mode === 'keepB') {
        await api.deleteExperience(pair.a.id)
      } else if (mode === 'merge') {
        await api.confirmMerge({ keep_id: pair.a.id, discard_id: pair.b.id, merged_achievements: mergedText, merged_description: pair.a.description || pair.b.description })
      }
      // 'skip' — do nothing
    } catch (e) {
      alert(e.message)
    }
    setApplying(false)

    if (index + 1 < pairs.length) {
      setIndex(i => i + 1)
      setMode(null)
      setMergedText('')
    } else {
      onDone()
    }
  }

  if (!pair) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-xl border border-yellow-700 w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="font-bold text-white text-lg">Duplicate Experiences Found</h2>
            <p className="text-xs text-gray-500 mt-0.5">{index + 1} of {pairs.length} pairs</p>
          </div>
          <span className="badge bg-yellow-900 text-yellow-300">{pair.score}% similar</span>
        </div>

        <div className="overflow-y-auto flex-1 p-5">
          <div className="grid grid-cols-2 gap-4 mb-5">
            {[['A', pair.a], ['B', pair.b]].map(([label, exp]) => (
              <div key={label} className="bg-gray-800 rounded-lg p-4">
                <p className="text-xs text-brand-400 font-semibold mb-2 uppercase tracking-wide">Option {label} · <span className="text-gray-500">{exp.source}</span></p>
                <div className="font-semibold text-white text-sm">{exp.title}</div>
                <div className="text-brand-400 text-xs">{exp.company}</div>
                <div className="text-gray-500 text-xs mb-2">{exp.start_date || '?'} – {exp.is_current ? 'Present' : exp.end_date || '?'}{exp.location && ` · ${exp.location}`}</div>
                {exp.achievements && <pre className="text-gray-400 text-xs whitespace-pre-wrap font-sans">{exp.achievements}</pre>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { key: 'keepA',  label: 'Keep A, delete B',          desc: `Keep the ${pair.a.source} version` },
              { key: 'keepB',  label: 'Keep B, delete A',          desc: `Keep the ${pair.b.source} version` },
              { key: 'merge',  label: 'Merge (combine bullets)',    desc: 'Keep A, combine both achievement lists' },
              { key: 'skip',   label: 'Skip — keep both',          desc: 'Leave them as-is' },
            ].map(opt => (
              <button key={opt.key} onClick={() => selectMode(opt.key)}
                className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                  mode === opt.key
                    ? 'border-brand-500 bg-brand-900/30 text-white'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
                }`}>
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>

          {mode === 'merge' && (
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-2">Edit the merged achievements (one per line):</p>
              <textarea value={mergedText} onChange={e => setMergedText(e.target.value)}
                rows={6} className="w-full resize-none text-xs font-mono" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-5 border-t border-gray-800">
          <button onClick={onDone} className="btn-secondary">Close</button>
          <button onClick={applyAndNext} disabled={!mode || applying} className="btn-primary">
            {applying ? 'Applying…' : index + 1 < pairs.length ? 'Apply & Next →' : 'Apply & Finish'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Reusable inline editor ────────────────────────────────────────────────────

const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 }

function parseExpDate(str) {
  if (!str) return 0
  // ISO: "2024-10" or "2024"
  const iso = str.match(/^(\d{4})(?:-(\d{2}))?/)
  if (iso) return parseInt(iso[1]) * 100 + parseInt(iso[2] || '0')
  // "Oct 2024" or "October 2024"
  const named = str.match(/^(\w{3})\w*\s+(\d{4})$/i)
  if (named) return parseInt(named[2]) * 100 + (MONTHS[named[1].toLowerCase()] || 0)
  return 0
}

function sortExperiences(items) {
  return [...items].sort((a, b) => {
    if (a.is_current !== b.is_current) return a.is_current ? -1 : 1
    const endDiff = parseExpDate(b.end_date) - parseExpDate(a.end_date)
    if (endDiff !== 0) return endDiff
    return parseExpDate(b.start_date) - parseExpDate(a.start_date)
  })
}

function Field({ label, value, onChange, name, type = 'text', placeholder, className = '' }) {
  return (
    <div className={className}>
      <label>{label}</label>
      <input type={type} name={name} value={value || ''} onChange={onChange} placeholder={placeholder} className="w-full" />
    </div>
  )
}

// ── Experience Section ────────────────────────────────────────────────────────

function ExperienceSection({ profileId }) {
  const [items, setItems] = useState([])
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [scanPairs, setScanPairs]   = useState(null)
  const [scanning, setScanning]     = useState(false)
  const [scanMsg, setScanMsg]       = useState(null)
  const [polishing, setPolishing]   = useState(null) // id being polished
  const [polishPreview, setPolishPreview] = useState(null) // { id, bullets }

  const load = () => api.listExperiences(profileId).then(items => setItems(sortExperiences(items)))
  useEffect(() => { if (profileId) load() }, [profileId])

  async function handleFindDuplicates() {
    setScanning(true); setScanMsg(null)
    const { pairs } = await api.findDuplicates(profileId)
    setScanning(false)
    if (pairs.length === 0) { setScanMsg('No duplicates found.'); return }
    setScanPairs(pairs)
  }

  const blank = { company: '', title: '', location: '', start_date: '', end_date: '', is_current: false, description: '', achievements: '' }

  function startAdd() { setAdding(true); setEditing(null); setForm(blank) }
  function startEdit(item) { setEditing(item.id); setAdding(false); setForm({ ...item }) }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  async function handleSave() {
    const data = { ...form, profile_id: profileId }
    if (editing) await api.updateExperience(editing, data)
    else await api.createExperience(data)
    setAdding(false); setEditing(null)
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this experience?')) return
    await api.deleteExperience(id)
    load()
  }

  async function handlePolish(item) {
    setPolishing(item.id)
    try {
      const { original, bullets } = await api.polishExperience(item.id)
      setPolishPreview({ id: item.id, original, bullets })
    } catch (e) {
      alert(e.response?.data?.error || e.message)
    }
    setPolishing(null)
  }

  async function applyPolish() {
    if (!polishPreview) return
    const item = items.find(i => i.id === polishPreview.id)
    const cleaned = polishPreview.bullets.map(b => `• ${b}`).join('\n')
    await api.updateExperience(polishPreview.id, { ...item, achievements: cleaned, description: '' })
    setPolishPreview(null)
    load()
  }

  const isFormOpen = adding || editing !== null

  return (
    <section className="mb-8">
      {scanPairs && (
        <DuplicateScanModal pairs={scanPairs} onDone={() => { setScanPairs(null); load() }} />
      )}

      {/* Polish preview modal */}
      {polishPreview && (() => {
        const beforeSet = new Set(polishPreview.original.map(b => b.toLowerCase().trim()))
        const afterSet  = new Set(polishPreview.bullets.map(b => b.toLowerCase().trim()))
        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
            <div className="bg-gray-900 rounded-xl border border-brand-700 w-full max-w-5xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-gray-800">
                <div>
                  <h2 className="font-bold text-white text-lg">✨ Before & After</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {polishPreview.original.length} bullets → {polishPreview.bullets.length} bullets · duplicates removed, wording improved, no new facts added
                  </p>
                </div>
                <div className="flex gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-800 inline-block"/>Removed</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-800 inline-block"/>New / improved</span>
                </div>
              </div>

              <div className="grid grid-cols-2 divide-x divide-gray-800 overflow-y-auto flex-1">
                {/* Before */}
                <div className="p-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Before ({polishPreview.original.length})</p>
                  <div className="space-y-2">
                    {polishPreview.original.map((b, i) => {
                      const kept = afterSet.has(b.toLowerCase().trim())
                      return (
                        <div key={i} className={`flex items-start gap-2 text-sm rounded px-2 py-1 ${kept ? 'text-gray-400' : 'text-red-400 bg-red-900/20 line-through decoration-red-700'}`}>
                          <span className="mt-0.5 shrink-0">•</span>
                          <span>{b}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* After */}
                <div className="p-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">After ({polishPreview.bullets.length})</p>
                  <div className="space-y-2">
                    {polishPreview.bullets.map((b, i) => {
                      const isNew = !beforeSet.has(b.toLowerCase().trim())
                      return (
                        <div key={i} className={`flex items-start gap-2 text-sm rounded px-2 py-1 ${isNew ? 'text-green-300 bg-green-900/20' : 'text-gray-300'}`}>
                          <span className="mt-0.5 shrink-0 text-brand-400">•</span>
                          <span>{b}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-5 border-t border-gray-800">
                <button onClick={() => setPolishPreview(null)} className="btn-secondary">Discard</button>
                <button onClick={applyPolish} className="btn-primary">✓ Apply & Save</button>
              </div>
            </div>
          </div>
        )
      })()}
      <div className="flex items-center justify-between mb-3">
        <p className="section-heading mb-0">Work Experience</p>
        <div className="flex gap-2">
          <button onClick={handleFindDuplicates} disabled={scanning} className="btn-sm btn-secondary">
            {scanning ? 'Scanning…' : '⊕ Find Duplicates'}
          </button>
          <button onClick={startAdd} className="btn-sm btn-primary">+ Add</button>
        </div>
      </div>
      {scanMsg && <p className="text-xs text-green-400 mb-3">{scanMsg}</p>}

      {isFormOpen && (
        <div className="card mb-4 border-brand-700">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Company *" name="company" value={form.company} onChange={handleChange} placeholder="Acme Inc." />
            <Field label="Job Title *" name="title" value={form.title} onChange={handleChange} placeholder="Software Engineer" />
            <Field label="Location" name="location" value={form.location} onChange={handleChange} placeholder="Toronto, ON" />
            <div className="flex gap-2 items-end">
              <Field label="Start Date" name="start_date" value={form.start_date} onChange={handleChange} placeholder="2022-01" className="flex-1" />
              {!form.is_current && <Field label="End Date" name="end_date" value={form.end_date} onChange={handleChange} placeholder="2024-06" className="flex-1" />}
            </div>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input type="checkbox" id="is_current" name="is_current" checked={!!form.is_current} onChange={handleChange} className="w-4 h-4" />
            <label htmlFor="is_current" className="text-xs text-gray-400 mb-0 cursor-pointer">Currently working here</label>
          </div>
          <div className="mb-3">
            <label>Description / Responsibilities</label>
            <textarea name="description" value={form.description || ''} onChange={handleChange} rows={3}
              placeholder="Describe your role…" className="w-full resize-none" />
          </div>
          <div className="mb-4">
            <label>Key Achievements (one per line, start with • or -)</label>
            <textarea name="achievements" value={form.achievements || ''} onChange={handleChange} rows={4}
              placeholder="• Increased performance by 40%&#10;• Led a team of 5 engineers" className="w-full resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary">Save</button>
            <button onClick={() => { setAdding(false); setEditing(null) }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {items.length === 0 && !isFormOpen && (
        <div className="card text-gray-600 text-sm text-center py-8">No experiences yet. Add one or upload a resume.</div>
      )}

      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className={`card ${editing === item.id ? 'hidden' : ''}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white">{item.title}</span>
                  <span className="text-gray-500">@</span>
                  <span className="text-brand-400">{item.company}</span>
                  {item.is_current ? <span className="badge bg-green-900 text-green-300">Current</span> : null}
                  <span className="badge bg-gray-800 text-gray-400">{item.source}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {item.start_date || '?'} – {item.is_current ? 'Present' : item.end_date || '?'}
                  {item.location && ` · ${item.location}`}
                </div>
                {item.description && <p className="text-sm text-gray-400 mt-2">{item.description}</p>}
                {item.achievements && (
                  <div className="mt-2 text-xs text-gray-400 whitespace-pre-line">{item.achievements}</div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => handlePolish(item)} disabled={polishing === item.id}
                  className="btn-sm btn-secondary" title="Remove duplicates and improve wording with AI">
                  {polishing === item.id ? '…' : '✨ Clean up'}
                </button>
                <button onClick={() => startEdit(item)} className="btn-sm btn-secondary">Edit</button>
                <button onClick={() => handleDelete(item.id)} className="btn-sm btn-danger">✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Education Section ─────────────────────────────────────────────────────────

function EducationSection({ profileId }) {
  const [items, setItems] = useState([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({})

  const load = () => api.listEducation(profileId).then(setItems)
  useEffect(() => { if (profileId) load() }, [profileId])

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  async function handleSave() {
    await api.createEducation({ ...form, profile_id: profileId })
    setAdding(false); setForm({}); load()
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="section-heading mb-0">Education</p>
        <button onClick={() => setAdding(a => !a)} className="btn-sm btn-primary">+ Add</button>
      </div>

      {adding && (
        <div className="card mb-4 border-brand-700">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Institution *" name="institution" value={form.institution} onChange={handleChange} placeholder="University of Toronto" className="col-span-2" />
            <Field label="Degree" name="degree" value={form.degree} onChange={handleChange} placeholder="Bachelor of Science" />
            <Field label="Field of Study" name="field" value={form.field} onChange={handleChange} placeholder="Computer Science" />
            <Field label="Start Year" name="start_date" value={form.start_date} onChange={handleChange} placeholder="2018" />
            <Field label="End Year" name="end_date" value={form.end_date} onChange={handleChange} placeholder="2022" />
            <Field label="GPA (optional)" name="gpa" value={form.gpa} onChange={handleChange} placeholder="3.8/4.0" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary">Save</button>
            <button onClick={() => { setAdding(false); setForm({}) }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="card flex items-center justify-between">
            <div>
              <span className="font-medium text-white">{item.degree}{item.field ? ` in ${item.field}` : ''}</span>
              <span className="text-gray-500 mx-2">—</span>
              <span className="text-brand-400">{item.institution}</span>
              <div className="text-xs text-gray-500">{item.start_date || ''} – {item.end_date || ''}{item.gpa ? ` · GPA: ${item.gpa}` : ''}</div>
            </div>
            <button onClick={() => { api.deleteEducation(item.id).then(load) }} className="btn-sm btn-danger">✕</button>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Skills Section ────────────────────────────────────────────────────────────

function SkillsSection({ profileId }) {
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')

  const load = () => api.listSkills(profileId).then(setItems)
  useEffect(() => { if (profileId) load() }, [profileId])

  async function handleAdd() {
    if (!name.trim()) return
    await api.createSkill({ profile_id: profileId, name: name.trim(), category: category.trim() || null })
    setName(''); load()
  }

  // Group by category
  const grouped = {}
  for (const s of items) {
    const key = s.category || 'Other'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(s)
  }

  return (
    <section className="mb-8">
      <p className="section-heading">Skills</p>
      <div className="flex gap-2 mb-4 flex-wrap">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="Skill name (press Enter)" className="flex-1 min-w-40" />
        <input value={category} onChange={e => setCategory(e.target.value)}
          placeholder="Category (optional)" className="w-48" />
        <button onClick={handleAdd} className="btn-primary">Add</button>
      </div>

      {Object.entries(grouped).map(([cat, skills]) => (
        <div key={cat} className="mb-3">
          <p className="text-xs text-gray-600 mb-1">{cat}</p>
          <div className="flex flex-wrap gap-2">
            {skills.map(s => (
              <span key={s.id} className="tag group">
                {s.name}
                <button onClick={() => api.deleteSkill(s.id).then(load)}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-opacity ml-0.5">✕</button>
              </span>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

// ── Projects Section ──────────────────────────────────────────────────────────

function ProjectsSection({ profileId }) {
  const [items, setItems] = useState([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({})

  const load = () => api.listProjects(profileId).then(setItems)
  useEffect(() => { if (profileId) load() }, [profileId])

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  async function handleSave() {
    await api.createProject({ ...form, profile_id: profileId })
    setAdding(false); setForm({}); load()
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="section-heading mb-0">Projects</p>
        <button onClick={() => setAdding(a => !a)} className="btn-sm btn-primary">+ Add</button>
      </div>

      {adding && (
        <div className="card mb-4 border-brand-700">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Project Name *" name="name" value={form.name} onChange={handleChange} className="col-span-2" />
            <Field label="URL" name="url" value={form.url} onChange={handleChange} placeholder="https://github.com/..." />
            <Field label="Tech Stack" name="tech_stack" value={form.tech_stack} onChange={handleChange} placeholder="React, Node.js, PostgreSQL" />
          </div>
          <div className="mb-3">
            <label>Description</label>
            <textarea name="description" value={form.description || ''} onChange={handleChange} rows={2} className="w-full resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary">Save</button>
            <button onClick={() => { setAdding(false); setForm({}) }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="card flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{item.name}</span>
                {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="text-brand-400 text-xs hover:underline">↗ {item.source}</a>}
                <span className="badge bg-gray-800 text-gray-500">{item.source}</span>
              </div>
              {item.description && <p className="text-sm text-gray-400 mt-1">{item.description}</p>}
              {item.tech_stack && <p className="text-xs text-gray-600 mt-1">{item.tech_stack}</p>}
            </div>
            <button onClick={() => api.deleteProject(item.id).then(load)} className="btn-sm btn-danger shrink-0">✕</button>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Certifications ────────────────────────────────────────────────────────────

function CertificationsSection({ profileId }) {
  const [items, setItems] = useState([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({})

  const load = () => api.listCertifications(profileId).then(setItems)
  useEffect(() => { if (profileId) load() }, [profileId])

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  async function handleSave() {
    await api.createCertification({ ...form, profile_id: profileId })
    setAdding(false); setForm({}); load()
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="section-heading mb-0">Certifications</p>
        <button onClick={() => setAdding(a => !a)} className="btn-sm btn-primary">+ Add</button>
      </div>

      {adding && (
        <div className="card mb-4 border-brand-700">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Field label="Certification Name *" name="name" value={form.name} onChange={handleChange} className="col-span-2" />
            <Field label="Issuer" name="issuer" value={form.issuer} onChange={handleChange} placeholder="AWS, Google, etc." />
            <Field label="Date Issued" name="issued_date" value={form.issued_date} onChange={handleChange} placeholder="2023-06" />
            <Field label="URL" name="url" value={form.url} onChange={handleChange} placeholder="https://..." className="col-span-2" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn-primary">Save</button>
            <button onClick={() => { setAdding(false); setForm({}) }} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className="card flex items-center justify-between">
            <div>
              <span className="font-medium text-white">{item.name}</span>
              {item.issuer && <span className="text-gray-500 ml-2">· {item.issuer}</span>}
              {item.issued_date && <span className="text-xs text-gray-600 ml-2">{item.issued_date}</span>}
            </div>
            <button onClick={() => api.deleteCertification(item.id).then(load)} className="btn-sm btn-danger">✕</button>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Profile Overview Card ─────────────────────────────────────────────────────

function ProfileOverview({ profileId }) {
  const [basics, setBasics] = useState(null)
  useEffect(() => {
    if (profileId) api.getProfileData(profileId).then(d => setBasics(d.basics || {}))
  }, [profileId])

  if (!basics) return null

  return (
    <div className="card mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {basics.full_name
            ? <h2 className="text-xl font-bold text-white">{basics.full_name}</h2>
            : <p className="text-gray-600 italic text-sm">Name not set</p>}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-gray-400">
            {basics.email    && <span>✉ {basics.email}</span>}
            {basics.phone    && <span>✆ {basics.phone}</span>}
            {basics.location && <span>⌖ {basics.location}</span>}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
            {basics.linkedin_url && <a href={basics.linkedin_url} target="_blank" rel="noreferrer" className="hover:text-brand-400">LinkedIn ↗</a>}
            {basics.github_url   && <a href={basics.github_url}   target="_blank" rel="noreferrer" className="hover:text-brand-400">GitHub ↗</a>}
          </div>
          {basics.summary && (
            <p className="text-sm text-gray-400 mt-2 leading-relaxed">{basics.summary}</p>
          )}
        </div>
        <Link to="/profile" className="btn-sm btn-secondary shrink-0">Edit Profile</Link>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExperiencesPage() {
  const { currentId } = useProfile()

  return (
    <div className="page">
      <h1 className="page-title">My Profile</h1>
      <p className="page-subtitle">All your professional data. This feeds the AI when generating tailored resumes.</p>
      <ProfileOverview profileId={currentId} />
      <ExperienceSection profileId={currentId} />
      <EducationSection profileId={currentId} />
      <SkillsSection profileId={currentId} />
      <ProjectsSection profileId={currentId} />
      <CertificationsSection profileId={currentId} />
    </div>
  )
}
