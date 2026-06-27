# Resume Builder

A local web app that generates tailored resumes and cover letters using your profile, saved job postings, and an optional LaTeX template. Supports multiple AI providers — pick whichever you have access to.

## Features

- Upload your existing resume and auto-extract your work history, skills, and education
- Save job postings (paste or scrape from URL) and generate tailored applications in one click
- Outputs a Word document (DOCX), a filled LaTeX `.tex` file, and a cover letter
- Choose which experiences to include per generation
- Supports Ollama (free/local), Google Gemini, Groq, Anthropic Claude, and OpenAI

---

## Requirements

- [Node.js](https://nodejs.org/) v18 or later
- npm (comes with Node.js)
- An AI provider — at least one of:
  - [Ollama](https://ollama.com/) running locally (free)
  - [Groq](https://console.groq.com/) API key (free tier)
  - [Google Gemini](https://aistudio.google.com/) API key (free tier)
  - [Anthropic Claude](https://console.anthropic.com/) API key (paid)
  - [OpenAI](https://platform.openai.com/) API key (paid)

---

## Setup

### 1. Clone the repo

```bash
gh repo clone aleezah/Resume-Builder
cd Resume-Builder
```

### 2. Install dependencies

```bash
npm run install:all
```

This installs both the backend (`/`) and frontend (`/client`) dependencies in one command.

### 3. Configure environment (optional)

Copy the example env file and edit it if you want to set defaults via environment variables instead of the in-app Settings page:

```bash
cp .env.example .env
```

You can leave this blank — all settings can be configured through the **Settings** page in the UI instead.

### 4. Start the app

**Windows:**
```bash
start.bat
```

**Mac/Linux:**
```bash
npm run dev
```

This starts both the backend (port `3001`) and the frontend dev server (port `5173`).

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
