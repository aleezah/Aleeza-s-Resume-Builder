import { useEffect, useState } from 'react'
import * as api from '../api'

const PROVIDERS = [
  { value: 'ollama',     label: 'Ollama',           tag: 'Free · Local',    colour: 'bg-green-900 text-green-300' },
  { value: 'gemini',     label: 'Google Gemini',    tag: 'Free tier',       colour: 'bg-blue-900 text-blue-300' },
  { value: 'groq',       label: 'Groq',             tag: 'Free tier',       colour: 'bg-purple-900 text-purple-300' },
  { value: 'anthropic',  label: 'Anthropic Claude', tag: 'Paid ~$0.06/gen', colour: 'bg-yellow-900 text-yellow-300' },
  { value: 'openai',     label: 'OpenAI',           tag: 'Paid',            colour: 'bg-gray-800 text-gray-400' },
]

const INSTRUCTIONS = {
  ollama: {
    steps: [
      { n: 1, text: 'Download and install Ollama', link: { label: 'ollama.com', href: 'https://ollama.com' } },
      { n: 2, text: 'Open a terminal and run:', code: 'ollama pull llama3.1' },
      { n: 3, text: 'Wait for the model to download (~4GB), then come back here and click "Auto-detect Models".' },
      { n: 4, text: 'Hit "Test Connection" — should say OK.' },
    ],
    note: 'Ollama runs completely on your machine. No internet required, no cost, fully private. Recommended if you have 8GB+ RAM.'
  },
  gemini: {
    steps: [
      { n: 1, text: 'Go to Google AI Studio', link: { label: 'aistudio.google.com', href: 'https://aistudio.google.com' } },
      { n: 2, text: 'Sign in with a Google account and click "Get API key" → "Create API key".' },
      { n: 3, text: 'Copy the key (starts with AIza…) and paste it below.' },
    ],
    note: 'Free tier gives you 1,500 requests/day with Gemini 2.0 Flash. No credit card needed.'
  },
  groq: {
    steps: [
      { n: 1, text: 'Go to Groq Console', link: { label: 'console.groq.com', href: 'https://console.groq.com' } },
      { n: 2, text: 'Create a free account → API Keys → Create API key.' },
      { n: 3, text: 'Copy the key (starts with gsk_…) and paste it below.' },
    ],
    note: 'Groq has generous free rate limits and is very fast. Uses open-source models (Llama 3.1 70B recommended).'
  },
  anthropic: {
    steps: [
      { n: 1, text: 'Go to Anthropic Console', link: { label: 'console.anthropic.com', href: 'https://console.anthropic.com' } },
      { n: 2, text: 'Create an account → Settings → API Keys → Create Key.' },
      { n: 3, text: 'Add a credit card (pay-as-you-go) — you only get charged when you use it.' },
      { n: 4, text: 'Copy the key (starts with sk-ant-…) and paste it below.' },
    ],
    note: 'Claude Sonnet 4.6 produces excellent tailored resumes. ~$0.056 per generation (resume + cover letter).'
  },
  openai: {
    steps: [
      { n: 1, text: 'Go to OpenAI Platform', link: { label: 'platform.openai.com', href: 'https://platform.openai.com' } },
      { n: 2, text: 'Sign in → API Keys → Create new secret key.' },
      { n: 3, text: 'Add a credit card under Billing and buy $5 of credits.' },
      { n: 4, text: 'Copy the key (starts with sk-…) and paste it below.' },
    ],
    note: 'GPT-4o-mini is cheap and capable for resume generation.'
  }
}

const CONSOLE_LINKS = {
  anthropic: { label: 'Anthropic Console', href: 'https://console.anthropic.com/settings/billing' },
  openai:    { label: 'OpenAI Platform',   href: 'https://platform.openai.com/account/billing/overview' },
  gemini:    { label: 'Google AI Studio',  href: 'https://aistudio.google.com' },
  groq:      { label: 'Groq Console',      href: 'https://console.groq.com' },
  ollama:    null,
}

function fmt(n) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n) }

