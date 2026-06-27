const express = require('express')
const axios = require('axios')
const { v4: uuidv4 } = require('uuid')
const { getDb } = require('../db')
const { detectDuplicates } = require('../services/merger')

const router = express.Router()

// ── GitHub ────────────────────────────────────────────────────────────────────

router.post('/github', async (req, res) => {
  const { profile_id, token } = req.body
  if (!profile_id || !token) return res.status(400).json({ error: 'profile_id and token required' })

  try {
    const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' }

    // Get user info
    const { data: user } = await axios.get('https://api.github.com/user', { headers })

    // Get repos (non-fork, sorted by pushed)
    const { data: repos } = await axios.get(
      `https://api.github.com/user/repos?per_page=100&sort=pushed&type=owner`, { headers }
    )

    const db = getDb()

    // Update basics
    db.prepare(`
      INSERT INTO profile_basics (profile_id,full_name,github_url,updated_at)
      VALUES (?,?,?,unixepoch())
      ON CONFLICT(profile_id) DO UPDATE SET
        full_name=COALESCE(profile_basics.full_name, excluded.full_name),
        github_url=excluded.github_url,
        updated_at=unixepoch()
    `).run(profile_id, user.name || null, user.html_url)

    // Upsert repos as projects
    let imported = 0
    for (const repo of repos.filter(r => !r.fork)) {
      const existing = db.prepare('SELECT id FROM projects WHERE profile_id=? AND external_id=? AND source=?')
        .get(profile_id, String(repo.id), 'github')
      if (!existing) {
        const id = uuidv4()
        db.prepare(`INSERT INTO projects (id,profile_id,name,description,url,tech_stack,start_date,source,external_id)
          VALUES (?,?,?,?,?,?,?,?,?)`)
          .run(id, profile_id, repo.name, repo.description||null, repo.html_url,
               repo.language||null, repo.created_at?.slice(0,10)||null, 'github', String(repo.id))
        imported++
      }
    }

    // Extract languages as skills
    const langs = [...new Set(repos.filter(r => r.language).map(r => r.language))]
    for (const lang of langs) {
      const id = uuidv4()
      try { db.prepare('INSERT INTO skills (id,profile_id,name,category,source) VALUES (?,?,?,?,?)').run(id, profile_id, lang, 'Languages', 'github') } catch {}
    }

    res.json({
      success: true,
      username: user.login,
      repos_imported: imported,
      skills_added: langs.length
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── GitLab ────────────────────────────────────────────────────────────────────

router.post('/gitlab', async (req, res) => {
  const { profile_id, token, base_url } = req.body
  if (!profile_id || !token) return res.status(400).json({ error: 'profile_id and token required' })

  const base = (base_url || 'https://gitlab.com').replace(/\/$/, '')
  const headers = { 'PRIVATE-TOKEN': token }

  try {
    const { data: user } = await axios.get(`${base}/api/v4/user`, { headers })
    const { data: projects } = await axios.get(`${base}/api/v4/projects?membership=true&per_page=100&order_by=last_activity_at`, { headers })

    const db = getDb()

    db.prepare(`
      INSERT INTO profile_basics (profile_id,full_name,gitlab_url,updated_at)
      VALUES (?,?,?,unixepoch())
      ON CONFLICT(profile_id) DO UPDATE SET
        full_name=COALESCE(profile_basics.full_name, excluded.full_name),
        gitlab_url=excluded.gitlab_url, updated_at=unixepoch()
    `).run(profile_id, user.name||null, `${base}/${user.username}`)

    let imported = 0
    for (const proj of projects) {
      const existing = db.prepare('SELECT id FROM projects WHERE profile_id=? AND external_id=? AND source=?')
        .get(profile_id, String(proj.id), 'gitlab')
      if (!existing) {
        const id = uuidv4()
        db.prepare(`INSERT INTO projects (id,profile_id,name,description,url,source,external_id) VALUES (?,?,?,?,?,?,?)`)
          .run(id, profile_id, proj.name, proj.description||null, proj.web_url, 'gitlab', String(proj.id))
        imported++
      }
    }

    res.json({ success: true, username: user.username, projects_imported: imported })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── LinkedIn data export ──────────────────────────────────────────────────────

const multer = require('multer')
const path = require('path')
const AdmZip = require('adm-zip')
const { parseCsv } = require('../services/fileParser')

const upload = multer({ dest: path.join(__dirname, '..', 'uploads', 'tmp') })

router.post('/linkedin', upload.single('file'), async (req, res) => {
  const { profile_id } = req.body
  if (!profile_id || !req.file) return res.status(400).json({ error: 'profile_id and file required' })

  try {
    const zip = new AdmZip(req.file.path)
    const entries = zip.getEntries()

    const db = getDb()
    const result = { experiences: 0, education: 0, skills: 0, certifications: 0, skipped: 0 }

    for (const entry of entries) {
      const name = entry.entryName.replace(/^.*[/\\]/, '')
      const content = entry.getData().toString('utf8')

      if (name === 'Positions.csv') {
        const rows = await parseCsv(content)
        for (const row of rows) {
          const exp = {
            company:    row['Company Name'] || row.Company || 'Unknown',
            title:      row['Title'] || row.Position || 'Unknown',
            location:   row['Location'] || null,
            start_date: row['Started On'] || null,
            end_date:   row['Finished On'] || null,
            description: row['Description'] || null,
          }
          // Skip if similar experience already exists
          const dupes = detectDuplicates(profile_id, [exp])
          if (dupes.length > 0) { result.skipped++; continue }
          const id = uuidv4()
          try {
            db.prepare(`INSERT INTO experiences (id,profile_id,company,title,location,start_date,end_date,description,source)
              VALUES (?,?,?,?,?,?,?,?,?)`)
              .run(id, profile_id, exp.company, exp.title, exp.location, exp.start_date, exp.end_date, exp.description, 'linkedin')
            result.experiences++
          } catch {}
        }
      }

      if (name === 'Education.csv') {
        const rows = await parseCsv(content)
        for (const row of rows) {
          const institution = row['School Name'] || 'Unknown'
          const exists = db.prepare('SELECT id FROM education WHERE profile_id=? AND LOWER(institution)=LOWER(?)').get(profile_id, institution)
          if (exists) { result.skipped++; continue }
          const id = uuidv4()
          try {
            db.prepare(`INSERT INTO education (id,profile_id,institution,degree,field,start_date,end_date,notes,source) VALUES (?,?,?,?,?,?,?,?,?)`)
              .run(id, profile_id, institution, row['Degree Name']||null, row['Field Of Study']||null,
                   row['Start Date']||null, row['End Date']||null, row['Notes']||null, 'linkedin')
            result.education++
          } catch {}
        }
      }

      if (name === 'Skills.csv') {
        const rows = await parseCsv(content)
        for (const row of rows) {
          const skillName = row['Name'] || row.Skill
          if (!skillName) continue
          const id = uuidv4()
          try { db.prepare('INSERT INTO skills (id,profile_id,name,source) VALUES (?,?,?,?)').run(id, profile_id, skillName, 'linkedin'); result.skills++ } catch {}
        }
      }

      if (name === 'Certifications.csv') {
        const rows = await parseCsv(content)
        for (const row of rows) {
          const certName = row['Name'] || 'Unknown'
          const exists = db.prepare('SELECT id FROM certifications WHERE profile_id=? AND LOWER(name)=LOWER(?)').get(profile_id, certName)
          if (exists) { result.skipped++; continue }
          const id = uuidv4()
          try {
            db.prepare(`INSERT INTO certifications (id,profile_id,name,issuer,issued_date,url,source) VALUES (?,?,?,?,?,?,?)`)
              .run(id, profile_id, certName, row['Authority']||null, row['Started On']||null, row['Url']||null, 'linkedin')
            result.certifications++
          } catch {}
        }
      }
    }

    // Cleanup tmp file
    try { require('fs').unlinkSync(req.file.path) } catch {}

    res.json({ success: true, imported: result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
