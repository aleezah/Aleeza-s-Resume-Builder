import { useEffect, useState } from 'react'
import { useSearchParams, Routes, Route, Link } from 'react-router-dom'
import { useProfile } from '../App'
import * as api from '../api'
import ProgressBar, { useProgressBar } from '../components/ProgressBar'

// ── Markdown renderer ─────────────────────────────────────────────────────────

function renderInline(str) {
  const parts = str.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    if (part.startsWith('*') && part.endsWith('*'))   return <em key={i} className="text-gray-300 italic">{part.slice(1, -1)}</em>
    return part
  })
}

function MdPreview({ text }) {
  if (!text) return null
  return (
    <div className="prose prose-invert prose-sm max-w-none font-sans">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('#### ')) return <p key={i} className="text-xs font-semibold text-gray-400 mt-1 mb-0">{renderInline(line.slice(5))}</p>
        if (line.startsWith('### '))  return <h3 key={i} className="text-sm font-semibold text-white mt-3 mb-0">{renderInline(line.slice(4))}</h3>
        if (line.startsWith('## '))   return <h2 key={i} className="text-sm font-bold text-brand-400 mt-5 mb-1 border-b border-gray-800 pb-1 uppercase tracking-wide">{renderInline(line.slice(3))}</h2>
        if (line.startsWith('# '))    return <h1 key={i} className="text-2xl font-bold text-white mt-2 mb-1">{renderInline(line.slice(2))}</h1>
        if (line.startsWith('_') && line.endsWith('_')) return <p key={i} className="text-xs text-gray-500 italic my-0">{line.slice(1, -1)}</p>
        if (/^[-•*]\s/.test(line))    return <p key={i} className="text-xs text-gray-300 pl-4 my-0.5 before:content-['•'] before:mr-2 before:text-gray-600">{renderInline(line.replace(/^[-•*]\s/, ''))}</p>
        if (line.trim() === '')       return <div key={i} className="h-2" />
        return <p key={i} className="text-xs text-gray-400 my-0.5">{renderInline(line)}</p>
      })}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 }
function parseDate(str) {
  if (!str) return 0
  const iso = str.match(/^(\d{4})(?:-(\d{2}))?/)
  if (iso) return parseInt(iso[1]) * 100 + parseInt(iso[2] || '0')
  const named = str.match(/^(\w{3})\w*\s+(\d{4})$/i)
  if (named) return parseInt(named[2]) * 100 + (MONTHS[named[1].toLowerCase()] || 0)
  return 0
}

// ── Main generate page ────────────────────────────────────────────────────────