export default function SettingsPage() {
  const [form, setForm]           = useState({})
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)
  const [testing, setTesting]     = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [ollamaModels, setOllamaModels] = useState(null)
  const [detecting, setDetecting] = useState(false)
  const [geminiModels, setGeminiModels] = useState(null)
  const [detectingGemini, setDetectingGemini] = useState(false)
  const [groqModels, setGroqModels] = useState(null)
  const [detectingGroq, setDetectingGroq] = useState(false)
  const [usage, setUsage]         = useState(null)

  useEffect(() => {
    api.getSettings().then(s => setForm(s))
    api.getUsage().then(setUsage).catch(() => {})
  }, [])

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
    setTestResult(null)
  }

  async function handleSave() {
    setSaving(true)
    const toSave = {}
    for (const [k, v] of Object.entries(form)) {
      if (v && !String(v).startsWith('••••')) toSave[k] = v
      else if (!v) toSave[k] = ''
    }
    await api.saveSettings(toSave)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleTest() {
    // Save first so the test uses the current values
    await handleSave()
    setTesting(true); setTestResult(null)
    try {
      const r = await api.testAI()
      setTestResult({ ok: true, msg: `✓ Connected! Response: "${r.response}"` })
    } catch (e) {
      setTestResult({ ok: false, msg: e.response?.data?.error || e.message })
    }
    setTesting(false)
  }

  async function detectOllama() {
    setDetecting(true)
    const r = await api.getOllamaModels()
    setOllamaModels(r)
    if (r.connected && r.models.length) {
      const preferred = r.models.find(m => m.includes('llama3')) || r.models[0]
      setForm(f => ({ ...f, ollama_model: preferred }))
      await api.saveSettings({ ollama_model: preferred })
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    }
    setDetecting(false)
  }

  const provider = form.ai_provider || 'ollama'
  const pInfo    = PROVIDERS.find(p => p.value === provider)
  const instr    = INSTRUCTIONS[provider]

  return (
    <div className="page max-w-3xl">
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">Configure your AI provider. AI is needed to extract data from uploaded resumes and to generate tailored applications.</p>

      {/* Provider picker */}
      <div className="card mb-5">
        <p className="section-heading">AI Provider</p>
        <div className="grid grid-cols-5 gap-2 mb-5">
          {PROVIDERS.map(p => (
            <button key={p.value}
              onClick={() => { setForm(f => ({ ...f, ai_provider: p.value })); setTestResult(null); setOllamaModels(null) }}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm font-medium transition-colors ${
                provider === p.value
                  ? 'border-brand-500 bg-brand-900/30 text-white'
                  : 'border-gray-800 bg-gray-900 text-gray-500 hover:border-gray-700 hover:text-gray-300'
              }`}>
              <span className="font-semibold text-xs">{p.label}</span>
              <span className={`badge text-xs ${p.colour}`}>{p.tag}</span>
            </button>
          ))}
        </div>

        {/* Setup instructions */}
        {instr && (
          <div className="bg-gray-800 rounded-xl p-4 mb-5">
            <p className="text-xs font-semibold text-white mb-3">How to set up {pInfo?.label}:</p>
            <ol className="space-y-2 mb-3">
              {instr.steps.map(s => (
                <li key={s.n} className="flex gap-3 text-sm text-gray-300">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-brand-700 text-white text-xs flex items-center justify-center font-bold">{s.n}</span>
                  <span>
                    {s.text}
                    {s.link && (
                      <> → <a href={s.link.href} target="_blank" rel="noreferrer"
                        className="text-brand-400 hover:underline">{s.link.label} ↗</a></>
                    )}
                    {s.code && (
                      <code className="block mt-1 bg-gray-950 text-green-400 px-3 py-1.5 rounded text-xs font-mono">{s.code}</code>
                    )}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-gray-500 italic">{instr.note}</p>
          </div>
        )}

        {/* Provider-specific fields */}
        {provider === 'ollama' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label>Ollama Base URL</label>
                <input name="ollama_base_url" value={form.ollama_base_url || ''} onChange={handleChange}
                  placeholder="http://localhost:11434" className="w-full" />
              </div>
              <div>
                <label>Model</label>
                {ollamaModels?.models?.length ? (
                  <select name="ollama_model" value={form.ollama_model || ''} onChange={handleChange} className="w-full">
                    {ollamaModels.models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input name="ollama_model" value={form.ollama_model || ''} onChange={handleChange}
                    placeholder="llama3.1" className="w-full" />
                )}
              </div>
            </div>
            <button onClick={detectOllama} disabled={detecting} className="btn-secondary btn-sm">
              {detecting ? 'Checking…' : '⟳ Auto-detect Models'}
            </button>
            {ollamaModels !== null && (
              <p className={`text-xs ${ollamaModels.connected ? 'text-green-400' : 'text-red-400'}`}>
                {ollamaModels.connected
                  ? `✓ Ollama is running. ${ollamaModels.models.length} model(s) available.`
                  : '✗ Could not connect to Ollama. Make sure it is installed and running.'}
              </p>
            )}
          </div>
        )}

        {provider === 'gemini' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label>Gemini API Key</label>
                <input name="gemini_api_key" type="password" value={form.gemini_api_key || ''} onChange={handleChange}
                  placeholder="AIzaSy…" className="w-full" />
              </div>
              <div>
                <label>Model</label>
                {geminiModels?.models?.length ? (
                  <select name="gemini_model" value={form.gemini_model || ''} onChange={handleChange} className="w-full">
                    {geminiModels.models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <select name="gemini_model" value={form.gemini_model || 'gemini-3.5-flash'} onChange={handleChange} className="w-full">
                    <option value="gemini-3.5-flash">gemini-3.5-flash</option>
                    <option value="gemini-2.5-flash-preview-05-20">gemini-2.5-flash-preview</option>
                    <option value="gemini-2.5-pro-preview-05-06">gemini-2.5-pro-preview</option>
                    <option value="gemini-2.0-flash">gemini-2.0-flash</option>
                    <option value="gemini-2.0-flash-lite">gemini-2.0-flash-lite</option>
                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                  </select>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={async () => {
                setDetectingGemini(true)
                const r = await api.getGeminiModels()
                setGeminiModels(r)
                if (r.ok && r.models.length) {
                  const preferred = r.models.find(m => m.includes('flash') && !m.includes('lite')) || r.models[0]
                  setForm(f => ({ ...f, gemini_model: preferred }))
                  await api.saveSettings({ gemini_model: preferred })
                  setSaved(true); setTimeout(() => setSaved(false), 2000)
                }
                setDetectingGemini(false)
              }} disabled={detectingGemini} className="btn-secondary btn-sm">
                {detectingGemini ? 'Checking…' : '⟳ List Available Models'}
              </button>
              {geminiModels !== null && (
                <p className={`text-xs ${geminiModels.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {geminiModels.ok ? `✓ ${geminiModels.models.length} model(s) found — model auto-saved` : geminiModels.error}
                </p>
              )}
            </div>
            <p className="text-xs text-yellow-600">
              Click "List Available Models" to see exactly which models your API key can access. Model availability varies by region and plan.
            </p>
          </div>
        )}

        {provider === 'groq' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label>Groq API Key</label>
                <input name="groq_api_key" type="password" value={form.groq_api_key || ''} onChange={handleChange}
                  placeholder="gsk_…" className="w-full" />
              </div>
              <div>
                <label>Model</label>
                {groqModels?.models?.length ? (
                  <select name="groq_model" value={form.groq_model || ''} onChange={handleChange} className="w-full">
                    {groqModels.models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <select name="groq_model" value={form.groq_model || 'llama-3.3-70b-versatile'} onChange={handleChange} className="w-full">
                    <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Recommended)</option>
                    <option value="llama-3.1-70b-versatile">llama-3.1-70b-versatile</option>
                    <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Fast)</option>
                    <option value="llama3-70b-8192">llama3-70b-8192</option>
                    <option value="mixtral-8x7b-32768">mixtral-8x7b-32768</option>
                    <option value="gemma2-9b-it">gemma2-9b-it</option>
                    <option value="qwen-qwq-32b">qwen-qwq-32b</option>
                    <option value="deepseek-r1-distill-llama-70b">deepseek-r1-distill-llama-70b</option>
                  </select>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={async () => {
                await handleSave()
                setDetectingGroq(true)
                const r = await api.getGroqModels()
                setGroqModels(r)
                if (r.ok && r.models.length) {
                  const preferred = r.models.find(m => m.includes('llama-3.3-70b')) || r.models.find(m => m.includes('llama')) || r.models[0]
                  setForm(f => ({ ...f, groq_model: preferred }))
                  await api.saveSettings({ groq_model: preferred })
                  setSaved(true); setTimeout(() => setSaved(false), 2000)
                }
                setDetectingGroq(false)
              }} disabled={detectingGroq} className="btn-secondary btn-sm">
                {detectingGroq ? 'Checking…' : '⟳ List Available Models'}
              </button>
              {groqModels !== null && (
                <p className={`text-xs ${groqModels.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {groqModels.ok ? `✓ ${groqModels.models.length} model(s) found — model auto-saved` : groqModels.error}
                </p>
              )}
            </div>
          </div>
        )}

        {provider === 'anthropic' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label>Anthropic API Key</label>
              <input name="anthropic_api_key" type="password" value={form.anthropic_api_key || ''} onChange={handleChange}
                placeholder="sk-ant-…" className="w-full" />
            </div>
            <div>
              <label>Model</label>
              <input name="anthropic_model" value={form.anthropic_model || ''} onChange={handleChange}
                placeholder="claude-sonnet-4-6" className="w-full" />
            </div>
          </div>
        )}

        {provider === 'openai' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label>OpenAI API Key</label>
              <input name="openai_api_key" type="password" value={form.openai_api_key || ''} onChange={handleChange}
                placeholder="sk-…" className="w-full" />
            </div>
            <div>
              <label>Model</label>
              <input name="openai_model" value={form.openai_model || ''} onChange={handleChange}
                placeholder="gpt-4o-mini" className="w-full" />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 items-center mt-4 pt-4 border-t border-gray-800">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
          </button>
          <button onClick={handleTest} disabled={testing || saving} className="btn-secondary">
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
        </div>

        {testResult && (
          <div className={`mt-3 px-4 py-3 rounded-lg text-sm border ${testResult.ok ? 'bg-green-900/30 text-green-300 border-green-800' : 'bg-red-900/30 text-red-300 border-red-800'}`}>
            {testResult.msg}
          </div>
        )}
      </div>

      {/* Usage summary */}
      {usage && (
        <div className="card mb-5">
          <p className="section-heading">Your Usage</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{usage.totalGenerations}</div>
              <div className="text-xs text-gray-500 mt-0.5">Generations</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">{fmt(usage.totalPrompt + usage.totalCompletion)}</div>
              <div className="text-xs text-gray-500 mt-0.5">Total Tokens</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-white">
                {usage.totalCost < 0.01 && usage.totalCost > 0 ? '<$0.01' : usage.totalCost === 0 ? '$0' : `$${usage.totalCost.toFixed(2)}`}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Est. Cost</div>
            </div>
          </div>

          {usage.byProvider.length > 0 && (
            <div className="space-y-2 mb-4">
              {usage.byProvider.map(p => {
                const link = CONSOLE_LINKS[p.provider]
                return (
                  <div key={p.provider} className="flex items-center justify-between text-sm bg-gray-800 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-300 capitalize">{p.provider}</span>
                      <span className="text-xs text-gray-600">{p.generations} gen · {fmt(p.prompt_tokens + p.completion_tokens)} tokens</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {p.cost > 0 && <span className="text-brand-400 text-xs font-medium">${p.cost.toFixed(3)}</span>}
                      {p.cost === 0 && <span className="text-green-500 text-xs">free</span>}
                      {link && (
                        <a href={link.href} target="_blank" rel="noreferrer" className="text-xs text-gray-500 hover:text-brand-400">
                          Check balance ↗
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-xs text-gray-600">Cost estimates are approximate based on standard API pricing. Actual charges may differ — check your provider's billing console for the real balance.</p>
        </div>
      )}

      {/* Cost reference */}
      <div className="card">
        <p className="section-heading">Cost Reference (Claude API)</p>
        <p className="text-xs text-gray-500 mb-3">If you ever switch to a paid Anthropic plan, here's what to expect per resume + cover letter generation (~6k input + 2.5k output tokens):</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: 'Claude Haiku 4.5',  input: '$0.80/M', output: '$4/M',  per: '~$0.015', month20: '~$0.30' },
            { name: 'Claude Sonnet 4.6', input: '$3/M',    output: '$15/M', per: '~$0.056', month20: '~$1.12' },
          ].map(r => (
            <div key={r.name} className="bg-gray-800 rounded-lg p-3 text-xs">
              <div className="font-semibold text-white mb-1">{r.name}</div>
              <div className="text-gray-500">Input: <span className="text-gray-300">{r.input}</span> · Output: <span className="text-gray-300">{r.output}</span></div>
              <div className="text-gray-500 mt-0.5">Per generation: <span className="text-brand-400 font-medium">{r.per}</span></div>
              <div className="text-gray-500">20 applications/month: <span className="text-gray-300">{r.month20}</span></div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-3">Free alternatives: Ollama (completely free, local), Gemini 2.0 Flash (1,500 req/day free), Groq (fast, free tier with rate limits).</p>
      </div>
    </div>
  )
}
