const express = require('express')
const { v4: uuidv4 } = require('uuid')
const path = require('path')
const fs = require('fs')
const { getDb } = require('../db')
const { buildContext } = require('../services/contextBuilder')
const { callAI } = require('../services/aiService')
const { generateDocx, generateCoverLetterDocx } = require('../services/docxGenerator')
const { generateLatex } = require('../services/latexGenerator')

const router = express.Router()

const OUTPUT_DIR = path.join(__dirname, '..', 'outputs')
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

router.post('/', async (req, res) => {
  const { profile_id, job_id, options = {} } = req.body
  if (!profile_id || !job_id) return res.status(400).json({ error: 'profile_id and job_id required' })

  const db = getDb()
  const job = db.prepare('SELECT * FROM job_descriptions WHERE id = ?').get(job_id)
  if (!job) return res.status(404).json({ error: 'Job not found' })

  const genId = uuidv4()
  db.prepare(`INSERT INTO generations (id,job_id,profile_id) VALUES (?,?,?)`).run(genId, job_id, profile_id)

  try {
    const context = buildContext(profile_id)

    // Existing resume doc — used as layout/structure reference
    const resumeDoc = db.prepare(`
      SELECT raw_text FROM documents
      WHERE profile_id = ? AND type = 'resume'
      ORDER BY is_template DESC, created_at DESC LIMIT 1
    `).get(profile_id)
    const existingResume = resumeDoc?.raw_text || null

    // LaTeX template if one exists
    const templateDoc = db.prepare(`
      SELECT raw_text FROM documents
      WHERE profile_id = ? AND type = 'template' AND (original_name LIKE '%.tex' OR original_name LIKE '%.txt')
      ORDER BY is_template DESC, created_at DESC LIMIT 1
    `).get(profile_id)
    const templateTex = templateDoc?.raw_text || null

    // Cover letter template — prefer is_template=1, fall back to most recent cover letter
    const clTemplateDoc = db.prepare(`
      SELECT raw_text FROM documents
      WHERE profile_id = ? AND type = 'cover_letter'
      ORDER BY is_template DESC, created_at DESC LIMIT 1
    `).get(profile_id)
    const coverLetterTemplate = clTemplateDoc?.raw_text || null

    const prompt = buildPrompt(context, job, existingResume, templateTex, coverLetterTemplate, options)
    const aiResult = await callAI(prompt, { max_tokens: 6000 })

    const { resumeMd, coverLetterMd, latexFromAI } = parseAIResponse(aiResult)

    // LaTeX: use AI-filled template if provided, else auto-generate
    const latexContent = latexFromAI || generateLatex(resumeMd, context.basics)

    // DOCX
    const docxPath = path.join(OUTPUT_DIR, `${genId}_resume.docx`)
    await generateDocx(resumeMd, context.basics, docxPath, options.template_style)

    const clDocxPath = path.join(OUTPUT_DIR, `${genId}_cover_letter.docx`)
    const clFn = typeof generateCoverLetterDocx === 'function' ? generateCoverLetterDocx : generateDocx
    await clFn(coverLetterMd, context.basics, clDocxPath, 'letter')

    // Save LaTeX
    const texPath = path.join(OUTPUT_DIR, `${genId}_resume.tex`)
    fs.writeFileSync(texPath, latexContent, 'utf8')

    db.prepare(`UPDATE generations SET resume_md=?,cover_letter_md=?,resume_latex=? WHERE id=?`)
      .run(resumeMd, coverLetterMd, latexContent, genId)

    res.json({
      id: genId,
      resume_md: resumeMd,
      cover_letter_md: coverLetterMd,
      resume_latex: latexContent,
      used_template: !!latexFromAI,
      used_cl_template: !!coverLetterTemplate,
      downloads: {
        docx: `/api/generate/${genId}/download/docx`,
        tex:  `/api/generate/${genId}/download/tex`,
        cover_letter_docx: `/api/generate/${genId}/download/cover-letter-docx`
      }
    })
  } catch (err) {
    console.error('Generation error:', err)
    db.prepare(`UPDATE generations SET resume_md='ERROR' WHERE id=?`).run(genId)
    res.status(500).json({ error: err.message })
  }
})

// Download endpoints
router.get('/:id/download/docx', (req, res) => {
  const f = path.join(OUTPUT_DIR, `${req.params.id}_resume.docx`)
  if (!fs.existsSync(f)) return res.status(404).json({ error: 'Not found' })
  res.download(f, 'resume.docx')
})

