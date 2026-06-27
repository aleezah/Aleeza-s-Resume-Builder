function escape(str) {
  if (!str) return ''
  return String(str)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
}

function mdToLatex(md) {
  const lines = md.split('\n')
  let out = ''
  let inSection = false
  let inItemize = false

  const closeItemize = () => {
    if (inItemize) { out += '\\end{itemize}\n'; inItemize = false }
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (line.startsWith('# ')) {
      // Name — already handled in header, skip
      continue
    } else if (line.startsWith('## ')) {
      closeItemize()
      if (inSection) out += '\\vspace{4pt}\n'
      out += `\n\\section*{${escape(line.slice(3).trim())}}\n\\hrule\n\\vspace{4pt}\n`
      inSection = true
    } else if (line.startsWith('#### ')) {
      closeItemize()
      out += `{\\small\\textbf{${escape(line.slice(5).trim())}}}\\\\\n`
    } else if (line.startsWith('### ')) {
      closeItemize()
      out += `\\textbf{${escape(line.slice(4).trim())}}\\\\\n`
    } else if (/^[-•*]\s/.test(line)) {
      if (!inItemize) { out += '\\begin{itemize}[leftmargin=*,topsep=0pt,partopsep=0pt,parsep=0pt,itemsep=2pt]\n'; inItemize = true }
      const text = line.replace(/^[-•*]\s/, '').replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}').replace(/\*(.+?)\*/g, '\\textit{$1}')
      out += `  \\item ${escape(text)}\n`
    } else if (line === '') {
      closeItemize()
      out += '\n'
    } else {
      closeItemize()
      const text = line.replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}').replace(/\*(.+?)\*/g, '\\textit{$1}')
      out += `${escape(text)}\\\\\n`
    }
  }
  closeItemize()
  return out
}

function generateLatex(resumeMd, basics = {}) {
  const name    = escape(basics?.full_name || 'Your Name')
  const email   = escape(basics?.email   || '')
  const phone   = escape(basics?.phone   || '')
  const loc     = escape(basics?.location || '')
  const linkedin = escape(basics?.linkedin_url || '')
  const github  = escape(basics?.github_url  || '')

  const contactParts = [email, phone, loc, linkedin, github].filter(Boolean)
  const contactLine = contactParts.join(' $\\cdot$ ')

  const body = mdToLatex(resumeMd)

  return `%% Auto-generated resume — compile with pdflatex
\\documentclass[10pt,letterpaper]{article}
\\usepackage[margin=0.6in]{geometry}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{hyperref}
\\usepackage{parskip}
\\usepackage{fontenc}
\\usepackage[utf8]{inputenc}
\\hypersetup{colorlinks=true,urlcolor=blue,linkcolor=black}

\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}[\\vspace{-6pt}\\hrule\\vspace{4pt}]
\\titlespacing{\\section}{0pt}{12pt}{4pt}

\\setlength{\\parindent}{0pt}
\\pagestyle{empty}

\\begin{document}

{\\LARGE \\textbf{${name}}}\\\\[2pt]
{\\small ${contactLine}}

${body}

\\end{document}
`
}

module.exports = { generateLatex }
