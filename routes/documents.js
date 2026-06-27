const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const { getDb } = require('../db')
const { parseFile } = require('../services/fileParser')
const { extractProfileFromText } = require('../services/profileExtractor')
const { extractBasics } = require('../services/basicExtractor')
const { detectDuplicates } = require('../services/merger')

const router = express.Router()

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`)
})
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } })

// ── helpers ───────────────────────────────────────────────────────────────────

function applyBasicsToProfile(profile_id, basics) {
  if (!basics) return
  const db = getDb()
  const existing = db.prepare('SELECT * FROM profile_basics WHERE profile_id = ?').get(profile_id)
  if (!existing) {
    db.prepare(`
      INSERT INTO profile_basics (profile_id,full_name,email,phone,location,linkedin_url,github_url,gitlab_url,website,summary,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,unixepoch())
    `).run(profile_id,
      basics.full_name||null, basics.email||null, basics.phone||null, basics.location||null,
      basics.linkedin_url||null, basics.github_url||null, basics.gitlab_url||null,
      basics.website||null, basics.summary||null)
  } else {
    const fields = ['full_name','email','phone','location','linkedin_url','github_url','gitlab_url','website','summary']
    const updates = [], vals = []
    for (const f of fields) {
      if (!existing[f] && basics[f]) { updates.push(`${f}=?`); vals.push(basics[f]) }
    }
    if (updates.length) {
      vals.push(profile_id)
      db.prepare(`UPDATE profile_basics SET ${updates.join(',')},updated_at=unixepoch() WHERE profile_id=?`).run(...vals)
    }
  }
}

// ── routes ────────────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const { profile_id } = req.query
  if (!profile_id) return res.status(400).json({ error: 'profile_id required' })
  const docs = getDb().prepare('SELECT * FROM documents WHERE profile_id = ? ORDER BY created_at DESC').all(profile_id)
  res.json(docs)
})

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { profile_id, type, label } = req.body
    if (!profile_id || !type || !req.file) return res.status(400).json({ error: 'profile_id, type, and file are required' })

    const rawText = await parseFile(req.file.path, req.file.originalname)
    const docId = uuidv4()

    getDb().prepare(`
      INSERT INTO documents (id, profile_id, type, label, original_name, file_path, raw_text)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(docId, profile_id, type, label || null, req.file.originalname, req.file.path, rawText)

    let extracted = null
    let duplicates = []
    let aiUsed = false
    let basicsFilled = false

    if (type === 'resume') {
      // Step 1: always run regex extractor for basics (no AI needed)
      const regexBasics = extractBasics(rawText)
      applyBasicsToProfile(profile_id, regexBasics)
      basicsFilled = !!(regexBasics.full_name || regexBasics.email)

      // Step 2: try AI extraction for full structured data
      try {
        extracted = await extractProfileFromText(rawText, profile_id)
        if (extracted) {
          aiUsed = true
          // AI basics may be richer — fill in remaining empty fields
          if (extracted.basics) applyBasicsToProfile(profile_id, extracted.basics)
          if (extracted.experiences?.length) {
            duplicates = detectDuplicates(profile_id, extracted.experiences)
          }
        }
      } catch (e) {
        console.warn('AI extraction failed:', e.message)
      }
    }

    res.json({ id: docId, rawText, extracted, duplicates, aiUsed, basicsFilled })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// Re-process a document with AI (call after configuring AI in Settings)
router.post('/:id/reprocess', async (req, res) => {
  const doc = getDb().prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Document not found' })
  if (!doc.raw_text) return res.status(400).json({ error: 'No text content to re-process' })

  try {
    const extracted = await extractProfileFromText(doc.raw_text, doc.profile_id)
    let duplicates = []
    if (extracted) {
      if (extracted.basics) applyBasicsToProfile(doc.profile_id, extracted.basics)
      if (extracted.experiences?.length) {
        duplicates = detectDuplicates(doc.profile_id, extracted.experiences)
      }
    }
    res.json({ extracted, duplicates, aiUsed: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.patch('/:id/set-template', (req, res) => {
  const { profile_id } = req.body
  const db = getDb()
  const doc = db.prepare('SELECT type FROM documents WHERE id = ?').get(req.params.id)
  if (doc) {
    // Clear existing template flag only for the same document type
    db.prepare('UPDATE documents SET is_template = 0 WHERE profile_id = ? AND type = ?').run(profile_id, doc.type)
  }
  db.prepare('UPDATE documents SET is_template = 1 WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

router.delete('/:id', (req, res) => {
  const doc = getDb().prepare('SELECT file_path FROM documents WHERE id = ?').get(req.params.id)
  if (doc) {
    getDb().prepare('DELETE FROM documents WHERE id = ?').run(req.params.id)
    try { fs.unlinkSync(doc.file_path) } catch {}
  }
  res.json({ success: true })
})

router.get('/:id/text', (req, res) => {
  const doc = getDb().prepare('SELECT raw_text, original_name FROM documents WHERE id = ?').get(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Not found' })
  res.json(doc)
})

module.exports = router
