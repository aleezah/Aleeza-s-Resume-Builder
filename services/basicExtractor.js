/**
 * Regex-based extraction for basics — runs instantly, no AI needed.
 * Handles name, email, phone, LinkedIn, GitHub, GitLab, website.
 */
function extractBasics(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Email
  const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)

  // Phone — covers +1 (555) 000-0000, 555.000.0000, +44 7700 900000, etc.
  const phoneMatch = text.match(
    /(?:\+?\d{1,3}[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/
  )

  // LinkedIn
  const liMatch = text.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)\/?/i)

  // GitHub
  const ghMatch = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9\-_.]+)\/?/i)

  // GitLab
  const glMatch = text.match(/(?:https?:\/\/)?(?:www\.)?gitlab\.com\/([a-zA-Z0-9\-_.]+)\/?/i)

  // Website — non-LinkedIn/GitHub URL
  const allUrls = [...text.matchAll(/https?:\/\/(?!.*(?:linkedin|github|gitlab))[^\s,;|]+/gi)].map(m => m[0])
  const website = allUrls.find(u => !u.includes('linkedin') && !u.includes('github') && !u.includes('gitlab')) || null

  // Name heuristic — first short line that looks like a person's name (2-4 words, titlecase, no special chars)
  let name = null
  for (const line of lines.slice(0, 8)) {
    const words = line.split(/\s+/)
    if (
      words.length >= 2 && words.length <= 4 &&
      words.every(w => /^[A-Z][a-zA-Z\-'\.]+$/.test(w)) &&
      !line.includes('@') && !line.includes('.com')
    ) {
      name = line
      break
    }
  }

  return {
    full_name:    name || null,
    email:        emailMatch?.[0]?.toLowerCase() || null,
    phone:        phoneMatch?.[0] || null,
    linkedin_url: liMatch ? `https://linkedin.com/in/${liMatch[1]}` : null,
    github_url:   ghMatch ? `https://github.com/${ghMatch[1]}`   : null,
    gitlab_url:   glMatch ? `https://gitlab.com/${glMatch[1]}`   : null,
    website:      website || null,
  }
}

module.exports = { extractBasics }
