const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, Table, TableRow, TableCell,
  WidthType, SpacingType, UnderlineType, Header, Footer, PageNumber
} = require('docx')
const fs = require('fs')

/**
 * Parse Markdown resume into sections for DOCX generation.
 * Handles headings (##), bullets (- or •), bold (**text**), plain lines.
 */
function parseMd(md) {
  const lines = md.split('\n')
  const sections = []
  let current = null

  for (const raw of lines) {
    const line = raw.trimEnd()

    // H1 — name/title
    if (line.startsWith('# ')) {
      if (current) sections.push(current)
      current = { type: 'h1', text: line.slice(2).trim(), children: [] }
      sections.push(current); current = null
    }
    // H2 — section heading
    else if (line.startsWith('## ')) {
      if (current) sections.push(current)
      current = { type: 'section', heading: line.slice(3).trim(), items: [] }
    }
    // H3 — company heading
    else if (line.startsWith('### ')) {
      if (current) current.items?.push({ type: 'h3', text: line.slice(4).trim() })
    }
    // H4 — role/title within a company
    else if (line.startsWith('#### ')) {
      if (current) current.items?.push({ type: 'h4', text: line.slice(5).trim() })
    }
    // Bullet
    else if (/^[-•*]\s/.test(line)) {
      const text = line.replace(/^[-•*]\s/, '').trim()
      if (current) current.items?.push({ type: 'bullet', text })
    }
    // Standalone italic line _text_ — used for preview only, skip in DOCX (contact handled via basics)
    else if (/^_[^_]+_$/.test(line.trim())) {
      // skip
    }
    // Blank line
    else if (line === '') {
      if (current) current.items?.push({ type: 'spacer' })
    }
    // Normal text
    else if (line.trim()) {
      if (current) current.items?.push({ type: 'text', text: line.trim() })
      else sections.push({ type: 'text', text: line.trim() })
    }
  }
  if (current) sections.push(current)
  return sections
}

function parseInline(text) {
  // Handle **bold** and *italic* inline
  const runs = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g
  let last = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) runs.push(new TextRun({ text: text.slice(last, match.index), size: 20 }))
    if (match[2]) runs.push(new TextRun({ text: match[2], bold: true, size: 20 }))
    else if (match[3]) runs.push(new TextRun({ text: match[3], italics: true, size: 20 }))
    last = regex.lastIndex
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), size: 20 }))
  return runs.length ? runs : [new TextRun({ text, size: 20 })]
}

async function generateDocx(markdownText, basics, outputPath, style = 'modern') {
  if (style === 'letter') {
    return generateCoverLetterDocx(markdownText, basics, outputPath)
  }

  const sections = parseMd(markdownText)
  const children = []

  const ACCENT = '003366'
  const SP = (before = 0, after = 0) => ({ before, after, line: 240, lineRule: 'auto' })
  const DIVIDER = new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT } },
    spacing: SP(0, 40)
  })

  for (const sec of sections) {
    if (sec.type === 'h1') {
      children.push(new Paragraph({
        children: [new TextRun({ text: sec.text, bold: true, size: 32, color: ACCENT })],
        alignment: AlignmentType.CENTER,
        spacing: SP(0, 40)
      }))
      if (basics) {
        const parts = [basics.phone, basics.email, basics.location, basics.linkedin_url, basics.github_url]
          .filter(Boolean).join('  ·  ')
        if (parts) children.push(new Paragraph({
          children: [new TextRun({ text: parts, size: 16, color: '444444' })],
          alignment: AlignmentType.CENTER,
          spacing: SP(0, 80)
        }))
      }
      continue
    }

    if (sec.type === 'section') {
      children.push(new Paragraph({
        children: [new TextRun({ text: sec.heading.toUpperCase(), bold: true, size: 22, color: ACCENT })],
        spacing: SP(100, 20)
      }))
      children.push(DIVIDER)

      for (const item of sec.items || []) {
        if (item.type === 'h3') {
          children.push(new Paragraph({
            children: [new TextRun({ text: item.text, bold: true, size: 20 })],
            spacing: SP(60, 0)
          }))
        } else if (item.type === 'h4') {
          children.push(new Paragraph({
            children: [new TextRun({ text: item.text, bold: true, size: 19, color: '333333' })],
            spacing: SP(0, 0)
          }))
        } else if (item.type === 'bullet') {
          children.push(new Paragraph({
            children: parseInline(item.text),
            bullet: { level: 0 },
            spacing: SP(0, 20)
          }))
        } else if (item.type === 'text') {
          children.push(new Paragraph({
            children: parseInline(item.text),
            spacing: SP(0, 20)
          }))
        } else if (item.type === 'spacer') {
          children.push(new Paragraph({ spacing: SP(0, 20) }))
        }
      }
      continue
    }

    if (sec.type === 'text') {
      children.push(new Paragraph({
        children: parseInline(sec.text),
        spacing: SP(0, 40)
      }))
    }
  }

  // 0.42in margins to match LaTeX template (604 twips)
  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 604, right: 604, bottom: 604, left: 604 } } },
      children
    }]
  })

  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(outputPath, buffer)
}

async function generateCoverLetterDocx(markdownText, basics, outputPath) {
  const lines = markdownText.split('\n').filter(l => l.trim())
  const children = []

  // Header with contact info
  if (basics?.full_name) {
    children.push(new Paragraph({
      children: [new TextRun({ text: basics.full_name, bold: true, size: 28 })],
      spacing: { after: 40 }
    }))
  }
  const contact = [basics?.email, basics?.phone, basics?.location].filter(Boolean).join(' | ')
  if (contact) children.push(new Paragraph({ children: [new TextRun({ text: contact, size: 18, color: '666666' })], spacing: { after: 240 } }))

  // Body paragraphs
  for (const line of lines) {
    // Skip name/heading and standalone italic contact line — already rendered from basics above
    if (line.startsWith('# ') || line.startsWith('## ')) continue
    if (/^_[^_]+_$/.test(line.trim())) continue
    children.push(new Paragraph({
      children: parseInline(line.replace(/^[-•*]\s/, '').trim()),
      spacing: { after: 160 },
      alignment: AlignmentType.JUSTIFIED
    }))
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      children
    }]
  })
  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(outputPath, buffer)
}

module.exports = { generateDocx, generateCoverLetterDocx }
