const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { getDb } = require('../db')

const router = express.Router()

router.get('/', (req, res) => {
  const { profile_id } = req.query
  if (!profile_id) return res.status(400).json({ error: 'profile_id required' })
  const rows = getDb().prepare('SELECT * FROM job_descriptions WHERE profile_id = ? ORDER BY created_at DESC').all(profile_id)
  res.json(rows)
})

router.get('/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM job_descriptions WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json(row)
})

router.post('/', (req, res) => {
  const { profile_id, company, title, url, raw_text, notes } = req.body
  if (!profile_id || !raw_text) return res.status(400).json({ error: 'profile_id and raw_text required' })
  const id = uuidv4()
  getDb().prepare(`
    INSERT INTO job_descriptions (id,profile_id,company,title,url,raw_text,notes)
    VALUES (?,?,?,?,?,?,?)
  `).run(id, profile_id, company||null, title||null, url||null, raw_text, notes||null)
  res.json({ id })
})

router.put('/:id', (req, res) => {
  const { company, title, url, raw_text, notes, status } = req.body
  getDb().prepare(`
    UPDATE job_descriptions SET company=?,title=?,url=?,raw_text=?,notes=?,status=?,updated_at=unixepoch() WHERE id=?
  `).run(company||null, title||null, url||null, raw_text, notes||null, status||'new', req.params.id)
  res.json({ success: true })
})

router.patch('/:id/status', (req, res) => {
  const { status } = req.body
  getDb().prepare('UPDATE job_descriptions SET status=?,updated_at=unixepoch() WHERE id=?').run(status, req.params.id)
  res.json({ success: true })
})

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM job_descriptions WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.get('/export/csv', (req, res) => {
  const { profile_id } = req.query
  if (!profile_id) return res.status(400).json({ error: 'profile_id required' })
  const rows = getDb().prepare('SELECT * FROM job_descriptions WHERE profile_id = ? ORDER BY created_at DESC').all(profile_id)

  const escape = v => `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`
  const headers = ['Company', 'Title', 'Status', 'URL', 'Notes', 'Date Added']
  const lines = [
    headers.join(','),
    ...rows.map(r => [
      escape(r.company),
      escape(r.title),
      escape(r.status || 'new'),
      escape(r.url),
      escape(r.notes),
      escape(r.created_at ? new Date(r.created_at * 1000).toLocaleDateString('en-CA') : '')
    ].join(','))
  ]

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="jobs.csv"')
  res.send(lines.join('\r\n'))
})

// Get all generations for a job
router.get('/:id/generations', (req, res) => {
  const rows = getDb().prepare('SELECT * FROM generations WHERE job_id = ? ORDER BY created_at DESC').all(req.params.id)
  res.json(rows)
})

module.exports = router
