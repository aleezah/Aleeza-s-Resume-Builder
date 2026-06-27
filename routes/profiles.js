const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { getDb } = require('../db')

const router = express.Router()

function currentProfileId() {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'current_profile_id'").get()
  return row ? row.value : null
}

// List all profiles
router.get('/', (_req, res) => {
  const profiles = getDb().prepare('SELECT * FROM profiles ORDER BY created_at ASC').all()
  res.json(profiles)
})

// Get current profile id
router.get('/current', (_req, res) => {
  res.json({ id: currentProfileId() })
})

// Set current profile
router.put('/current', (req, res) => {
  const { id } = req.body
  getDb().prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('current_profile_id',?)").run(id)
  res.json({ success: true })
})

// Create profile
router.post('/', (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })
  const id = uuidv4()
  getDb().prepare('INSERT INTO profiles (id, name) VALUES (?, ?)').run(id, name.trim())
  res.json({ id, name: name.trim() })
})

// Rename profile
router.patch('/:id', (req, res) => {
  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })
  getDb().prepare('UPDATE profiles SET name = ? WHERE id = ?').run(name.trim(), req.params.id)
  res.json({ success: true })
})

// Delete profile
router.delete('/:id', (req, res) => {
  const profiles = getDb().prepare('SELECT id FROM profiles').all()
  if (profiles.length <= 1) return res.status(400).json({ error: 'Cannot delete the last profile' })

  getDb().prepare('DELETE FROM profiles WHERE id = ?').run(req.params.id)

  // If deleted profile was current, switch to first remaining
  if (currentProfileId() === req.params.id) {
    const first = getDb().prepare("SELECT id FROM profiles LIMIT 1").get()
    if (first) getDb().prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('current_profile_id',?)").run(first.id)
  }
  res.json({ success: true })
})

// Get full profile data
router.get('/:id/data', (req, res) => {
  const db = getDb()
  const pid = req.params.id
  const basics    = db.prepare('SELECT * FROM profile_basics WHERE profile_id = ?').get(pid)
  const experiences = db.prepare('SELECT * FROM experiences WHERE profile_id = ? ORDER BY CASE WHEN is_current=1 THEN 0 ELSE 1 END, end_date DESC, start_date DESC').all(pid)
  const education = db.prepare('SELECT * FROM education WHERE profile_id = ? ORDER BY end_date DESC').all(pid)
  const skills    = db.prepare('SELECT * FROM skills WHERE profile_id = ? ORDER BY category, name').all(pid)
  const certs     = db.prepare('SELECT * FROM certifications WHERE profile_id = ? ORDER BY issued_date DESC').all(pid)
  const projects  = db.prepare('SELECT * FROM projects WHERE profile_id = ? ORDER BY start_date DESC').all(pid)
  res.json({ basics, experiences, education, skills, certifications: certs, projects })
})

// Upsert basics
router.put('/:id/basics', (req, res) => {
  const pid = req.params.id
  const b = req.body
  getDb().prepare(`
    INSERT INTO profile_basics (profile_id,full_name,email,phone,location,linkedin_url,github_url,gitlab_url,website,summary,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,unixepoch())
    ON CONFLICT(profile_id) DO UPDATE SET
      full_name=excluded.full_name, email=excluded.email, phone=excluded.phone,
      location=excluded.location, linkedin_url=excluded.linkedin_url,
      github_url=excluded.github_url, gitlab_url=excluded.gitlab_url,
      website=excluded.website, summary=excluded.summary,
      updated_at=unixepoch()
  `).run(pid, b.full_name||null, b.email||null, b.phone||null, b.location||null,
         b.linkedin_url||null, b.github_url||null, b.gitlab_url||null, b.website||null, b.summary||null)
  res.json({ success: true })
})

module.exports = router
