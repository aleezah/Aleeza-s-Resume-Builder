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

    const { resumeMd, coverLetterMd, latexFromAI } = parseAIResponse(aiResult.text)

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

    db.prepare(`UPDATE generations SET resume_md=?,cover_letter_md=?,resume_latex=?,ai_provider=?,prompt_tokens=?,completion_tokens=? WHERE id=?`)
      .run(resumeMd, coverLetterMd, latexContent, aiResult.provider, aiResult.prompt_tokens, aiResult.completion_tokens, genId)

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

// ── Interview question generation ─────────────────────────────────────────────

router.post('/interview', async (req, res) => {
  const { profile_id, job_id, job_only = false } = req.body
  if (!profile_id || !job_id) return res.status(400).json({ error: 'profile_id and job_id required' })

  const db = getDb()
  const job = db.prepare('SELECT * FROM job_descriptions WHERE id = ?').get(job_id)
  if (!job) return res.status(404).json({ error: 'Job not found' })

  try {
    const context = buildContext(profile_id)
    const prompt = buildInterviewPrompt(context, job, job_only)
    const aiResult = await callAI(prompt, { max_tokens: 4000 })
    const questions = parseInterviewResponse(aiResult.text)

    const id = uuidv4()
    db.prepare(`
      INSERT INTO interview_preps (id, profile_id, job_id, job_title, job_company, questions, job_only)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, profile_id, job_id, job.title || '', job.company || '', JSON.stringify(questions), job_only ? 1 : 0)

    res.json({ id, questions, job: { company: job.company, title: job.title }, job_only })
  } catch (err) {
    console.error('Interview generation error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.get('/interview', (req, res) => {
  const { profile_id } = req.query
  if (!profile_id) return res.status(400).json({ error: 'profile_id required' })
  const rows = getDb().prepare(`
    SELECT id, job_id, job_title, job_company, job_only, created_at,
           length(questions) as q_size
    FROM interview_preps WHERE profile_id = ?
    ORDER BY created_at DESC
  `).all(profile_id)
  res.json(rows)
})

router.get('/interview/:id', (req, res) => {
  const row = getDb().prepare('SELECT * FROM interview_preps WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })
  res.json({ ...row, questions: JSON.parse(row.questions) })
})

router.delete('/interview/:id', (req, res) => {
  getDb().prepare('DELETE FROM interview_preps WHERE id = ?').run(req.params.id)
  res.json({ success: true })
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

router.get('/usage', (req, res) => {
  const db = getDb()
  const rows = db.prepare(`
    SELECT ai_provider,
           COUNT(*) as generations,
           SUM(COALESCE(prompt_tokens, 0)) as prompt_tokens,
           SUM(COALESCE(completion_tokens, 0)) as completion_tokens
    FROM generations
    GROUP BY ai_provider
  `).all()

  // Pricing per million tokens: [input, output]
  const PRICING = {
    anthropic: [3.00, 15.00],
    openai:    [0.15,  0.60],  // gpt-4o-mini default
    gemini:    [0.075, 0.30],
    groq:      [0,     0],     // free tier
    ollama:    [0,     0],     // local/free
  }

  let totalGenerations = 0, totalPrompt = 0, totalCompletion = 0, totalCost = 0
  const byProvider = rows.map(r => {
    const [inPrice, outPrice] = PRICING[r.ai_provider] || [0, 0]
    const cost = (r.prompt_tokens / 1_000_000) * inPrice + (r.completion_tokens / 1_000_000) * outPrice
    totalGenerations += r.generations
    totalPrompt     += r.prompt_tokens
    totalCompletion += r.completion_tokens
    totalCost       += cost
    return { provider: r.ai_provider, generations: r.generations, prompt_tokens: r.prompt_tokens, completion_tokens: r.completion_tokens, cost }
  })

  res.json({ totalGenerations, totalPrompt, totalCompletion, totalCost, byProvider })
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
- Target 1 to 1.5 pages — include all selected roles with enough bullets to fully represent each; do NOT cut bullets just to squeeze into exactly one page
- Do NOT invent or exaggerate anything — only use what is in the profile above

===========================
COVER LETTER INSTRUCTIONS:
===========================
You are writing a cover letter for a real job application. This is not a template exercise — write like a specific, intelligent person who has done this work and wants this particular job.

Use this exact header format:
\`# ${basics?.full_name || 'Candidate'}\`
\`_${[basics?.location, basics?.phone].filter(Boolean).join('  ')}_\`
\`_${[basics?.linkedin_url, basics?.email].filter(Boolean).join('  ')}_\`

${job.company || 'Company Name'}
[City, Province — from job posting]

${today}

Dear Hiring Manager,

STRUCTURE:
- **Para 1**: Open with a direct, confident statement of intent — who you are, what you do, and why this specific company caught your attention. Never start with "I am writing to apply." Hook the reader immediately. Reference the role by name.
- **Para 2**: Map current role experience directly to a specific requirement in the job posting. Pull concrete facts from the candidate's profile — name the employer, name what was actually built or done. No vague summaries. No skill stacking.
- **Para 3**: Map a previous role to another specific requirement. Again cite real facts. The reader should be able to verify these against a resume.
- **Para 4**: This paragraph is entirely about them — their product, mission, industry, or values from the job posting. Show you understand what they actually do and why it matters. No skill lists. No "I believe I can." Make it feel like you've thought about this company specifically, not just the job title.
- **Para 5 / Close**: One or two warm, direct sentences. Clear call to action. Include ${basics?.phone || 'phone'} and ${basics?.email || 'email'}.

Sincerely,

${basics?.full_name || 'Candidate'}

TONE & VOICE:
- Write like a smart, confident person talking to another professional — not like a formal document
- Imagine the candidate speaking directly to the hiring manager — knowledgeable but human, not rehearsed
- Vary sentence length to create rhythm. Short sentences are okay. Not everything needs to be a complex clause.
- Match the tone of the job posting — formal if formal, modern if casual
- ${coverLetterTemplate ? "Mirror my previous cover letter's sentence structure, pacing, and voice — write as if the same person wrote both" : 'Professional, direct, confident, and genuine — like a real person, not a cover letter generator'}

RULES:
- Keep it to 4–5 paragraphs, under 450 words
- No filler sentences — every line must earn its place
- Never stack more than 2 skills or tools in a single sentence
- Every claim about the candidate must reference a specific fact from their profile — not "I have SQL experience" but "at Rentsync I perform SQL-based data profiling and cleansing daily across live production environments"
- The fourth paragraph should feel the warmest and most genuine — let that energy carry through the whole letter

BANNED WORDS & PHRASES — never use these under any circumstances:
"I am writing to apply", "I am excited/thrilled/eager", "I am confident", "utilize", "I look forward to discussing my application", "ideal candidate", "make me a great fit", "passionate about", "I believe I can", "my background spans", "maps directly to", "aligns with", "functional requirements", "I am drawn to", "demonstrated experience", "in this role I", "technical profile", "I look forward to hearing from you", "I'm drawn to the opportunity", "directly translates to", "I'd welcome the chance"

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

function parseAIResponse(rawText) {
  const text = typeof rawText === 'string' ? rawText : String(rawText ?? '')
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

function buildInterviewPrompt(context, job, jobOnly = false) {
  const { basics, experiences, education, skills } = context

  const targetCompany = (job.company || '').trim().toLowerCase()
  const filteredExp = experiences.filter(e =>
    !targetCompany || (e.company || '').trim().toLowerCase() !== targetCompany
  )

  const expText = filteredExp.map(e => {
    const bullets = [
      ...(e.description  || '').split('\n').filter(Boolean),
      ...(e.achievements || '').split('\n').filter(Boolean),
    ].map(b => `  • ${b.replace(/^[-•*]\s*/, '')}`).join('\n')
    return `${e.title} @ ${e.company} (${e.start_date || '?'} – ${e.is_current ? 'Present' : e.end_date || '?'})\n${bullets}`
  }).join('\n\n')

  const skillsText = skills.map(s => s.name).join(', ') || 'None listed.'
  const eduText = education.map(e => `${e.degree || ''} ${e.field || ''} — ${e.institution}`).join('; ') || ''

  // Detect software/coding roles to add the extra coding category
  const jobText = `${job.title || ''} ${job.raw_text || ''}`.toLowerCase()
  const isCodingRole = /\b(software|developer|engineer|coding|programmer|frontend|backend|fullstack|full.?stack|devops|swe|sde|data\s+engineer|ml\s+engineer|machine\s+learning|cloud\s+engineer|platform\s+engineer|site\s+reliability|firmware|embedded|mobile\s+dev|ios\s+dev|android\s+dev)\b/.test(jobText)

  const codingSection = isCodingRole ? `
---CODING & PROBLEM SOLVING---
Q: [question]
Hint: [talking point]

` : ''

  const codingInstruction = isCodingRole ? `
- CODING & PROBLEM SOLVING: 6-8 questions covering:
  * Algorithm & data structure challenges relevant to the role (e.g. "How would you find duplicates in a large dataset efficiently?")
  * System design questions at the appropriate seniority level (e.g. "Design a data pipeline that processes X")
  * Code quality / debugging scenarios (e.g. "You find a race condition in a production ETL job — walk me through your debugging process")
  * Complexity and trade-off questions (e.g. "When would you choose X over Y?")
  * Language/framework deep-dives based on the job's tech stack
  For each coding question, the Hint should suggest a concrete approach or framework the candidate can anchor to from their real experience.
` : ''

  const candidateSection = jobOnly ? '' : `
## Candidate Profile
Name: ${basics?.full_name || 'Candidate'}
Education: ${eduText}
Skills: ${skillsText}

## Work Experience
${expText || 'None on file.'}
`

  const hintInstruction = jobOnly
    ? 'For each question write a "Hint" — a 1-2 sentence best-practice answer framework or key points a strong candidate should cover. Keep hints general and actionable.'
    : 'For each question write a "Hint" — a 1-2 sentence talking point grounded in the candidate\'s ACTUAL experience. Only reference real facts from the profile above. Do not invent skills or experience.'

  return `You are an expert interview coach. Generate a comprehensive set of tailored interview questions for the job below.
${candidateSection}
## Target Job
Company: ${job.company || 'Unknown'}
Role: ${job.title || 'Unknown'}
${job.raw_text ? `\nJob Posting:\n${job.raw_text.slice(0, 3000)}` : ''}

## Instructions
Generate a large set of interview questions across ${isCodingRole ? '5' : '4'} categories. ${hintInstruction} More questions = more useful, so lean toward the higher end of each range.

- BEHAVIORAL: 7-8 STAR-method questions (Tell me about a time…, Describe a situation…, Give me an example of…). Cover: conflict resolution, deadline pressure, ambiguity, failure/learning, cross-team collaboration, going above and beyond, prioritisation under pressure.
- TECHNICAL: 8-10 questions drilling into the specific tools, systems, and domain knowledge in the job posting. Reference the actual stack, integrations, and processes mentioned.
- SITUATIONAL: 5-6 hypothetical scenario questions (What would you do if…, How would you handle…, Walk me through how you'd approach…). Make scenarios realistic for this specific role.
- ABOUT YOU: 4-5 questions covering motivation, strengths/weaknesses, career trajectory, working style, and culture fit.${codingInstruction}

Respond with EXACTLY this structure — no extra text before or after:

---BEHAVIORAL---
Q: [question]
Hint: [talking point]

Q: [question]
Hint: [talking point]

---TECHNICAL---
Q: [question]
Hint: [talking point]

---SITUATIONAL---
Q: [question]
Hint: [talking point]

---ABOUT YOU---
Q: [question]
Hint: [talking point]
${codingSection}---END---`
}

function parseInterviewResponse(rawText) {
  const text = typeof rawText === 'string' ? rawText : String(rawText ?? '')

  console.log('[Interview] Raw AI response (first 800 chars):\n', text.slice(0, 800))

  const result = { behavioral: [], technical: [], situational: [], about_you: [], coding: [] }

  const SECTION_KEYWORDS = [
    { key: 'behavioral',  re: /behavioral/i },
    { key: 'technical',   re: /technical/i  },
    { key: 'situational', re: /situational/i },
    { key: 'about_you',   re: /about.{0,4}you/i },
    { key: 'coding',      re: /coding|problem.{0,8}solv/i },
  ]

  // Strip markdown bold/italic wrappers from a string
  const stripMd = s => s.replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1').replace(/_{1,2}([^_]+)_{1,2}/g, '$1').trim()

  const lines = text.split(/\r?\n/)
  let currentKey = null
  let qText = null
  let hLines = []

  function commitQuestion() {
    if (currentKey && qText) {
      result[currentKey].push({ question: qText, hint: hLines.join(' ').trim() })
    }
    qText = null
    hLines = []
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const plain = stripMd(line)  // version with bold/italic removed

    // ── Section header detection ─────────────────────────────────────────────
    // A line is a section header if it contains a keyword AND is "header-like"
    // (short, contains ---, starts with #, or is all-caps / title-case label)
    const looksLikeHeader =
      line.includes('---') ||
      /^#{1,4}\s/.test(line) ||
      /^\*{1,2}[A-Z]/.test(line) ||           // **BEHAVIORAL**
      (/^[A-Z][A-Z\s]+[:\s]*$/.test(plain) && plain.length < 60) // ABOUT YOU:

    if (looksLikeHeader) {
      for (const { key, re } of SECTION_KEYWORDS) {
        if (re.test(plain)) {
          commitQuestion()
          currentKey = key
          break
        }
      }
      continue
    }

    // Also catch short title-case lines like "Behavioral Questions" or "About You"
    if (plain.length < 60 && /^[A-Z]/.test(plain)) {
      for (const { key, re } of SECTION_KEYWORDS) {
        if (re.test(plain)) {
          commitQuestion()
          currentKey = key
          continue
        }
      }
    }

    if (!currentKey) continue

    // ── Question line ────────────────────────────────────────────────────────
    // Matches: "Q:", "**Q:**", "Q1:", "Question 1:", "1.", "1)"
    if (/^(\*{1,2})?Q(?:uestion\s*\d*)?\*{0,2}\s*[:.]/i.test(line) || /^\d+[.)]\s/.test(line)) {
      commitQuestion()
      qText = plain
        .replace(/^Q(?:uestion\s*\d*)?\s*[:.]\s*/i, '')
        .replace(/^\d+[.)]\s*/, '')
        .trim()
      hLines = []
      continue
    }

    // ── Hint line ────────────────────────────────────────────────────────────
    // Matches: "Hint:", "**Hint:**", "H:", "Talking Point:", "Answer Hint:"
    if (/^(\*{1,2})?(hint|talking\s*point|answer\s*hint|tip)\*{0,2}\s*[:.]/i.test(line) ||
        /^(\*{1,2})?H\*{0,2}\s*[:.]\s/i.test(line)) {
      hLines.push(plain.replace(/^(hint|talking\s*point|answer\s*hint|tip|H)\s*[:.]\s*/i, '').trim())
      continue
    }

    // ── Continuation of hint or question (indented / plain text after Q) ────
    if (qText && !line.startsWith('---')) {
      hLines.push(plain)
    }
  }
  commitQuestion()

  const total = Object.values(result).reduce((n, arr) => n + arr.length, 0)
  if (total === 0) {
    throw new Error(`Could not parse interview questions. Check server console for the raw AI response.`)
  }
  return result
}

module.exports = router
