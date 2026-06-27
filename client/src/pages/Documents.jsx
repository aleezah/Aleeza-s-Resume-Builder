import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProfile } from '../App'
import * as api from '../api'
import MergeModal from '../components/MergeModal'
import ProgressBar, { useProgressBar } from '../components/ProgressBar'

const TYPE_LABELS = { resume: 'Resume', cover_letter: 'Cover Letter', template: 'Template' }

export default function DocumentsPage() {
  const { currentId } = useProfile()
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadType, setUploadType] = useState('resume')
  const [uploadLabel, setUploadLabel] = useState('')
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)
  const [extractResult, setExtractResult] = useState(null)
  const [mergeData, setMergeData] = useState(null)
  const [importing, setImporting] = useState(false)
  const [reprocessing, setReprocessing] = useState(null) // doc id being reprocessed
  const [dragging, setDragging] = useState(false)
  const dragCounter = useRef(0)
  const fileInputRef = useRef(null)
  const uploadProgress    = useProgressBar([
    [0,  'Uploading file…'],
    [20, 'Parsing document…'],
    [40, 'AI is reading your resume…'],
    [65, 'Extracting experience & skills…'],
    [80, 'Almost done…'],
  ])
  const reprocessProgress = useProgressBar([
    [0,  'Loading document…'],
    [20, 'AI is reading your resume…'],
    [50, 'Extracting experience & skills…'],
    [75, 'Almost done…'],
  ])

  const load = () => api.listDocuments(currentId).then(setDocs)
  useEffect(() => { if (currentId) load() }, [currentId])

  async function uploadFile(file) {
    if (!file) return
    setUploading(true); setError(null); setExtractResult(null)
    uploadProgress.start()
    try {
      const fd = new FormData()
      fd.append('profile_id', currentId)
      fd.append('type', uploadType)
      fd.append('label', uploadLabel)
      fd.append('file', file)
      const result = await api.uploadDocument(fd)
      uploadProgress.finish()
      await load()
      setUploadLabel('')
      if (uploadType === 'resume') {
        setExtractResult({ ...result, docId: result.id })
        if (result.duplicates?.length > 0) {
          setMergeData({ duplicates: result.duplicates, extracted: result.extracted })
        }
      }
    } catch (err) {
      uploadProgress.reset()
      setError(err.response?.data?.error || err.message)
    }
    setUploading(false)
  }

  function handleFileInput(e) {
    uploadFile(e.target.files?.[0])
    e.target.value = ''
  }

  function handleDragEnter(e) {
    e.preventDefault()
    dragCounter.current++
    setDragging(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setDragging(false)
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  function handleDrop(e) {
    e.preventDefault()
    dragCounter.current = 0
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  async function handleImportExtracted(extracted) {
    setImporting(true)
    await api.importExtracted({ profile_id: currentId, data: extracted, source: 'document' })
    setImporting(false)
    setExtractResult(prev => ({ ...prev, imported: true }))
  }

  async function handleReprocess(doc) {
    setReprocessing(doc.id); setExtractResult(null)
    reprocessProgress.start()
    try {
      const result = await api.reprocessDocument(doc.id)
      reprocessProgress.finish()
      setExtractResult({ ...result, docId: doc.id })
      if (result.duplicates?.length > 0) {
        setMergeData({ duplicates: result.duplicates, extracted: result.extracted })
      }
    } catch (err) {
      reprocessProgress.reset()
      alert(err.response?.data?.error || err.message)
    }
    setReprocessing(null)
  }

  async function handleSetTemplate(id) {
    await api.setTemplate(id, currentId); load()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this document?')) return
    await api.deleteDocument(id); load()
  }

  const grouped = {}
  for (const d of docs) {
    if (!grouped[d.type]) grouped[d.type] = []
    grouped[d.type].push(d)
  }

  return (
    <div className="page">
      <h1 className="page-title">Documents</h1>
      <p className="page-subtitle">Upload resumes and cover letters. The app extracts your info automatically — basics (name, email, etc.) work without AI; full experience extraction requires AI configured in Settings.</p>

      {/* Upload */}
      <div className="card mb-5">
        <p className="section-heading">Upload Document</p>

        {/* Type + Label row */}
        <div className="flex gap-3 items-end flex-wrap mb-3">
          <div>
            <label>Type</label>
            <select value={uploadType} onChange={e => setUploadType(e.target.value)} className="w-36">
              <option value="resume">Resume</option>
              <option value="cover_letter">Cover Letter</option>
              <option value="template">Template</option>
            </select>
          </div>
          <div className="flex-1">
            <label>Label (optional)</label>
            <input value={uploadLabel} onChange={e => setUploadLabel(e.target.value)}
              placeholder="e.g. Software Engineer resume 2024" className="w-full" />
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed
            py-10 cursor-pointer transition-colors select-none
            ${dragging
              ? 'border-brand-500 bg-brand-900/20 text-brand-300'
              : 'border-gray-700 hover:border-gray-500 text-gray-500 hover:text-gray-400'}
            ${uploading ? 'pointer-events-none opacity-60' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.tex"
            onChange={handleFileInput}
            className="hidden"
          />
          {uploading ? (
            <>
              <span className="text-2xl animate-spin">⟳</span>
              <span className="text-sm">Uploading & parsing…</span>
            </>
          ) : dragging ? (
            <>
              <span className="text-3xl">↓</span>
              <span className="text-sm font-medium">Drop to upload</span>
            </>
          ) : (
            <>
              <span className="text-3xl">⬆</span>
              <span className="text-sm font-medium">Drag & drop a file here, or click to browse</span>
              <span className="text-xs">PDF, DOCX, DOC, TXT, TEX · Max 20 MB</span>
            </>
          )}
        </div>

        <ProgressBar progress={uploadProgress.progress} phase={uploadProgress.phase} />
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        <p className="text-xs text-gray-600 mt-2">Upload a .tex file as "Template" to use your LaTeX format when generating</p>
      </div>

      {/* Re-extract progress */}
      {reprocessing && (
        <div className="card mb-5">
          <ProgressBar progress={reprocessProgress.progress} phase={reprocessProgress.phase} />
        </div>
      )}

      {/* Extraction result panel */}
      {extractResult && !mergeData && (
        <ExtractionPanel
          result={extractResult}
          importing={importing}
          onImport={() => handleImportExtracted(extractResult.extracted)}
          onDismiss={() => setExtractResult(null)}
        />
      )}

      {/* Merge modal */}
      {mergeData && (
        <MergeModal
          duplicates={mergeData.duplicates}
          extracted={mergeData.extracted}
          profileId={currentId}
          onDone={() => setMergeData(null)}
        />
      )}

      {/* Document list */}
      {Object.keys(grouped).length === 0 && (
        <div className="card text-center py-12 text-gray-600">
          No documents yet. Upload a resume to get started.
        </div>
      )}

      {Object.entries(grouped).map(([type, items]) => (
        <div key={type} className="mb-6">
          <p className="section-heading">{TYPE_LABELS[type] || type}s</p>
          <div className="space-y-2">
            {items.map(doc => (
              <div key={doc.id} className="card flex items-center justify-between gap-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{doc.label || doc.original_name}</span>
                    {doc.is_template === 1 && <span className="badge bg-brand-900 text-brand-300">Template</span>}
                  </div>
                  <div className="text-xs text-gray-500">{doc.original_name} · {new Date(doc.created_at * 1000).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => api.getDocText(doc.id).then(d => setPreview(d)).catch(e => alert(e.response?.data?.error || e.message))}
                    className="btn-sm btn-secondary">
                    View
                  </button>
                  {type === 'resume' && (
                    <button
                      onClick={() => handleReprocess(doc)}
                      disabled={reprocessing === doc.id}
                      className="btn-sm btn-secondary"
                      title="Re-extract data using AI (configure AI in Settings first)">
                      {reprocessing === doc.id ? 'Processing…' : '⟳ Re-extract'}
                    </button>
                  )}
                  {(type === 'resume' || type === 'cover_letter' || type === 'template') && (
                    <button onClick={() => handleSetTemplate(doc.id)} className="btn-sm btn-secondary"
                      title={type === 'cover_letter' ? 'Use as cover letter style template' : type === 'template' ? 'Use as LaTeX template' : 'Use as resume template'}>
                      {doc.is_template ? '★ Template' : '☆ Template'}
                    </button>
                  )}
                  <button onClick={() => handleDelete(doc.id)} className="btn-sm btn-danger">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Text preview modal */}
      {preview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="font-semibold">{preview.original_name}</h2>
              <button onClick={() => setPreview(null)} className="text-gray-500 hover:text-white text-lg">✕</button>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">{preview.raw_text}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Extraction panel ──────────────────────────────────────────────────────────

function ExtractionPanel({ result, importing, onImport, onDismiss }) {
  if (result.imported) {
    return (
      <div className="card mb-5 border-green-800 bg-green-900/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-green-400 font-medium">✓ Imported successfully</p>
            <p className="text-xs text-gray-500 mt-0.5">Experiences, skills and education were added to your profile.</p>
          </div>
          <Link to="/experiences" className="btn-primary btn-sm">View Summary →</Link>
        </div>
      </div>
    )
  }

  if (result.aiUsed && result.extracted) {
    const exp = result.extracted.experiences?.length || 0
    const edu = result.extracted.education?.length || 0
    const skl = result.extracted.skills?.length || 0
    const prj = result.extracted.projects?.length || 0
    return (
      <div className="card mb-5 border-brand-700">
        <p className="section-heading">AI Extraction Complete</p>
        <div className="flex flex-wrap gap-3 mb-3">
          {[['Experiences', exp], ['Education', edu], ['Skills', skl], ['Projects', prj]].map(([label, n]) => (
            <div key={label} className="bg-gray-800 rounded-lg px-3 py-2 text-center">
              <div className="text-xl font-bold text-brand-400">{n}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
        {result.basicsFilled && (
          <p className="text-xs text-green-400 mb-3">✓ Profile basics (name, email, phone, links) auto-filled.</p>
        )}
        <div className="flex gap-2">
          <button onClick={onImport} disabled={importing} className="btn-primary">
            {importing ? 'Importing…' : 'Import All Data'}
          </button>
          <button onClick={onDismiss} className="btn-secondary">Dismiss</button>
        </div>
      </div>
    )
  }

  // No AI — show what we got from regex and prompt to configure
  return (
    <div className="card mb-5 border-yellow-800 bg-yellow-900/10">
      <p className="section-heading">Upload Complete</p>
      {result.basicsFilled
        ? <p className="text-sm text-yellow-300 mb-2">✓ Basic info (name, email, phone, links) was extracted and auto-filled on your profile.</p>
        : <p className="text-sm text-gray-400 mb-2">The file was saved. Basic info could not be extracted automatically (unusual format).</p>
      }
      <p className="text-sm text-gray-500 mb-3">
        To extract your full work history, skills and education, configure an AI provider first.
      </p>
      <div className="flex gap-2 flex-wrap">
        <Link to="/settings" className="btn-primary btn-sm">⚙ Configure AI</Link>
        <Link to="/experiences" className="btn-secondary btn-sm">View Profile →</Link>
        <button onClick={onDismiss} className="btn-secondary btn-sm">Dismiss</button>
      </div>
      <p className="text-xs text-gray-600 mt-2">After configuring AI, use the "⟳ Re-extract" button on this document to pull your full history.</p>
    </div>
  )
}
