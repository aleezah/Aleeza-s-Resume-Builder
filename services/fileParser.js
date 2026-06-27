const fs = require('fs')
const path = require('path')
const { parse: csvParse } = require('csv-parse/sync')

async function parseFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase()

  if (ext === '.pdf') {
    return parsePdf(filePath)
  } else if (ext === '.docx' || ext === '.doc') {
    return parseDocx(filePath)
  } else if (ext === '.txt' || ext === '.tex') {
    return fs.readFileSync(filePath, 'utf8')
  }
  return ''
}

async function parsePdf(filePath) {
  try {
    const pdfParse = require('pdf-parse')
    const buffer = fs.readFileSync(filePath)
    const data = await pdfParse(buffer)
    return data.text || ''
  } catch (err) {
    console.error('PDF parse error:', err.message)
    return ''
  }
}

async function parseDocx(filePath) {
  try {
    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value || ''
  } catch (err) {
    console.error('DOCX parse error:', err.message)
    return ''
  }
}

function parseCsv(content) {
  try {
    return csvParse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    })
  } catch {
    return []
  }
}

module.exports = { parseFile, parseCsv }
