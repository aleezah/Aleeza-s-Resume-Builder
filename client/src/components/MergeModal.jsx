import { useState } from 'react'
import * as api from '../api'

/**
 * Shows duplicate experience candidates and lets the user decide how to merge.
 * duplicates: [{ score, incoming, existing }]
 */
export default function MergeModal({ duplicates, extracted, profileId, onDone }) {
  const [index, setIndex] = useState(0)
  const [decisions, setDecisions] = useState({})  // existing.id -> 'keep_both' | 'keep_existing' | 'keep_incoming' | 'merge'
  const [merged, setMerged] = useState({})         // existing.id -> { achievements, description }
  const [processing, setProcessing] = useState(false)

  const dup = duplicates[index]
  const decision = decisions[dup?.existing.id]

  function setDecision(d) {
    setDecisions(prev => ({ ...prev, [dup.existing.id]: d }))
    if (d === 'merge') {
      setMerged(prev => ({
        ...prev,
        [dup.existing.id]: {
          achievements: [dup.existing.achievements, dup.incoming.achievements].filter(Boolean).join('\n'),
          description: dup.existing.description || dup.incoming.description || ''
        }
      }))
    }
  }

  function next() { if (index < duplicates.length - 1) setIndex(i => i + 1) }
  function prev() { if (index > 0) setIndex(i => i - 1) }

  async function handleApply() {
    setProcessing(true)
    try {
      for (const dup of duplicates) {
        const d = decisions[dup.existing.id] || 'keep_both'
        if (d === 'keep_both') {
          // Import incoming as new entry
          await api.importExtracted({ profile_id: profileId, data: { experiences: [dup.incoming] }, source: 'document' })
        } else if (d === 'keep_existing') {
          // Do nothing — incoming is discarded
        } else if (d === 'keep_incoming') {
          // Replace existing with incoming
          await api.updateExperience(dup.existing.id, { ...dup.incoming })
        } else if (d === 'merge') {
          const m = merged[dup.existing.id] || {}
          await api.confirmMerge({
            keep_id: dup.existing.id,
            discard_id: null,
            merged_achievements: m.achievements,
            merged_description: m.description
          })
        }
      }

      // Import non-duplicate experiences from extracted data
      if (extracted?.experiences) {
        const duplicateIncoming = new Set(duplicates.map(d => JSON.stringify({ company: d.incoming.company, title: d.incoming.title })))
        const nonDupes = extracted.experiences.filter(e => !duplicateIncoming.has(JSON.stringify({ company: e.company, title: e.title })))
        if (nonDupes.length) {
          await api.importExtracted({ profile_id: profileId, data: { ...extracted, experiences: nonDupes }, source: 'document' })
        }
      }
    } finally {
      setProcessing(false)
      onDone()
    }
  }

  if (!dup) return null

  const allDecided = duplicates.every(d => decisions[d.existing.id])

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
      <div className="bg-gray-900 rounded-xl border border-brand-700 w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div>
            <h2 className="font-bold text-white text-lg">Potential Duplicate Experiences</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {duplicates.length} possible duplicate{duplicates.length !== 1 ? 's' : ''} found · {index + 1} of {duplicates.length}
            </p>
          </div>
          <span className="badge bg-yellow-900 text-yellow-300 text-xs">{dup.score}% similar</span>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {/* Side-by-side comparison */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-brand-400 font-semibold mb-2 uppercase tracking-wide">Existing (in your profile)</p>
              <ExpCard exp={dup.existing} />
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-yellow-400 font-semibold mb-2 uppercase tracking-wide">Incoming (from document)</p>
              <ExpCard exp={dup.incoming} />
            </div>
          </div>

          {/* Decision buttons */}
          <p className="section-heading">What do you want to do?</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { key: 'keep_existing', label: 'Keep existing, discard incoming',  desc: 'Keep what you already have.' },
              { key: 'keep_incoming', label: 'Replace with incoming version',     desc: 'Use the version from the document.' },
              { key: 'merge',         label: 'Merge (combine bullet points)',     desc: 'Keep existing entry, combine the achievements.' },
              { key: 'keep_both',     label: 'Keep both as separate entries',    desc: 'Add the incoming as a separate experience.' },
            ].map(opt => (
              <button key={opt.key} onClick={() => setDecision(opt.key)}
                className={`text-left p-3 rounded-lg border text-sm transition-colors ${
                  decision === opt.key
                    ? 'border-brand-500 bg-brand-900/30 text-white'
                    : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
                }`}>
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>

          {/* Merge editor */}
          {decision === 'merge' && merged[dup.existing.id] && (
            <div className="bg-gray-800 rounded-lg p-4 mt-2">
              <p className="text-xs text-gray-400 mb-2">Edit the merged achievements (one per line):</p>
              <textarea
                value={merged[dup.existing.id]?.achievements || ''}
                onChange={e => setMerged(m => ({ ...m, [dup.existing.id]: { ...m[dup.existing.id], achievements: e.target.value } }))}
                rows={6} className="w-full resize-none text-xs font-mono" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-gray-800">
          <div className="flex gap-2">
            <button onClick={prev} disabled={index === 0} className="btn-secondary btn-sm">← Prev</button>
            <button onClick={next} disabled={index === duplicates.length - 1} className="btn-secondary btn-sm">Next →</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onDone()} className="btn-secondary">Skip All</button>
            <button onClick={handleApply} disabled={processing || !allDecided} className="btn-primary">
              {processing ? 'Applying…' : `Apply Decisions (${Object.keys(decisions).length}/${duplicates.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ExpCard({ exp }) {
  return (
    <div>
      <div className="font-semibold text-white text-sm">{exp.title}</div>
      <div className="text-brand-400 text-xs">{exp.company}</div>
      <div className="text-gray-500 text-xs mb-2">
        {exp.start_date || '?'} – {exp.is_current ? 'Present' : exp.end_date || '?'}
        {exp.location && ` · ${exp.location}`}
      </div>
      {exp.description && <p className="text-gray-400 text-xs mb-1">{exp.description}</p>}
      {exp.achievements && (
        <pre className="text-gray-400 text-xs whitespace-pre-wrap font-sans">{exp.achievements}</pre>
      )}
    </div>
  )
}
