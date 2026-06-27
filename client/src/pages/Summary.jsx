import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProfile } from '../App'
import * as api from '../api'

export default function SummaryPage() {
  const { currentId } = useProfile()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (!currentId) return
    setLoading(true)
    const d = await api.getProfileData(currentId)
    setData(d)
    setLoading(false)
  }

  useEffect(() => { load() }, [currentId])

  if (loading) return <div className="page text-gray-600">Loading…</div>

  const { basics, experiences, education, skills, certifications, projects } = data || {}
  const isEmpty = !basics?.full_name && !experiences?.length && !skills?.length

  // Group skills by category
  const skillGroups = {}
  for (const s of skills || []) {
    const key = s.category || 'Other'
    if (!skillGroups[key]) skillGroups[key] = []
    skillGroups[key].push(s.name)
  }

  return (
    <div className="page max-w-4xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="page-title">Profile Summary</h1>
        <Link to="/profile" className="btn-secondary btn-sm">Edit Basics</Link>
      </div>
      <p className="page-subtitle">
        Compiled view of all your profile data.
        {isEmpty && <span> Upload a resume on the <Link to="/documents" className="text-brand-400 hover:underline">Documents</Link> page to auto-fill.</span>}
      </p>

      {isEmpty && (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">◎</div>
          <p className="text-gray-400 mb-4">Your profile is empty. Upload a resume and the AI will extract your info automatically.</p>
          <Link to="/documents" className="btn-primary">Upload Resume</Link>
        </div>
      )}

      {!isEmpty && (
        <>
          {/* Header / Contact */}
          <div className="card mb-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                {basics?.full_name
                  ? <h2 className="text-2xl font-bold text-white">{basics.full_name}</h2>
                  : <p className="text-gray-600 italic">Name not set — <Link to="/profile" className="text-brand-400 hover:underline">add it</Link></p>
                }
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-gray-400">
                  {basics?.email    && <span>✉ {basics.email}</span>}
                  {basics?.phone    && <span>✆ {basics.phone}</span>}
                  {basics?.location && <span>⌖ {basics.location}</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                  {basics?.linkedin_url && <a href={basics.linkedin_url} target="_blank" rel="noreferrer" className="hover:text-brand-400">LinkedIn ↗</a>}
                  {basics?.github_url   && <a href={basics.github_url}   target="_blank" rel="noreferrer" className="hover:text-brand-400">GitHub ↗</a>}
                  {basics?.gitlab_url   && <a href={basics.gitlab_url}   target="_blank" rel="noreferrer" className="hover:text-brand-400">GitLab ↗</a>}
                  {basics?.website      && <a href={basics.website}       target="_blank" rel="noreferrer" className="hover:text-brand-400">Website ↗</a>}
                </div>
              </div>
              <Link to="/profile" className="btn-sm btn-secondary shrink-0">Edit</Link>
            </div>

            {basics?.summary && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="section-heading">Summary</p>
                <p className="text-sm text-gray-300 leading-relaxed">{basics.summary}</p>
              </div>
            )}
          </div>

          {/* Experience */}
          {experiences?.length > 0 && (
            <div className="card mb-5">
              <div className="flex items-center justify-between mb-4">
                <p className="section-heading mb-0">Work Experience</p>
                <Link to="/experiences" className="text-xs text-brand-400 hover:underline">Edit →</Link>
              </div>
              <div className="space-y-5">
                {experiences.map((exp, i) => (
                  <div key={exp.id} className={i > 0 ? 'pt-5 border-t border-gray-800' : ''}>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold text-white">{exp.title}</div>
                        <div className="text-brand-400 text-sm">{exp.company}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-gray-500">
                          {exp.start_date || '?'} – {exp.is_current ? 'Present' : exp.end_date || '?'}
                        </div>
                        {exp.location && <div className="text-xs text-gray-600">{exp.location}</div>}
                      </div>
                    </div>
                    {exp.achievements ? (
                      <div className="mt-2 space-y-1">
                        {exp.achievements.split('\n').filter(Boolean).map((line, j) => (
                          <p key={j} className="text-xs text-gray-400 flex gap-2">
                            <span className="text-brand-600 shrink-0">•</span>
                            {line.replace(/^[-•*]\s*/, '')}
                          </p>
                        ))}
                      </div>
                    ) : exp.description ? (
                      <p className="text-sm text-gray-400 mt-2">{exp.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {education?.length > 0 && (
            <div className="card mb-5">
              <div className="flex items-center justify-between mb-4">
                <p className="section-heading mb-0">Education</p>
                <Link to="/experiences" className="text-xs text-brand-400 hover:underline">Edit →</Link>
              </div>
              <div className="space-y-3">
                {education.map(edu => (
                  <div key={edu.id} className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-white">
                        {[edu.degree, edu.field].filter(Boolean).join(' in ') || 'Degree'}
                      </div>
                      <div className="text-brand-400 text-sm">{edu.institution}</div>
                      {edu.gpa && <div className="text-xs text-gray-500">GPA: {edu.gpa}</div>}
                    </div>
                    <div className="text-xs text-gray-500 shrink-0">
                      {edu.start_date || ''} – {edu.end_date || ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {skills?.length > 0 && (
            <div className="card mb-5">
              <div className="flex items-center justify-between mb-4">
                <p className="section-heading mb-0">Skills</p>
                <Link to="/experiences" className="text-xs text-brand-400 hover:underline">Edit →</Link>
              </div>
              <div className="space-y-3">
                {Object.entries(skillGroups).map(([cat, names]) => (
                  <div key={cat}>
                    <p className="text-xs text-gray-600 mb-1.5">{cat}</p>
                    <div className="flex flex-wrap gap-2">
                      {names.map(n => <span key={n} className="tag">{n}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {projects?.length > 0 && (
            <div className="card mb-5">
              <div className="flex items-center justify-between mb-4">
                <p className="section-heading mb-0">Projects</p>
                <Link to="/experiences" className="text-xs text-brand-400 hover:underline">Edit →</Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {projects.map(proj => (
                  <div key={proj.id} className="bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white text-sm">{proj.name}</span>
                      {proj.url && <a href={proj.url} target="_blank" rel="noreferrer" className="text-brand-400 text-xs hover:underline">↗</a>}
                      <span className="badge bg-gray-700 text-gray-500 text-xs ml-auto">{proj.source}</span>
                    </div>
                    {proj.description && <p className="text-xs text-gray-400 mt-1">{proj.description}</p>}
                    {proj.tech_stack  && <p className="text-xs text-gray-600 mt-1">{proj.tech_stack}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications */}
          {certifications?.length > 0 && (
            <div className="card mb-5">
              <div className="flex items-center justify-between mb-4">
                <p className="section-heading mb-0">Certifications</p>
                <Link to="/experiences" className="text-xs text-brand-400 hover:underline">Edit →</Link>
              </div>
              <div className="space-y-2">
                {certifications.map(cert => (
                  <div key={cert.id} className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-white">{cert.name}</span>
                      {cert.issuer && <span className="text-gray-500 text-xs ml-2">· {cert.issuer}</span>}
                    </div>
                    {cert.issued_date && <span className="text-xs text-gray-600">{cert.issued_date}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats footer */}
          <div className="text-xs text-gray-700 text-center mt-2">
            {experiences?.length || 0} experiences · {education?.length || 0} education · {skills?.length || 0} skills · {projects?.length || 0} projects
          </div>
        </>
      )}
    </div>
  )
}
