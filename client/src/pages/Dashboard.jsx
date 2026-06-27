import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProfile } from '../App'
import * as api from '../api'

export default function Dashboard() {
  const { currentId } = useProfile()
  const [data, setData] = useState(null)
  const [jobs, setJobs] = useState([])
  const [gens, setGens] = useState([])

  useEffect(() => {
    if (!currentId) return
    Promise.all([
      api.getProfileData(currentId),
      api.listJobs(currentId),
      api.listGenerations(currentId)
    ]).then(([d, j, g]) => { setData(d); setJobs(j); setGens(g) })
  }, [currentId])

  const stats = data ? [
    { label: 'Experiences',     val: data.experiences?.length || 0,     to: '/experiences' },
    { label: 'Skills',          val: data.skills?.length || 0,          to: '/experiences' },
    { label: 'Jobs Tracked',    val: jobs.length,                        to: '/jobs' },
    { label: 'Resumes Generated', val: gens.length,                     to: '/generate' },
  ] : []

  const recentJobs = jobs.slice(0, 5)

  return (
    <div className="page">
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">{data?.basics?.full_name ? `Welcome back, ${data.basics.full_name.split(' ')[0]}!` : 'Set up your profile to get started.'}</p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <Link key={s.label} to={s.to} className="card hover:border-brand-600 transition-colors text-center group">
            <div className="text-3xl font-bold text-brand-400 group-hover:text-brand-300">{s.val}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="card">
          <p className="section-heading">Quick Actions</p>
          <div className="space-y-2">
            <Link to="/documents" className="btn-secondary w-full justify-center">Upload Resume / Cover Letter</Link>
            <Link to="/jobs" className="btn-secondary w-full justify-center">Add a Job Description</Link>
            <Link to="/generate" className="btn-primary w-full justify-center">Generate Resume</Link>
          </div>
        </div>

        <div className="card">
          <p className="section-heading">Recent Jobs</p>
          {recentJobs.length === 0 ? (
            <p className="text-gray-600 text-sm">No jobs tracked yet. <Link to="/jobs" className="text-brand-400 hover:underline">Add one →</Link></p>
          ) : (
            <div className="space-y-2">
              {recentJobs.map(j => (
                <Link key={j.id} to={`/jobs/${j.id}`} className="flex items-center justify-between hover:bg-gray-800 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                  <div>
                    <div className="text-sm font-medium text-white">{j.title || 'Untitled Role'}</div>
                    <div className="text-xs text-gray-500">{j.company || 'Unknown Company'}</div>
                  </div>
                  <StatusBadge status={j.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Profile completeness */}
      {data && <ProfileCompleteness data={data} />}
    </div>
  )
}

function StatusBadge({ status }) {
  const colours = {
    new:       'bg-gray-800 text-gray-400',
    applied:   'bg-blue-900 text-blue-300',
    interview: 'bg-yellow-900 text-yellow-300',
    offer:     'bg-green-900 text-green-300',
    rejected:  'bg-red-900 text-red-400',
    closed:    'bg-gray-800 text-gray-600'
  }
  return <span className={`badge ${colours[status] || colours.new}`}>{status}</span>
}

function ProfileCompleteness({ data }) {
  const checks = [
    { label: 'Basic info (name, email)', done: !!(data.basics?.full_name && data.basics?.email) },
    { label: 'Work experience added', done: data.experiences?.length > 0 },
    { label: 'Education added',       done: data.education?.length > 0 },
    { label: 'Skills listed',         done: data.skills?.length > 0 },
    { label: 'Summary written',       done: !!data.basics?.summary },
  ]
  const pct = Math.round((checks.filter(c => c.done).length / checks.length) * 100)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <p className="section-heading mb-0">Profile Completeness</p>
        <span className="text-brand-400 font-bold text-sm">{pct}%</span>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-1.5 mb-4">
        <div className="bg-brand-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {checks.map(c => (
          <div key={c.label} className={`flex items-center gap-2 text-xs ${c.done ? 'text-gray-400' : 'text-gray-600'}`}>
            <span>{c.done ? '✓' : '○'}</span>
            {c.label}
          </div>
        ))}
      </div>
    </div>
  )
}
