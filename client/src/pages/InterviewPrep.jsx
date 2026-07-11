import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useProfile } from '../App'
import * as api from '../api'

const CATEGORIES = [
  { key: 'behavioral',  label: 'Behavioral',        desc: 'STAR-method questions about past experience',           color: 'text-blue-400',   border: 'border-blue-800',   bg: 'bg-blue-900/20' },
  { key: 'technical',   label: 'Technical',         desc: 'Role-specific tools, systems, and domain knowledge',    color: 'text-purple-400', border: 'border-purple-800', bg: 'bg-purple-900/20' },
  { key: 'coding',      label: 'Coding & Problems', desc: 'Algorithms, system design, debugging, and trade-offs',  color: 'text-rose-400',   border: 'border-rose-800',   bg: 'bg-rose-900/20' },
  { key: 'situational', label: 'Situational',       desc: 'Hypothetical scenario handling questions',              color: 'text-amber-400',  border: 'border-amber-800',  bg: 'bg-amber-900/20' },
  { key: 'about_you',   label: 'About You',         desc: 'Background, motivation, working style, and culture fit',color: 'text-green-400',  border: 'border-green-800',  bg: 'bg-green-900/20' },
]

function QuestionCard({ question, hint, index, color, border, bg }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`rounded-lg border ${border} overflow-hidden`}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-800/50 transition-colors">
        <span className={`shrink-0 text-xs font-bold mt-0.5 w-5 ${color}`}>{index + 1}.</span>
        <span className="text-sm text-gray-200 flex-1">{question}</span>
        <span className={`shrink-0 text-xs mt-0.5 transition-transform ${open ? 'rotate-180' : ''} text-gray-500`}>▾</span>
      </button>
      {open && (
        <div className={`${bg} border-t ${border} px-4 py-3`}>
          <p className="text-xs font-semibold text-gray-400 mb-1">{hint ? 'Talking point' : 'No hint available'}</p>
          {hint && <p className="text-sm text-gray-300 leading-relaxed">{hint}</p>}
        </div>
      )}
    </div>
  )
}