function GenerateMain() {
  const { currentId } = useProfile()
  const [searchParams] = useSearchParams()
  const preJobId = searchParams.get('job_id')

  const [jobs, setJobs] = useState([])
  const [selectedJobId, setSelectedJobId] = useState(preJobId || '')
  const [templateStyle, setTemplateStyle] = useState('modern')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('resume')
  const [history, setHistory] = useState([])

  // Customisation state
  const [experiences, setExperiences] = useState([])
  const [selectedExpIds, setSelectedExpIds] = useState(new Set())
  const [includeCerts, setIncludeCerts] = useState(false)
  const [includeProjects, setIncludeProjects] = useState(false)
  const [showCustomise, setShowCustomise] = useState(false)

  const genProgress = useProgressBar([
    [10, 'Sending to AI…'],
    [30, 'Writing resume…'],
    [60, 'Writing cover letter…'],
    [80, 'Formatting output…'],
    [90, 'Almost done…'],
  ])

  useEffect(() => {
    if (!currentId) return
    api.listJobs(currentId).then(j => { setJobs(j); if (!selectedJobId && j.length) setSelectedJobId(j[0].id) })
    api.listGenerations(currentId).then(setHistory)
    api.listExperiences(currentId).then(exps => {
      const sorted = [...exps].sort((a, b) => {
        if (a.is_current !== b.is_current) return a.is_current ? -1 : 1
        const ed = parseDate(b.end_date) - parseDate(a.end_date)
        return ed !== 0 ? ed : parseDate(b.start_date) - parseDate(a.start_date)
      })
      setExperiences(sorted)
      // Default: select the 4 most recent
      setSelectedExpIds(new Set(sorted.slice(0, 4).map(e => e.id)))
    })
  }, [currentId])

  function toggleExp(id) {
    setSelectedExpIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleGenerate() {
    if (!selectedJobId) return alert('Select a job first.')
    setGenerating(true); setError(null); setResult(null)
    genProgress.start('Building profile context…')
    try {
      const r = await api.generate({
        profile_id: currentId,
        job_id: selectedJobId,
        options: {
          template_style: templateStyle,
          selected_exp_ids: [...selectedExpIds],
          include_certs: includeCerts,
          include_projects: includeProjects,
        }
      })
      genProgress.finish()
      setResult(r)
      api.listGenerations(currentId).then(setHistory)
    } catch (e) {
      genProgress.reset()
      setError(e.response?.data?.error || e.message)
    }
    setGenerating(false)
  }

  const selectedJob = jobs.find(j => j.id === selectedJobId)

  return (
    <div className="page">
      <h1 className="page-title">Generate</h1>
      <p className="page-subtitle">Select a job and generate a tailored resume and cover letter.</p>

      {/* Controls */}
      <div className="card mb-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="col-span-2">
            <label>Job Description</label>
            <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)} className="w-full">
              <option value="">— Select a job —</option>
              {jobs.map(j => <option key={j.id} value={j.id}>{j.title || 'Untitled'} @ {j.company || '?'}</option>)}
            </select>
            {jobs.length === 0 && <p className="text-xs text-gray-600 mt-1">No jobs yet. <Link to="/jobs/new" className="text-brand-400 hover:underline">Add one →</Link></p>}
          </div>
          <div>
            <label>Resume Style</label>
            <select value={templateStyle} onChange={e => setTemplateStyle(e.target.value)} className="w-full">
              <option value="modern">Modern</option>
              <option value="classic">Classic</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
        </div>

        {selectedJob && (
          <div className="bg-gray-800 rounded-lg px-4 py-3 mb-4 text-sm">
            <span className="font-medium text-white">{selectedJob.title}</span>
            <span className="text-gray-500 mx-2">@</span>
            <span className="text-brand-400">{selectedJob.company}</span>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <button onClick={handleGenerate} disabled={generating || !selectedJobId} className="btn-primary text-base px-6 py-3">
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin inline-block">⟳</span> Generating…
              </span>
            ) : '⚡ Generate Resume & Cover Letter'}
          </button>
          <button onClick={() => setShowCustomise(c => !c)} className="btn-secondary btn-sm">
            {showCustomise ? '▲ Hide options' : '▼ Customise'}
          </button>
        </div>

        <ProgressBar progress={genProgress.progress} phase={genProgress.phase} />

        <p className="text-xs text-gray-600 mt-2">
          Upload a <span className="text-gray-500">.tex</span> file in{' '}
          <a href="/documents" className="text-brand-400 hover:underline">Documents → Template</a>{' '}
          to have the AI fill in your exact LaTeX format.
        </p>

        {error && (
          <div className="mt-4 bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
            {error}
            {error.includes('provider') || error.includes('configured') || error.includes('Settings') ? (
              <span> → <Link to="/settings" className="underline">Configure AI in Settings</Link></span>
            ) : null}
          </div>
        )}
      </div>

      {/* Customise panel */}
      {showCustomise && (
        <div className="card mb-6 border-gray-700">
          <p className="section-heading mb-3">Customise Resume Content</p>

          {/* Experience selector */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
              Experiences to include <span className="text-gray-600 normal-case font-normal">(4 most recent selected by default)</span>
            </p>
            <div className="space-y-1.5">
              {experiences.map(exp => (
                <label key={exp.id} className="flex items-start gap-3 cursor-pointer group">
                  <input type="checkbox" checked={selectedExpIds.has(exp.id)} onChange={() => toggleExp(exp.id)}
                    className="mt-0.5 accent-brand-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-white">{exp.title}</span>
                    <span className="text-xs text-gray-500 ml-2">@ {exp.company}</span>
                    {!!exp.is_current && <span className="ml-2 badge bg-green-900 text-green-400 text-xs">current</span>}
                    <div className="text-xs text-gray-600">{exp.start_date}{exp.end_date || exp.is_current ? ` – ${exp.is_current ? 'Present' : exp.end_date}` : ''}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Optional sections */}
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Optional sections</p>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={includeCerts} onChange={e => setIncludeCerts(e.target.checked)} className="accent-brand-500" />
                <span className="text-sm text-gray-300">Certifications</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={includeProjects} onChange={e => setIncludeProjects(e.target.checked)} className="accent-brand-500" />
                <span className="text-sm text-gray-300">Projects</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 mb-0">
            <p className="section-heading mb-0">Generated Output</p>
            {result.used_template && <span className="badge bg-green-900 text-green-300 text-xs">LaTeX template used</span>}
          </div>
            <div className="flex gap-2">
              <a href={result.downloads.docx} className="btn-sm btn-secondary">↓ Resume DOCX</a>
              <a href={result.downloads.cover_letter_docx} className="btn-sm btn-secondary">↓ Cover Letter DOCX</a>
              <button onClick={() => {
                const blob = new Blob([result.resume_latex], { type: 'text/plain' })
                const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'resume.tex' })
                a.click()
              }} className="btn-sm btn-secondary">↓ LaTeX</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-gray-800">
            {['resume', 'cover_letter', 'latex'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
                  activeTab === tab ? 'border-brand-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}>
                {tab === 'resume' ? 'Resume' : tab === 'cover_letter' ? 'Cover Letter' : 'LaTeX'}
              </button>
            ))}
          </div>

          {activeTab === 'resume'       && <MdPreview text={result.resume_md} />}
          {activeTab === 'cover_letter' && (
            result.cover_letter_md
              ? <MdPreview text={result.cover_letter_md} />
              : <p className="text-sm text-gray-500 py-4">No cover letter was returned by the AI. Try regenerating — the model may not have followed the output format on the first attempt.</p>
          )}
          {activeTab === 'latex'        && (
            <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap bg-gray-950 rounded-lg p-4 overflow-auto max-h-[60vh]">
              {result.resume_latex}
            </pre>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <p className="section-heading">Previous Generations</p>
          <div className="space-y-2">
            {history.slice(0, 20).map(g => (
              <div key={g.id} className="card flex items-center justify-between py-3">
                <div>
                  <span className="text-sm text-white">{g.job_title || 'Unknown Role'}</span>
                  <span className="text-gray-500 text-xs ml-2">@ {g.company || '?'}</span>
                  <div className="text-xs text-gray-600">{new Date(g.created_at * 1000).toLocaleString()}</div>
                </div>
                <div className="flex gap-2">
                  <a href={`/api/generate/${g.id}/download/docx`} className="btn-sm btn-secondary">Resume</a>
                  <a href={`/api/generate/${g.id}/download/cover-letter-docx`} className="btn-sm btn-secondary">Cover Letter</a>
                  <a href={`/api/generate/${g.id}/download/tex`}  className="btn-sm btn-secondary">LaTeX</a>
                  <button onClick={async () => {
                    if (!confirm('Delete this generation?')) return
                    await api.deleteGeneration(g.id)
                    setHistory(h => h.filter(x => x.id !== g.id))
                  }} className="btn-sm btn-danger">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function GeneratePage() {
  return (
    <Routes>
      <Route path="/*" element={<GenerateMain />} />
    </Routes>
  )
}
