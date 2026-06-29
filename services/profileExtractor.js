const { callAI } = require('./aiService')

const EXTRACTION_PROMPT = (text) => `You are a resume parser. Extract structured data from the following resume text.

Return ONLY valid JSON matching this exact schema (no markdown fences, no explanation):
{
  "basics": {
    "full_name": "string or null",
    "email": "string or null",
    "phone": "string or null",
    "location": "string or null",
    "linkedin_url": "string or null",
    "github_url": "string or null",
    "website": "string or null",
    "summary": "string or null"
  },
  "experiences": [
    {
      "company": "string",
      "title": "string",
      "location": "string or null",
      "start_date": "YYYY-MM or YYYY or null",
      "end_date": "YYYY-MM or YYYY or null",
      "is_current": false,
      "description": "string or null",
      "achievements": "bullet points as single string, each on new line starting with •"
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string or null",
      "field": "string or null",
      "start_date": "YYYY or null",
      "end_date": "YYYY or null",
      "gpa": "string or null"
    }
  ],
  "skills": [
    { "name": "string", "category": "string or null" }
  ],
  "certifications": [
    { "name": "string", "issuer": "string or null", "issued_date": "string or null" }
  ],
  "projects": [
    { "name": "string", "description": "string or null", "url": "string or null", "tech_stack": "string or null" }
  ]
}

Resume text:
${text.slice(0, 8000)}`

async function extractProfileFromText(rawText, _profileId) {
  if (!rawText || rawText.trim().length < 50) return null

  const response = await callAI(EXTRACTION_PROMPT(rawText))

  // Strip markdown fences and leading/trailing prose
  let cleaned = response.text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  // Slice to just the JSON object: everything from the first { to the last }
  const firstBrace = cleaned.indexOf('{')
  const lastBrace  = cleaned.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }

  try {
    return JSON.parse(cleaned)
  } catch (e1) {
    // Attempt light repair: remove trailing commas before } or ]
    const repaired = cleaned
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/,\s*$/, '')
    try {
      return JSON.parse(repaired)
    } catch (e2) {
      console.warn('Could not parse extraction response as JSON. AI returned:', cleaned.slice(0, 300))
      return null
    }
  }
}

module.exports = { extractProfileFromText }