router.get('/:id/download/cover-letter-docx', (req, res) => {
  const f = path.join(OUTPUT_DIR, `${req.params.id}_cover_letter.docx`)
  if (!fs.existsSync(f)) return res.status(404).json({ error: 'Not found' })
  res.download(f, 'cover_letter.docx')
})

router.get('/:id/download/tex', (req, res) => {
  const f = path.join(OUTPUT_DIR, `${req.params.id}_resume.tex`)
  if (!fs.existsSync(f)) return res.status(404).json({ error: 'Not found' })
  res.download(f, 'resume.tex')
})

router.delete('/:id', (req, res) => {
  const db = getDb()
  const gen = db.prepare('SELECT * FROM generations WHERE id = ?').get(req.params.id)
  if (!gen) return res.status(404).json({ error: 'Not found' })
  db.prepare('DELETE FROM generations WHERE id = ?').run(req.params.id)
  // Clean up output files
  for (const suffix of ['_resume.docx', '_cover_letter.docx', '_resume.tex']) {
    try { fs.unlinkSync(path.join(OUTPUT_DIR, `${req.params.id}${suffix}`)) } catch {}
  }
  res.json({ success: true })
})

router.get('/', (req, res) => {
  const { profile_id } = req.query
  if (!profile_id) return res.status(400).json({ error: 'profile_id required' })
  const rows = getDb().prepare(`
    SELECT g.*, j.company, j.title as job_title
    FROM generations g
    LEFT JOIN job_descriptions j ON j.id = g.job_id
    WHERE g.profile_id = ?
    ORDER BY g.created_at DESC
  `).all(profile_id)
  res.json(rows)
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPrompt(context, job, existingResume, templateTex, coverLetterTemplate, options = {}) {
  const { basics, experiences, education, skills, certifications, projects } = context
  const { selected_exp_ids, include_certs, include_projects } = options

  // Filter experiences by user selection and exclude target company
  const targetCompany = (job.company || '').trim().toLowerCase()
  const selectedSet = selected_exp_ids?.length ? new Set(selected_exp_ids) : null
  const filteredExp = experiences.filter(e => {
    if (targetCompany && (e.company || '').trim().toLowerCase() === targetCompany) return false
    if (selectedSet && !selectedSet.has(e.id)) return false
    return true
  })

  // Group roles by company, most recent first
  const companyOrder = []
  const companyMap = new Map()
  for (const e of filteredExp) {
    const key = (e.company || '').trim().toLowerCase()
    if (!companyMap.has(key)) {
      companyMap.set(key, { company: e.company || '', location: e.location || '', roles: [] })
      companyOrder.push(key)
    }
    companyMap.get(key).roles.push(e)
  }

  const profileText = companyOrder.length
    ? companyOrder.map(key => {
        const { company, location, roles } = companyMap.get(key)
        return roles.map(e => {
          const lines = [
            `${company}${location ? ` — ${location}` : ''}`,
            `${e.title} | ${e.start_date || '?'} – ${e.is_current ? 'Present' : e.end_date || '?'}`,
          ]
          const bullets = [
            ...(e.description || '').split('\n').filter(Boolean),
            ...(e.achievements || '').split('\n').filter(Boolean),
          ]
          bullets.forEach(b => lines.push(`• ${b.replace(/^[-•*]\s*/, '')}`))
          return lines.join('\n')
        }).join('\n\n')
      }).join('\n\n---\n\n')
    : 'None on file.'

  const eduText = education.length
    ? education.map(e => `${[e.degree, e.field].filter(Boolean).join(' in ')} — ${e.institution}${e.end_date ? ` (${e.end_date})` : ''}`).join('\n')
    : 'None on file.'

  const skillsByCategory = {}
  for (const s of skills) {
    const cat = s.category || 'Other'
    if (!skillsByCategory[cat]) skillsByCategory[cat] = []
    skillsByCategory[cat].push(s.name)
  }
  const skillsText = Object.entries(skillsByCategory).map(([cat, names]) => `${cat}: ${names.join(', ')}`).join('\n') || 'None on file.'

  const certsText = include_certs ? certifications.map(c => `• ${c.name}${c.issuer ? ` (${c.issuer})` : ''}`).join('\n') : ''
  const projText  = include_projects ? projects.map(p => `• ${p.name}${p.description ? `: ${p.description}` : ''}${p.tech_stack ? ` [${p.tech_stack}]` : ''}`).join('\n') : ''

  const today = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })

  const latexSection = templateTex
    ? `\n\n=== LATEX TEMPLATE (fill this for the ---LATEX--- section) ===
After the resume and cover letter, produce a filled version of this exact LaTeX template tailored for this job.

Rules — read carefully:
- Do NOT change any \\usepackage, \\documentclass, \\geometry, \\definecolor, \\titleformat, \\titlespacing, \\setlist, \\pagestyle, or any preamble command — copy them verbatim
- Do NOT change fonts, margins, colors, or spacing — the visual format must be pixel-identical to the template
- Only replace the content inside \\begin{document}...\\end{document}
- Keep the same section structure (Education, Summary of Skills, Professional Experience) and LaTeX markup patterns (\\textbf{}, \\small\\textbf{}, \\hfill, \\begin{itemize}, etc.)
- Tailor the skills list and bullet points to this specific job posting — use the candidate's actual skills and experience from their profile
- For multiple roles at the same company, repeat the \\small\\textbf{} role line pattern exactly as shown in the template (no new \\textbf{Company} line — company appears once)
- Escape LaTeX special characters in all inserted text: & → \\&, % → \\%, # → \\#, $ → \\$, _ → \\_, { → \\{, } → \\}, ~ → \\textasciitilde{}, ^ → \\textasciicircum{}
- Output ONLY the complete raw .tex file — no code fences, no explanation, no markdown

LaTeX template:
${templateTex}`
    : ''

  const outputFormat = templateTex
    ? `---RESUME---\n[markdown resume]\n---COVER LETTER---\n[cover letter markdown]\n---LATEX---\n[filled LaTeX — raw only, no fences]\n---END---`
    : `---RESUME---\n[markdown resume]\n---COVER LETTER---\n[cover letter markdown]\n---END---`

  return `You are an expert resume and cover letter writer. I am providing you with the following materials:

${existingResume ? `=== MATERIAL 1: MY EXISTING RESUME (use as layout/structure/section template) ===
${existingResume.slice(0, 3000)}

` : ''}=== MATERIAL 2: MY FULL PROFILE (primary source — use ALL relevant detail from here) ===
Name: ${basics?.full_name || 'Candidate'}
Email: ${basics?.email || ''}  Phone: ${basics?.phone || ''}
Location: ${basics?.location || ''}
LinkedIn: ${basics?.linkedin_url || ''}  GitHub: ${basics?.github_url || ''}

EDUCATION:
${eduText}

WORK EXPERIENCE (use these bullet points as the source of truth for all claims):
${profileText}

SKILLS BY CATEGORY:
${skillsText}
${certsText ? `\nCERTIFICATIONS:\n${certsText}` : ''}
${projText  ? `\nPROJECTS:\n${projText}` : ''}

${coverLetterTemplate ? `=== MATERIAL 3: MY PREVIOUS COVER LETTER (reference for tone, voice, and style ONLY — do not reuse content unless directly relevant) ===
${coverLetterTemplate.slice(0, 3000)}

` : ''}=== MATERIAL 4: JOB POSTING ===
Company: ${job.company || 'Unknown'}
Role: ${job.title || 'Unknown'}

${job.raw_text || ''}
${latexSection}

===========================
RESUME INSTRUCTIONS:
===========================
${existingResume ? '- Keep the EXACT same structure, section order, and formatting as my existing resume — only replace the content' : '- Format: `# Name` header, then `_contact_` line, then sections using `## ` headings'}
- Derive the job title/seniority from the job posting
- Start with: \`# ${basics?.full_name || 'Candidate'}\`
- Contact line: \`_${[basics?.phone, basics?.email, basics?.location, basics?.linkedin_url].filter(Boolean).join(' · ')}_\`
- Section order: Education → Summary of Skills → Professional Experience${certsText ? ' → Certifications' : ''}${projText ? ' → Projects' : ''}
- Company header: \`### Company — Location\`  |  Role header: \`#### Job Title (Start – End)\`
- Only include the most recent and relevant roles — use the job posting to judge relevance
- Remove or condense anything that does not directly support this specific role
- **SKILLS SECTION — strict rule**: only list skills that appear verbatim in the "SKILLS BY CATEGORY" section of Material 2. Do NOT add, rename, or infer any skill from the job posting. Do NOT add skills like "SQL/T-SQL", "XML", "XSLT", "MapForce", or anything else that isn't explicitly listed in the candidate's profile. You may regroup or rename categories to better match the job posting, but every individual skill name must come from the profile's skills list.
- Keywords from the job posting may be woven naturally into bullet point descriptions only — never into the skills list
- Write achievement-focused bullet points; quantify where the profile data supports it
- Do NOT exceed one page — prioritise recency and relevance if cuts are needed
- Do NOT invent or exaggerate anything — only use what is in the profile above

===========================
COVER LETTER INSTRUCTIONS:
===========================
Use this exact header format:
\`# ${basics?.full_name || 'Candidate'}\`
\`_${[basics?.location, basics?.phone].filter(Boolean).join('  ')}_\`
\`_${[basics?.linkedin_url, basics?.email].filter(Boolean).join('  ')}_\`

${job.company || 'Company Name'}
[City, Province — from job posting]

${today}

Dear Hiring Manager,

- **Para 1**: State degree, years of experience, and the specific role. Then immediately connect to why this company and mission matter — make it personal and specific, not generic.
- **Para 2**: Map current role experience directly to a specific requirement in the job posting. Pull concrete facts from the bullet points in Material 2 — name the employer, name what you actually built or did. No vague summaries.
- **Para 3**: Map a previous role to another specific requirement. Again cite real bullet-point facts. The reader should be able to verify these against a resume.
- **Para 4**: Explain why THIS company specifically — their product, mission, industry, or values from the job posting. This paragraph is about them, not you. No skill lists here.
- **Para 5 / Close**: Brief warm thank-you, clear call to action, include ${basics?.phone || 'phone'} and ${basics?.email || 'email'}.

Sincerely,

${basics?.full_name || 'Candidate'}

- Keep it to 4–5 paragraphs, under 450 words
- Tone: match the tone of the job posting (formal if formal, modern if casual)
- ${coverLetterTemplate ? 'Mirror my previous cover letter\'s sentence structure, pacing, and voice — write as if the same person wrote both' : 'Write in a professional, direct, confident but genuine tone'}
- No filler sentences — every line must serve a purpose
- Do NOT write: "I am excited/confident/impressed", "utilize", "I look forward to discussing my application", "ideal candidate", "make me a great fit", "passionate about", "I believe I can", "my background spans", "the technical profile of this role"
- Proof rule: every claim about the candidate's abilities must reference a specific fact from their profile bullets — not "I have SQL experience" but "at Rentsync I perform SQL-based data profiling and cleansing daily across live production environments"

===========================
GENERAL RULES:
===========================
- Do not invent, embellish, or assume any experience not in the materials above
- Only use the most recent and relevant roles
- The resume and cover letter should feel cohesive — same person, same voice, same story
- Previous cover letter is style reference only — do not reuse its content unless directly relevant

Respond with EXACTLY this structure — no extra text before or after:

${outputFormat}`
}

