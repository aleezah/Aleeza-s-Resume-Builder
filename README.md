# Resume Builder

A local web app that generates tailored resumes and cover letters using your profile, saved job postings, and an optional LaTeX template. Supports multiple AI providers — pick whichever you have access to.

## Features

- Upload your existing resume and auto-extract your work history, skills, and education
- Save job postings (paste or scrape from URL) and generate tailored applications in one click
- Outputs a Word document (DOCX), a filled LaTeX `.tex` file, and a cover letter
- Choose which experiences to include per generation
- Export your job tracker to CSV / Excel
- Supports Ollama (free/local), Google Gemini, Groq, Anthropic Claude, and OpenAI

---

## Installation

### Option A — Windows installer (easiest, no coding required)

1. Download and install [Node.js LTS](https://nodejs.org/en/download) if you don't have it
2. Download this repo as a ZIP → **Code → Download ZIP** → extract it anywhere
3. Double-click `install.bat`
   - Checks for Node.js and installs all dependencies automatically
   - Creates a **Resume Builder** shortcut on your Desktop
4. Double-click the **Resume Builder** shortcut anytime to launch — your browser opens automatically

> **Want a proper `.exe` installer?** Install [Inno Setup](https://jrsoftware.org/isinfo.php), open `ResumeBuilder.iss`, and click Build. This produces a `ResumeBuilder-Setup.exe` you can share with anyone.

---

### Option B — Developer setup (Mac / Linux / Windows terminal)

**Requirements**
- [Node.js](https://nodejs.org/) v18 or later
- An AI provider — at least one of:
  - [Groq](https://console.groq.com/) API key (free tier)
  - [Google Gemini](https://aistudio.google.com/) API key (free tier)
  - [Ollama](https://ollama.com/) running locally (free)
  - [Anthropic Claude](https://console.anthropic.com/) API key (paid)
  - [OpenAI](https://platform.openai.com/) API key (paid)

**Steps**

```bash
# 1. Clone
git clone https://github.com/aleezah/Aleeza-s-Resume-Builder.git
cd Aleeza-s-Resume-Builder

# 2. Install dependencies
npm run install:all

# 3. Start
npm run dev        # Mac / Linux
start.bat          # Windows
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## First-time walkthrough

1. **Settings** — pick an AI provider and paste in your API key
2. **Documents** → upload your existing resume (PDF or DOCX) — the app extracts your profile automatically
3. **My Profile** — review and edit your extracted work history, skills, and education
4. **Jobs** → add a job posting (paste the text or enter a URL to scrape it)
5. **Generate** → select the job, choose which experiences to include, and click Generate
6. Download the **Resume DOCX**, **Cover Letter DOCX**, or **LaTeX** file from the results

---

## Using your own LaTeX template

1. Go to **Documents** → upload your `.tex` file, set the type to **Template**
2. Click **☆ Template** to mark it as active
3. Every generation will now fill in your exact LaTeX layout

---

## Project structure

```
resume-builder/
├── install.bat            # One-click Windows setup (run once)
├── start.bat              # Launch the app
├── ResumeBuilder.iss      # Inno Setup script to build a .exe installer
├── server.js              # Express server entry point
├── db/                    # SQLite database setup
├── routes/                # API routes (generate, documents, jobs, settings…)
├── services/              # AI, DOCX generation, file parsing, scraping
├── templates/             # Default LaTeX resume template
├── uploads/               # Uploaded documents (gitignored)
├── outputs/               # Generated files (gitignored)
└── client/                # React + Vite + Tailwind frontend
    └── src/
        ├── pages/         # Dashboard, Generate, Jobs, Documents, Profile, Settings
        └── components/    # Shared UI components
```

---

## Data & privacy

Everything runs locally. Your profile data, API keys, and generated files are stored in a local SQLite database (`data.db`) and the `uploads/` and `outputs/` folders — none of which are committed to git.
