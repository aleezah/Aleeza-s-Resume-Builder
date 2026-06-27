import { useEffect, useState } from 'react'
import { Routes, Route, Link, useNavigate, useParams } from 'react-router-dom'
import { useProfile } from '../App'
import * as api from '../api'

const STATUS_COLOURS = {
  new:       'bg-gray-800 text-gray-400',
  applied:   'bg-blue-900 text-blue-300',
  interview: 'bg-yellow-900 text-yellow-300',
  offer:     'bg-green-900 text-green-300',
  rejected:  'bg-red-900 text-red-400',
  closed:    'bg-gray-800 text-gray-600'
}

// ── Job List ──────────────────────────────────────────────────────────────────

function JobList() {
  const { currentId } = useProfile()
  const [jobs, setJobs] = useState([])
  const [filter, setFilter] = useState('all')

  const load = () => api.listJobs(currentId).then(setJobs)
  useEffect(() => { if (currentId) load() }, [currentId])

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter)

  return (
    <div className="page">
      <div className="flex items-center justify-between mb-1">
        <h1 className="page-title">Jobs</h1>
        <Link to="/jobs/new" className="btn-primary">+ Add Job</Link>
      </div>
      <p className="page-subtitle">Track job descriptions and generate tailored applications.</p>

      {/* Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'new', 'applied', 'interview', 'offer', 'rejected', 'closed'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card text-center py-12 text-gray-600">
          No jobs yet. <Link to="/jobs/new" className="text-brand-400 hover:underline">Add a job description →</Link>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(job => (
          <Link key={job.id} to={`/jobs/${job.id}`} className="card hover:border-gray-600 transition-colors flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white">{job.title || 'Untitled Role'}</div>
              <div className="text-sm text-gray-400">{job.company || 'Unknown Company'}</div>
              <div className="text-xs text-gray-600 mt-0.5">{new Date(job.created_at * 1000).toLocaleDateString()}</div>
            </div>
            <span className={`badge shrink-0 ${STATUS_COLOURS[job.status] || STATUS_COLOURS.new}`}>
              {job.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

// ── New / Edit Job Form ───────────────────────────────────────────────────────

function JobForm() {
  const { currentId } = useProfile()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id

  const [form, setForm] = useState({ company: '', title: '', url: '', raw_text: '', notes: '' })
  const [scraping, setScraping] = useState(false)
  const [scrapeUrl, setScrapeUrl] = useState('')
  const [scrapeError, setScrapeError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isEdit) api.getJob(id).then(j => setForm(j))
  }, [id])

  function handleChange(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })) }

  async function handleScrape() {
    if (!scrapeUrl.trim()) return
    setScraping(true); setScrapeError(null)
    try {
      const result = await api.scrapeUrl(scrapeUrl)
      setForm(f => ({
        ...f,
        url: result.url || f.url,
        company: result.company || f.company,
        title: result.title || f.title,
        raw_text: result.raw_text || f.raw_text
      }))
    } catch (e) {
      setScrapeError(e.response?.data?.error || e.message)
    }
    setScraping(false)
  }

  async function handleSave() {
    if (!form.raw_text.trim()) return alert('Job description text is required.')
    setSaving(true)
    if (isEdit) {
      await api.updateJob(id, form)
      navigate(`/jobs/${id}`)
    } else {
      const { id: newId } = await api.createJob({ ...form, profile_id: currentId })
      navigate(`/jobs/${newId}`)
    }
    setSaving(false)
  }

  return (
    <div className="page">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/jobs" className="text-gray-500 hover:text-white text-sm">← Jobs</Link>
        <h1 className="page-title mb-0">{isEdit ? 'Edit Job' : 'Add Job'}</h1>
      </div>

      {/* Scrape URL */}
      <div className="card mb-6">
        <p className="section-heading">Scrape from URL (optional)</p>
        <p className="text-xs text-gray-500 mb-3">Paste a job posting URL to auto-fill the description. Requires Playwright browsers to be installed.</p>
        <div className="flex gap-2">
          <input value={scrapeUrl} onChange={e => setScrapeUrl(e.target.value)}
            placeholder="https://jobs.company.com/posting/123" className="flex-1" />
          <button onClick={handleScrape} disabled={scraping} className="btn-secondary whitespace-nowrap">
            {scraping ? 'Scraping…' : 'Fetch'}
          </button>
        </div>
        {scrapeError && <p className="text-red-400 text-xs mt-2">{scrapeError}</p>}
      </div>

      {/* Manual form */}
      <div className="card">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label>Company</label>
            <input name="company" value={form.company || ''} onChange={handleChange} placeholder="Acme Corp" className="w-full" />
          </div>
          <div>
            <label>Role / Title</label>
            <input name="title" value={form.title || ''} onChange={handleChange} placeholder="Senior Software Engineer" className="w-full" />
          </div>
          <div className="col-span-2">
            <label>Job Posting URL</label>
            <input name="url" value={form.url || ''} onChange={handleChange} placeholder="https://..." className="w-full" />
          </div>
        </div>

        <div className="mb-4">
          <label>Job Description *</label>
          <textarea name="raw_text" value={form.raw_text || ''} onChange={handleChange} rows={14}
            placeholder="Paste the full job description here…" className="w-full resize-none font-mono text-xs" />
        </div>

        <div className="mb-4">
          <label>Notes</label>
          <textarea name="notes" value={form.notes || ''} onChange={handleChange} rows={2}
            placeholder="Personal notes about this role…" className="w-full resize-none" />
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Job'}</button>
          <Link to="/jobs" className="btn-secondary">Cancel</Link>
        </div>
      </div>
    </div>
  )
}

