const axios = require('axios')
const { getDb } = require('../db')

function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? row.value : null
}

function getProvider() {
  return getSetting('ai_provider') || process.env.AI_PROVIDER || 'ollama'
}

// Returns { text, prompt_tokens, completion_tokens, provider }
async function callAI(prompt, options = {}) {
  const provider = getProvider()
  let result

  switch (provider) {
    case 'ollama':    result = await callOllama(prompt, options); break
    case 'gemini':    result = await callGemini(prompt, options); break
    case 'groq':      result = await callGroq(prompt, options); break
    case 'anthropic': result = await callAnthropic(prompt, options); break
    case 'openai':    result = await callOpenAI(prompt, options); break
    default:
      throw new Error(`Unknown AI provider: "${provider}". Go to Settings to configure one.`)
  }

  return { ...result, provider }
}

// ── Ollama (free, local) ──────────────────────────────────────────────────────

async function callOllama(prompt, options) {
  const baseUrl = getSetting('ollama_base_url') || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
  const model   = getSetting('ollama_model')    || process.env.OLLAMA_MODEL    || 'llama3.1:8b'

  const { data } = await axios.post(`${baseUrl}/api/generate`, {
    model,
    prompt,
    stream: false,
    options: { temperature: options.temperature ?? 0.7, num_predict: options.max_tokens ?? 4096 }
  }, { timeout: 180000 })

  return { text: data.response || '', prompt_tokens: data.prompt_eval_count || 0, completion_tokens: data.eval_count || 0 }
}

// ── Google Gemini (free tier) ─────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function callGemini(prompt, options) {
  const apiKey = getSetting('gemini_api_key') || process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Gemini API key not set. Go to Settings.')
  const model = getSetting('gemini_model') || process.env.GEMINI_MODEL || 'gemini-3.5-flash'

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: options.temperature ?? 0.7, maxOutputTokens: options.max_tokens ?? 4096 }
  }
  const headers = { 'X-goog-api-key': apiKey, 'Content-Type': 'application/json' }

  // Try v1beta first (supports latest models), fall back to v1
  const endpoints = [
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
  ]

  let lastErr
  for (const url of endpoints) {
    // Retry up to 3 times on 503 (high demand / transient overload)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data } = await axios.post(url, body, { headers, timeout: 120000 })
        return {
          text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
          prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
          completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
        }
      } catch (err) {
        const status = err.response?.status
        const geminiMsg = err.response?.data?.error?.message || ''

        if (status === 401) {
          throw new Error(`Gemini API key is invalid or has been revoked. Go to aistudio.google.com, create a new key, and save it in Settings.`)
        }
        if (status === 400 || status === 403) {
          throw new Error(`Gemini error (${status}): ${geminiMsg || 'Invalid API key or no permission.'}`)
        }
        if (status === 429) {
          throw new Error(`Gemini quota exceeded for model "${model}". Try a different model in Settings (e.g. gemini-2.0-flash-lite). ${geminiMsg}`)
        }

        if (status === 503 && attempt < 2) {
          await sleep(3000 * (attempt + 1)) // 3s then 6s
          continue
        }

        lastErr = err
        break // try next endpoint
      }
    }
  }

  const status = lastErr?.response?.status
  const geminiMsg = lastErr?.response?.data?.error?.message || lastErr?.message || 'Unknown error'
  if (status === 503) {
    throw new Error(`Gemini is overloaded and did not recover after 3 retries. Please wait a minute and try again.`)
  }
  if (status === 404) {
    throw new Error(`Gemini model "${model}" was not found. Use "List Available Models" in Settings to see valid names for your API key.`)
  }
  throw new Error(`Gemini request failed (HTTP ${status || 'network error'}): ${geminiMsg}`)
}

async function listGeminiModels(apiKey) {
  const results = []
  for (const ver of ['v1beta', 'v1']) {
    try {
      const { data } = await axios.get(
        `https://generativelanguage.googleapis.com/${ver}/models`,
        { headers: { 'X-goog-api-key': apiKey }, timeout: 8000 }
      )
      const models = (data.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace('models/', ''))
      return { ok: true, models, version: ver }
    } catch (e) {
      results.push(e.response?.data?.error?.message || e.message)
    }
  }
  return { ok: false, models: [], error: results.join(' | ') }
}

// ── Groq (free tier) ──────────────────────────────────────────────────────────

async function callGroq(prompt, options) {
  const apiKey = getSetting('groq_api_key') || process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('Groq API key not set. Go to Settings.')
  const model = getSetting('groq_model') || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

  const { data } = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4096
    },
    { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 120000 }
  )

  return { text: data.choices?.[0]?.message?.content || '', prompt_tokens: data.usage?.prompt_tokens || 0, completion_tokens: data.usage?.completion_tokens || 0 }
}

// ── Anthropic Claude (paid) ───────────────────────────────────────────────────

async function callAnthropic(prompt, options) {
  const apiKey = getSetting('anthropic_api_key') || process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Anthropic API key not set. Go to Settings.')
  const model = getSetting('anthropic_model') || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

  const { data } = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model,
      max_tokens: options.max_tokens ?? 4096,
      messages: [{ role: 'user', content: prompt }]
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      timeout: 120000
    }
  )

  return { text: data.content?.[0]?.text || '', prompt_tokens: data.usage?.input_tokens || 0, completion_tokens: data.usage?.output_tokens || 0 }
}

// ── OpenAI (paid) ─────────────────────────────────────────────────────────────

async function callOpenAI(prompt, options) {
  const apiKey = getSetting('openai_api_key') || process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OpenAI API key not set. Go to Settings.')
  const model = getSetting('openai_model') || process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const { data } = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4096
    },
    { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 120000 }
  )

  return { text: data.choices?.[0]?.message?.content || '', prompt_tokens: data.usage?.prompt_tokens || 0, completion_tokens: data.usage?.completion_tokens || 0 }
}

module.exports = { callAI, getProvider, listGeminiModels }