function parseAIResponse(text) {
  // Flexible delimiters: case-insensitive, optional spaces around dashes
  const D = (name) => new RegExp(`-{2,}\\s*${name}\\s*-{2,}`, 'i')

  const resumeSplit  = text.split(D('RESUME'))
  const clSplit      = text.split(D('COVER[\\s_]LETTER'))
  const latexSplit   = text.split(D('LATEX'))
  const endSplit     = text.split(D('END'))

  let resumeMd = ''
  let coverLetterMd = ''
  let latexFromAI = null

  if (resumeSplit.length >= 2) {
    // Everything between ---RESUME--- and ---COVER LETTER--- (or ---END--- if no CL)
    const afterResume = resumeSplit[1]
    const beforeCL = afterResume.split(D('COVER[\\s_]LETTER'))[0]
    resumeMd = beforeCL.trim()
  } else {
    resumeMd = text.trim()
  }

  if (clSplit.length >= 2) {
    const afterCL = clSplit[1]
    // Stop at ---LATEX--- or ---END---
    const beforeLatexOrEnd = afterCL.split(D('(?:LATEX|END)'))[0]
    coverLetterMd = beforeLatexOrEnd.trim()
  }

  if (latexSplit.length >= 2) {
    const afterLatex = latexSplit[1]
    const beforeEnd = afterLatex.split(D('END'))[0]
    latexFromAI = beforeEnd.trim() || null
  }

  // If AI ignored the cover letter delimiter entirely, try to detect it by content
  if (!coverLetterMd && resumeMd) {
    const dearIdx = resumeMd.search(/\bDear\b/i)
    if (dearIdx > 100) {
      // Looks like cover letter was appended after resume without delimiter
      coverLetterMd = resumeMd.slice(dearIdx).trim()
      resumeMd = resumeMd.slice(0, dearIdx).trim()
    }
  }

  return { resumeMd, coverLetterMd, latexFromAI }
}

module.exports = router
