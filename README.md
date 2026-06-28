# Job Application Tool

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

### Windows — no coding required

1. Download this repo: click **Code → Download ZIP** at the top of this page, then extract the ZIP anywhere (e.g. your Desktop or Documents)
2. Open the extracted folder and double-click **`install.bat`**
   - Right-click → **Run as administrator** if prompted
   - **Node.js is installed automatically** — no need to do anything yourself:
     - On Windows 10 / 11 it installs silently via Windows Package Manager (`winget`)
     - If that isn't available, it downloads and runs the official Node.js installer for you
   - All app components are installed
   - A **Job Application Tool** shortcut is created on your Desktop
3. Double-click the **Job Application Tool** shortcut anytime to launch — your browser opens automatically

> If Windows asks *"Do you want to allow this app to make changes?"*, click **Yes** — this is needed to install Node.js.

---

### Mac — no coding required

1. Download this repo: click **Code → Download ZIP** at the top of this page, then extract the ZIP anywhere
2. Open **Terminal**: press `Cmd + Space`, type `Terminal`, and press Enter
3. In Terminal, type `bash ` (with a space after it), then drag the extracted folder into the Terminal window, then type `/install.sh` and press Enter:
   ```
   bash /path/to/resume-builder/install.sh
   ```
   - **Node.js is installed automatically** — no need to do anything yourself:
     - Homebrew is installed first if needed (you may be asked for your Mac password — this is normal)
     - Node.js is then installed via Homebrew
   - All app components are installed
   - **Job Application Tool** is added to your Applications folder
4. Open **Job Application Tool** from Launchpad or Spotlight (`Cmd + Space` → type "Job Application Tool") anytime to launch

> If Mac says *"install.sh cannot be opened because it is from an unidentified developer"*, right-click the file → **Open** → **Open** to bypass this.

---

### Developer setup (terminal)

```bash
# Clone
git clone https://github.com/aleezah/Aleeza-s-Resume-Builder.git
cd Aleeza-s-Resume-Builder

# Install dependencies
npm run install:all

# Start
npm run dev        # Mac / Linux
start.bat          # Windows
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## AI provider setup

You'll need at least one AI provider configured in the app's Settings page:

| Provider | Cost | Sign up |
|---|---|---|
| Groq | Free tier | [console.groq.com](https://console.groq.com) |
| Google Gemini | Free tier | [aistudio.google.com](https://aistudio.google.com) |
| Ollama | Free, runs locally | [ollama.com](https://ollama.com) |
| Anthropic Claude | Paid | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI | Paid | [platform.openai.com](https://platform.openai.com) |

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
├── install.sh             # One-click Mac setup (run once)
├── start.bat              # Launch the app (Windows)
├── start.sh               # Launch the app (Mac)
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