// ── Job Detail ────────────────────────────────────────────────────────────────

function JobDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [expanded, setExpanded] = useState(false)

  const load = () => api.getJob(id).then(setJob)
  useEffect(() => { load() }, [id])

  async function handleStatus(status) {
    await api.updateStatus(id, status)
    load()
  }

  async function handleDelete() {
    if (!confirm('Delete this job?')) return
    await api.deleteJob(id)
    navigate('/jobs')
  }

  if (!job) return <div className="page text-gray-600">Loading…</div>

  return (
    <div className="page">
      <div className="flex items-center gap-3 mb-4">
        <Link to="/jobs" className="text-gray-500 hover:text-white text-sm">← Jobs</Link>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{job.title || 'Untitled Role'}</h1>
          <div className="text-brand-400 text-sm">{job.company}</div>
          {job.url && <a href={job.url} target="_blank" rel="noreferrer" className="text-xs text-gray-500 hover:text-brand-400">↗ Job posting</a>}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Link to={`/jobs/${id}/edit`} className="btn-secondary btn-sm">Edit</Link>
          <Link to={`/generate?job_id=${id}`} className="btn-primary btn-sm">⚡ Generate</Link>
          <button onClick={handleDelete} className="btn-sm btn-danger">Delete</button>
        </div>
      </div>

      {/* Status */}
      <div className="card mb-6">
        <p className="section-heading">Application Status</p>
        <div className="flex gap-2 flex-wrap">
          {['new', 'applied', 'interview', 'offer', 'rejected', 'closed'].map(s => (
            <button key={s} onClick={() => handleStatus(s)}
              className={`btn-sm ${job.status === s ? 'btn-primary' : 'btn-secondary'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Job description */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="section-heading mb-0">Job Description</p>
          <button onClick={() => setExpanded(e => !e)} className="text-xs text-gray-500 hover:text-white">
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
        <pre className={`text-xs text-gray-400 whitespace-pre-wrap font-mono overflow-hidden transition-all ${expanded ? '' : 'max-h-48'}`}>
          {job.raw_text}
        </pre>
      </div>

      {job.notes && (
        <div className="card mb-6">
          <p className="section-heading">Notes</p>
          <p className="text-sm text-gray-400">{job.notes}</p>
        </div>
      )}
    </div>
  )
}

// ── Router ────────────────────────────────────────────────────────────────────

export default function JobsPage() {
  return (
    <Routes>
      <Route path="/"       element={<JobList />} />
      <Route path="/new"    element={<JobForm />} />
      <Route path="/:id"    element={<JobDetail />} />
      <Route path="/:id/edit" element={<JobForm />} />
    </Routes>
  )
}
