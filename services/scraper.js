let browser = null

async function getBrowser() {
  if (!browser) {
    const { chromium } = require('playwright')
    browser = await chromium.launch({ headless: true })
  }
  return browser
}

async function scrapeJobPage(url) {
  const b = await getBrowser()
  const page = await b.newPage()

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)

    const result = await page.evaluate(() => {
      // Try to get page title as job title hint
      const title = document.title || ''

      // Remove nav, footer, script, style, header elements
      const remove = ['nav', 'footer', 'script', 'style', 'header', 'aside', '[role="banner"]', '[role="navigation"]']
      remove.forEach(sel => document.querySelectorAll(sel).forEach(el => el.remove()))

      // Try common job description selectors
      const selectors = [
        '[class*="job-description"]', '[class*="jobDescription"]', '[id*="job-description"]',
        '[class*="description"]', '[class*="posting"]', '[class*="job-details"]',
        '[data-testid*="job"]', 'article', 'main'
      ]

      let text = ''
      for (const sel of selectors) {
        const el = document.querySelector(sel)
        if (el && el.innerText && el.innerText.length > 200) {
          text = el.innerText
          break
        }
      }

      if (!text) text = document.body.innerText

      return { title, text: text.slice(0, 15000) }
    })

    // Try to extract company name and job title from page title or URL
    const { company, jobTitle } = extractMeta(result.title, url)

    return {
      url,
      company,
      title: jobTitle,
      raw_text: result.text
    }
  } finally {
    await page.close()
  }
}

function extractMeta(pageTitle, url) {
  // Common patterns: "Job Title at Company | Site" or "Company - Job Title"
  let company = null
  let jobTitle = null

  const atMatch = pageTitle.match(/^(.+?)\s+at\s+(.+?)(?:\s*[|\-|–]|$)/)
  if (atMatch) {
    jobTitle = atMatch[1].trim()
    company  = atMatch[2].trim()
  }

  const dashMatch = pageTitle.match(/^(.+?)\s*[-–]\s*(.+?)(?:\s*[|]|$)/)
  if (!jobTitle && dashMatch) {
    jobTitle = dashMatch[1].trim()
    company  = dashMatch[2].trim()
  }

  // Try extracting company from URL domain
  if (!company) {
    try {
      const domain = new URL(url).hostname.replace('www.', '')
      company = domain.split('.')[0]
      company = company.charAt(0).toUpperCase() + company.slice(1)
    } catch {}
  }

  return { company, jobTitle: jobTitle || pageTitle.slice(0, 100) }
}

async function closeBrowser() {
  if (browser) {
    await browser.close()
    browser = null
  }
}

module.exports = { scrapeJobPage, closeBrowser }
