const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { getDb } = require('../db')
const { confirmMerge, detectDuplicates, experienceSimilarity } = require('../services/merger')
const { callAI } = require('../services/aiService')

const router = express.Router()

// ── Experiences ───────────────────────────────────────────────────────────────

router.get('/', (req, res) => {
  const { profile_id } = req.query
  if (!profile_id) return res.status(400).json({ error: 'profile_id required' })
  const rows = getDb().prepare(`
    SELECT * FROM experiences WHERE profile_id = ?
    ORDER BY CASE WHEN is_current=1 THEN 0 ELSE 1 END, end_date DESC, start_date DESC
  `).all(profile_id)
  res.json(rows)
})

router.post('/', (req, res) => {
  const { profile_id, company, title, location, start_date, end_date, is_current, description, achievements, source } = req.body
  if (!profile_id || !company || !title) return res.status(400).json({ error: 'profile_id, company, title required' })
  const id = uuidv4()
  getDb().prepare(`
    INSERT INTO experiences (id,profile_id,company,title,location,start_date,end_date,is_current,description,achievements,source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, profile_id, company, title, location||null, start_date||null, end_date||null, is_current?1:0,
         description||null, achievements||null, source||'manual')
  res.json({ id })
})

router.put('/:id', (req, res) => {
  const { company, title, location, start_date, end_date, is_current, description, achievements } = req.body
  getDb().prepare(`
    UPDATE experiences SET company=?,title=?,location=?,start_date=?,end_date=?,is_current=?,description=?,achievements=?
    WHERE id=?
  `).run(company, title, location||null, start_date||null, end_date||null, is_current?1:0,
         description||null, achievements||null, req.params.id)
  res.json({ success: true })
})

router.delete('/:id', (req, res) => {
  getDb().prepare('DELETE FROM experiences WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// Polish bullets: deduplicate and improve wording without adding new facts
router.post('/:id/polish', async (req, res) => {
  const exp = getDb().prepare('SELECT * FROM experiences WHERE id = ?').get(req.params.id)
  if (!exp) return res.status(404).json({ error: 'Not found' })

  const allBullets = [
    ...(exp.description || '').split('\n'),
    ...(exp.achievements || '').split('\n'),
  ].map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)

  if (allBullets.length === 0) return res.json({ bullets: [] })

  const prompt = `You are editing resume bullet points for a single job role.

Role: ${exp.title} at ${exp.company}

Here are all the bullet points collected for this role:
${allBullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}

Your task:
1. ONLY remove a bullet if it is essentially identical in meaning to another bullet — if two bullets say almost exactly the same thing in different words, keep the better-worded one
2. ONLY merge two bullets if they describe the exact same specific activity — do NOT merge bullets just because they share a broad theme (e.g. "SQL for troubleshooting" and "SQL for one-time scripts" are different activities — keep both)
3. Keep every bullet that describes a distinct activity, skill, or responsibility — when in doubt, keep it
4. Improve wording on kept bullets to be concise and action-verb-led, under 25 words each
5. Do NOT drop a bullet just to reduce the count — only drop true duplicates
6. Do NOT invent new facts, technologies, or outcomes not in the originals
7. Return ONLY the final bullet list, one per line, each starting with •
8. No introduction, no explanation, no extra text — bullets only`

  try {
    const raw = await callAI(prompt, { temperature: 0.3, max_tokens: 6000 })
    const bullets = raw.split('\n')
      .map(l => l.replace(/^[-•*]\s*/, '').trim())
      .filter(Boolean)
    res.json({ original: allBullets, bullets })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Confirm a merge: keep chosen bullets, delete the duplicate
router.post('/merge', (req, res) => {
  const { keep_id, discard_id, merged_achievements, merged_description } = req.body
  confirmMerge({ keep_id, discard_id, merged_achievements, merged_description })
  res.json({ success: true })
})

// Scan all experiences for this profile and return similar pairs
router.get('/find-duplicates', (req, res) => {
  const { profile_id } = req.query
  if (!profile_id) return res.status(400).json({ error: 'profile_id required' })

  const all = getDb().prepare('SELECT * FROM experiences WHERE profile_id = ?').all(profile_id)
  const pairs = []
  const seen = new Set()

  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const score = experienceSimilarity(all[i], all[j])
      if (score >= 0.65) {
        const key = [all[i].id, all[j].id].sort().join('-')
        if (!seen.has(key)) {
          seen.add(key)
          pairs.push({ score: Math.round(score * 100), a: all[i], b: all[j] })
        }
      }
    }
  }

  res.json({ pairs: pairs.sort((x, y) => y.score - x.score) })
})

// ── Education ─────────────────────────────────────────────────────────────────

router.get('/education', (req, res) => {
  const { profile_id } = req.query
  if (!profile_id) return res.status(400).json({ error: 'profile_id required' })
  const rows = getDb().prepare('SELECT * FROM education WHERE profile_id = ? ORDER BY end_date DESC').all(profile_id)
  res.json(rows)
})

router.post('/education', (req, res) => {
  const { profile_id, institution, degree, field, start_date, end_date, gpa, notes, source } = req.body
  if (!profile_id || !institution) return res.status(400).json({ error: 'profile_id, institution required' })
  const id = uuidv4()
  getDb().prepare(`
    INSERT INTO education (id,profile_id,institution,degree,field,start_date,end_date,gpa,notes,source)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(id, profile_id, institution, degree||null, field||null, start_date||null, end_date||null, gpa||null, notes||null, source||'manual')
  res.json({ id })
})

router.put('/education/:id', (req, res) => {
  const { institution, degree, field, start_date, end_date, gpa, notes } = req.body
  getDb().prepare(`
    UPDATE education SET institution=?,degree=?,field=?,start_date=?,end_date=?,gpa=?,notes=? WHERE id=?
  `).run(institution, degree||null, field||null, start_date||null, end_date||null, gpa||null, notes||null, req.params.id)
  res.json({ success: true })
})

router.delete('/education/:id', (req, res) => {
  getDb().prepare('DELETE FROM education WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// ── Skills ────────────────────────────────────────────────────────────────────

router.get('/skills', (req, res) => {
  const { profile_id } = req.query
  if (!profile_id) return res.status(400).json({ error: 'profile_id required' })
  const rows = getDb().prepare('SELECT * FROM skills WHERE profile_id = ? ORDER BY category, name').all(profile_id)
  res.json(rows)
})

router.post('/skills', (req, res) => {
  const { profile_id, name, category, source } = req.body
  if (!profile_id || !name) return res.status(400).json({ error: 'profile_id, name required' })
  const id = uuidv4()
  try {
    getDb().prepare('INSERT INTO skills (id,profile_id,name,category,source) VALUES (?,?,?,?,?)').run(id, profile_id, name, category||null, source||'manual')
    res.json({ id })
  } catch {
    res.status(409).json({ error: 'Skill already exists' })
  }
})

router.delete('/skills/:id', (req, res) => {
  getDb().prepare('DELETE FROM skills WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// ── Certifications ────────────────────────────────────────────────────────────

router.get('/certifications', (req, res) => {
  const { profile_id } = req.query
  if (!profile_id) return res.status(400).json({ error: 'profile_id required' })
  const rows = getDb().prepare('SELECT * FROM certifications WHERE profile_id = ? ORDER BY issued_date DESC').all(profile_id)
  res.json(rows)
})

router.post('/certifications', (req, res) => {
  const { profile_id, name, issuer, issued_date, expiry_date, url, source } = req.body
  if (!profile_id || !name) return res.status(400).json({ error: 'profile_id, name required' })
  const id = uuidv4()
  getDb().prepare(`INSERT INTO certifications (id,profile_id,name,issuer,issued_date,expiry_date,url,source) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, profile_id, name, issuer||null, issued_date||null, expiry_date||null, url||null, source||'manual')
  res.json({ id })
})

router.delete('/certifications/:id', (req, res) => {
  getDb().prepare('DELETE FROM certifications WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// ── Projects ──────────────────────────────────────────────────────────────────

router.get('/projects', (req, res) => {
  const { profile_id } = req.query
  if (!profile_id) return res.status(400).json({ error: 'profile_id required' })
  const rows = getDb().prepare('SELECT * FROM projects WHERE profile_id = ? ORDER BY start_date DESC').all(profile_id)
  res.json(rows)
})

router.post('/projects', (req, res) => {
  const { profile_id, name, description, url, tech_stack, start_date, end_date, source } = req.body
  if (!profile_id || !name) return res.status(400).json({ error: 'profile_id, name required' })
  const id = uuidv4()
  getDb().prepare(`INSERT INTO projects (id,profile_id,name,description,url,tech_stack,start_date,end_date,source) VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(id, profile_id, name, description||null, url||null, tech_stack||null, start_date||null, end_date||null, source||'manual')
  res.json({ id })
})

router.put('/projects/:id', (req, res) => {
  const { name, description, url, tech_stack, start_date, end_date } = req.body
  getDb().prepare(`UPDATE projects SET name=?,description=?,url=?,tech_stack=?,start_date=?,end_date=? WHERE id=?`)
    .run(name, description||null, url||null, tech_stack||null, start_date||null, end_date||null, req.params.id)
  res.json({ success: true })
})

router.delete('/projects/:id', (req, res) => {
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// Bulk import from extraction (after upload)
router.post('/import', (req, res) => {
  const { profile_id, data, source } = req.body
  if (!profile_id || !data) return res.status(400).json({ error: 'profile_id and data required' })

  const db = getDb()
  const importedIds = { experiences: [], education: [], skills: [], certifications: [], projects: [] }

  const src = source || 'document'

  if (data.experiences) {
    for (const exp of data.experiences) {
      const id = uuidv4()
      db.prepare(`INSERT INTO experiences (id,profile_id,company,title,location,start_date,end_date,is_current,description,achievements,source) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, profile_id, exp.company||'Unknown', exp.title||'Unknown', exp.location||null,
             exp.start_date||null, exp.end_date||null, exp.is_current?1:0,
             exp.description||null, exp.achievements||null, src)
      importedIds.experiences.push(id)
    }
  }

  if (data.education) {
    for (const edu of data.education) {
      const institution = edu.institution || 'Unknown'
      const exists = db.prepare(
        'SELECT id FROM education WHERE profile_id = ? AND LOWER(institution) = LOWER(?)'
      ).get(profile_id, institution)
      if (exists) continue  // skip duplicate
      const id = uuidv4()
      db.prepare(`INSERT INTO education (id,profile_id,institution,degree,field,start_date,end_date,gpa,source) VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(id, profile_id, institution, edu.degree||null, edu.field||null,
             edu.start_date||null, edu.end_date||null, edu.gpa||null, src)
      importedIds.education.push(id)
    }
  }

  if (data.skills) {
    for (const skill of data.skills) {
      const id = uuidv4()
      try {
        db.prepare('INSERT INTO skills (id,profile_id,name,category,source) VALUES (?,?,?,?,?)').run(id, profile_id, skill.name, skill.category||null, src)
        importedIds.skills.push(id)
      } catch {}
    }
  }

  if (data.certifications) {
    for (const cert of data.certifications) {
      const exists = db.prepare(
        'SELECT id FROM certifications WHERE profile_id = ? AND LOWER(name) = LOWER(?)'
      ).get(profile_id, cert.name)
      if (exists) continue
      const id = uuidv4()
      db.prepare(`INSERT INTO certifications (id,profile_id,name,issuer,issued_date,source) VALUES (?,?,?,?,?,?)`)
        .run(id, profile_id, cert.name, cert.issuer||null, cert.issued_date||null, src)
      importedIds.certifications.push(id)
    }
  }

  if (data.projects) {
    for (const proj of data.projects) {
      const exists = db.prepare(
        'SELECT id FROM projects WHERE profile_id = ? AND LOWER(name) = LOWER(?)'
      ).get(profile_id, proj.name)
      if (exists) continue
      const id = uuidv4()
      db.prepare(`INSERT INTO projects (id,profile_id,name,description,url,tech_stack,source) VALUES (?,?,?,?,?,?,?)`)
        .run(id, profile_id, proj.name, proj.description||null, proj.url||null, proj.tech_stack||null, src)
      importedIds.projects.push(id)
    }
  }

  res.json({ success: true, importedIds })
})

module.exports = router