function ResultPanel({ result, onDelete }) {
  const [activeCategory, setActiveCategory] = useState(() => {
    const first = CATEGORIES.find(c => (result.questions[c.key]?.length || 0) > 0)
    return first?.key || 'behavioral'
  })

  const questions   = result.questions || {}
  const visibleCats = CATEGORIES.filter(c => (questions[c.key]?.length || 0) > 0)
  const activeCat   = CATEGORIES.find(c => c.key === activeCategory)
  const activeQs    = questions[activeCategory] || []
  const totalCount  = CATEGORIES.reduce((n, c) => n + (questions[c.key]?.length || 0), 0)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="section-heading mb-0">{result.job_title || result.job?.title} @ {result.job_company || result.job?.company}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalCount} questions · {result.job_only ? 'Job description only' : 'Personalised to your profile'}
          </p>
        </div>
        {onDelete && (
          <button onClick={onDelete} className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1">
            ✕ Delete
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-4 border-b border-gray-800 overflow-x-auto">
        {visibleCats.map(cat => {
          const count = questions[cat.key]?.length || 0
          return (
            <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
              className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${
                activeCategory === cat.key ? `border-current ${cat.color}` : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}>
              {cat.label}
              <span className={`text-xs rounded-full px-1.5 py-0.5 ${
                activeCategory === cat.key ? cat.bg + ' ' + cat.color : 'bg-gray-800 text-gray-500'
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {activeCat && (
        <div>
          <p className="text-xs text-gray-500 mb-3">{activeCat.desc} — click any question to reveal a hint.</p>
          <div className="space-y-2">
            {activeQs.map((q, i) => (
              <QuestionCard key={i} index={i} question={q.question} hint={q.hint}
                color={activeCat.color} border={activeCat.border} bg={activeCat.bg} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function InterviewPrepPage() {
  const { currentId } = useProfile()
  const [jobs, setJobs]             = useState([])
  const [selectedJobId, setSelectedJobId] = useState('')
  const [jobOnly, setJobOnly]       = useState(false)
  const [generating, setGenerating] = useState(false)
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState(null)
  const [history, setHistory]       = useState([])
  const [loadingId, setLoadingId]   = useState(null)

  const refreshHistory = useCallback(() => {
    if (currentId) api.listInterviewPreps(currentId).then(setHistory)
  }, [currentId])

  useEffect(() => {
    if (!currentId) return
    api.listJobs(currentId).then(j => {
      setJobs(j)
      if (j.length) setSelectedJobId(j[0].id)
    })
    refreshHistory()
  }, [currentId, refreshHistory])

  async function handleGenerate() {
    if (!selectedJobId) return alert('Select a job first.')
    setGenerating(true); setError(null); setResult(null)
    try {
      const r = await api.generateInterview({ profile_id: currentId, job_id: selectedJobId, job_only: jobOnly })
      setResult(r)
      refreshHistory()
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    }
    setGenerating(false)
  }

  async function handleLoad(id) {
    setLoadingId(id); setError(null)
    try {
      const r = await api.getInterviewPrep(id)
      setResult(r)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setError(e.response?.data?.error || e.message)
    }
    setLoadingId(null)
  }

  async function handleDelete(id) {
    await api.deleteInterviewPrep(id)
    if (result?.id === id) setResult(null)
    refreshHistory()
  }

  const selectedJob = jobs.find(j => j.id === selectedJobId)

  return (
    <div className="page">
      <h1 className="page-title">Interview Prep</h1>
      <p className="page-subtitle">Generate tailored interview questions with answer hints based on the job posting.</p>

      {/* Controls */}
      <div className="card mb-6">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="col-span-2">
            <label>Job Description</label>
            <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)} className="w-full">
              <option value="">— Select a job —</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.title || 'Untitled'} @ {j.company || '?'}</option>
              ))}
            </select>
            {jobs.length === 0 && (
              <p className="text-xs text-gray-600 mt-1">No jobs yet. <Link to="/jobs/new" className="text-brand-400 hover:underline">Add one →</Link></p>
            )}
          </div>
          <div className="flex flex-col justify-end">
            <button onClick={handleGenerate} disabled={generating || !selectedJobId} className="btn-primary text-base px-6 py-3">
              {generating
                ? <span className="flex items-center gap-2"><span className="animate-spin">⟳</span> Generating…</span>
                : '◈ Generate Questions'}
            </button>
          </div>
        </div>

        {selectedJob && (
          <div className="bg-gray-800 rounded-lg px-4 py-3 text-sm mb-3">
            <span className="font-medium text-white">{selectedJob.title}</span>
            <span className="text-gray-500 mx-2">@</span>
            <span className="text-brand-400">{selectedJob.company}</span>
          </div>
        )}

        {/* Job-only toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
          <div onClick={() => setJobOnly(v => !v)}
            className={`w-10 h-5 rounded-full transition-colors ${jobOnly ? 'bg-brand-600' : 'bg-gray-700'} relative`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${jobOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
          <div>
            <span className="text-sm text-gray-300">Job description only</span>
            <p className="text-xs text-gray-600">
              {jobOnly
                ? 'Questions and hints based on the job posting — no personal profile data used.'
                : 'Questions and hints personalised to your experience and skills.'}
            </p>
          </div>
        </label>

        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">{error}</div>
        )}
      </div>

      {/* Current result */}
      {result && (
        <div className="mb-6">
          <ResultPanel result={result} onDelete={result.id ? () => handleDelete(result.id) : null} />
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <p className="section-heading">Saved Sessions</p>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className={`card flex items-center justify-between py-3 ${result?.id === h.id ? 'border-brand-700' : ''}`}>
                <div>
                  <span className="text-sm text-white">{h.job_title || 'Untitled Role'}</span>
                  <span className="text-gray-500 text-xs ml-2">@ {h.job_company || '?'}</span>
                  {h.job_only ? <span className="ml-2 text-xs text-gray-600">· job only</span> : null}
                  <div className="text-xs text-gray-600 mt-0.5">{new Date(h.created_at * 1000).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleLoad(h.id)} disabled={loadingId === h.id}
                    className="btn-sm btn-secondary">
                    {loadingId === h.id ? '…' : 'Load'}
                  </button>
                  <button onClick={() => handleDelete(h.id)}
                    className="btn-sm text-xs text-gray-600 hover:text-red-400 transition-colors px-2">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
