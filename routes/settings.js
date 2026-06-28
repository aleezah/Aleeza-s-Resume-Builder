const express = require('express')
const { getDb } = require('../db')

const router = express.Router()

const ALLOWED_KEYS = ['ai_provider', 'ollama_base_url', 'ollama_model', 'gemini_api_key', 'gemini_model',
  'groq_api_key', 'groq_model', 'anthropic_api_key', 'anthropic_model',
  'openai_api_key', 'openai_model', 'resume_template_style']

// Defaults shown in the UI when nothing is saved yet
const DEFAULTS = {
  ai_provider:     'ollama',
  ollama_base_url: 'http://127.0.0.1:11434',
  ollama_model:    'llama3.1:8b',
  gemini_model:    'gemini-3.5-flash',
  groq_model:      'llama-3.3-70b-versatile',
  anthropic_model: 'claude-sonnet-4-6',
  openai_model:    'gpt-4o-mini',
}

router.get('/', (_req, res) => {
  const rows = getDb().prepare('SELECT key, value FROM settings').all()
  const stored = {}
  for (const row of rows) stored[row.key] = row.value

  // Merge defaults (stored values take precedence)
  const settings = { ...DEFAULTS, ...stored }

  // Mask API keys
  for (const key of Object.keys(settings)) {
    if (key.includes('api_key') && settings[key]) {
      settings[key] = '••••••••' + settings[key].slice(-4)
    }
  }
  res.json(settings)
})

router.put('/', (req, res) => {
  const db = getDb()
  for (const [key, value] of Object.entries(req.body)) {
    if (!ALLOWED_KEYS.includes(key)) continue
    if (!value || value === '') {
      db.prepare('DELETE FROM settings WHERE key = ?').run(key)
    } else {
      db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)").run(key, String(value))
    }
  }
  res.json({ success: true })
})

// Detect available Ollama models
router.get('/ollama-models', async (_req, res) => {
  const axios = require('axios')
  const { getDb } = require('../db')
  const baseUrl = (getDb().prepare("SELECT value FROM settings WHERE key='ollama_base_url'").get()?.value) || 'http://127.0.0.1:11434'
  try {
    const { data } = await axios.get(`${baseUrl}/api/tags`, { timeout: 4000 })
    const models = (data.models || []).map(m => m.name)
    res.json({ connected: true, models })
  } catch {
    res.json({ connected: false, models: [] })
  }
})

// List available Gemini models for the configured key
router.get('/gemini-models', async (_req, res) => {
  const apiKey = getDb().prepare("SELECT value FROM settings WHERE key='gemini_api_key'").get()?.value
  if (!apiKey) return res.json({ ok: false, error: 'No Gemini API key saved yet.' })
  try {
    const { listGeminiModels } = require('../services/aiService')
    const result = await listGeminiModels(apiKey)
    res.json(result)
  } catch (e) {
    res.json({ ok: false, models: [], error: e.message })
  }
})

// List available Groq models for the configured key
router.get('/groq-models', async (_req, res) => {
  const axios = require('axios')
  const apiKey = getDb().prepare("SELECT value FROM settings WHERE key='groq_api_key'").get()?.value
  if (!apiKey) return res.json({ ok: false, error: 'No Groq API key saved yet.' })
  try {
    const { data } = await axios.get('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 8000
    })
    const models = (data.data || [])
      .filter(m => m.id && !m.id.includes('whisper') && !m.id.includes('guard') && !m.id.includes('tts'))
      .map(m => m.id)
      .sort()
    res.json({ ok: true, models })
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message
    res.json({ ok: false, models: [], error: msg })
  }
})

// Test AI connection
router.post('/test-ai', async (_req, res) => {
  try {
    const { callAI } = require('../services/aiService')
    const result = await callAI('Say "OK" and nothing else.')
    res.json({ success: true, response: result.text.trim() })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
