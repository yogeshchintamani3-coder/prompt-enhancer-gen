import { useState, useEffect } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { jwtDecode } from 'jwt-decode'
import './App.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api'

const LANGUAGES = [
  { name: 'English', code: 'en-US' },
  { name: 'Hindi', code: 'hi-IN' },
  { name: 'Marathi', code: 'mr-IN' },
  { name: 'Spanish', code: 'es-ES' },
  { name: 'French', code: 'fr-FR' },
  { name: 'German', code: 'de-DE' },
  { name: 'Chinese', code: 'zh-CN' },
  { name: 'Japanese', code: 'ja-JP' },
  { name: 'Arabic', code: 'ar-SA' },
  { name: 'Russian', code: 'ru-RU' },
  { name: 'Portuguese', code: 'pt-BR' }
]

function App() {
  const [prompt, setPrompt] = useState('')
  const [frontendStack, setFrontendStack] = useState('Angular')
  const [backendStack, setBackendStack] = useState('Java (Spring Boot)')
  const [includeGoogleServices, setIncludeGoogleServices] = useState(true)
  const [includeLogo, setIncludeLogo] = useState(true)
  const [appMode, setAppMode] = useState('architect') // 'architect', 'general', 'jira', 'improver'
  const SCORING_TIPS = `Tips for scoring high:
- Adoption is at an early stage, with initial usage of Google services such as Google Cloud, Firebase, or basic APIs.
- System efficiency indicates higher resource usage, often linked to asset size, processing flow, or dependency weight.
- Early-stage accessibility patterns are visible, with opportunities around structure, navigation flow, and assistive support maturity.
- Code structure reflects foundational patterns, with variation in consistency, organization, and resilience.
- Testing coverage appears limited to core paths, with gaps around edge cases and integration flows.
- Security indicators suggest basic protections are present, with potential exposure points around validation and access control.`;

  const [enhancedPrompt, setEnhancedPrompt] = useState('')
  const [finalPrompt, setFinalPrompt] = useState('');
  const [translatedPrompt, setTranslatedPrompt] = useState('')
  const [targetLang, setTargetLang] = useState('English')
  const [projectData, setProjectData] = useState(null)
  const [chatResponse, setChatResponse] = useState('')
  const [loading, setLoading] = useState({ enhance: false, generate: false, translate: false, listening: false, chat: false })
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [view, setView] = useState('input') // 'input', 'enhanced', 'result', 'chat', 'jira_result'
  const [chatHistory, setChatHistory] = useState([])
  const [user, setUser] = useState(null)
  const [personalApiKey, setPersonalApiKey] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('chatHistory')
    if (saved) {
      try {
        setChatHistory(JSON.parse(saved))
      } catch (e) {
        console.error("Error parsing history")
      }
    }
    const savedKey = localStorage.getItem('personalApiKey')
    if (savedKey) setPersonalApiKey(savedKey)
    const savedUser = localStorage.getItem('userProfile')
    if (savedUser) setUser(JSON.parse(savedUser))
  }, [])

  const handleSetApiKey = (val) => {
    setPersonalApiKey(val)
    localStorage.setItem('personalApiKey', val)
  }

  const handleLoginSuccess = (credentialResponse) => {
    const decoded = jwtDecode(credentialResponse.credential)
    setUser(decoded)
    localStorage.setItem('userProfile', JSON.stringify(decoded))
    showToast(`Welcome, ${decoded.name}!`)
  }

  const handleLogout = () => {
    setUser(null)
    setPersonalApiKey('')
    localStorage.removeItem('userProfile')
    localStorage.removeItem('personalApiKey')
  }

  const getHeaders = () => {
    const headers = { 'Content-Type': 'application/json' }
    if (personalApiKey) headers['x-api-key'] = personalApiKey
    return headers
  }

  const saveToHistory = (title, type, contentData) => {
    const newItem = { id: Date.now(), title, type, contentData, date: new Date().toLocaleDateString() }
    const updated = [newItem, ...chatHistory]
    setChatHistory(updated)
    localStorage.setItem('chatHistory', JSON.stringify(updated))
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  const handleEnhance = async () => {
    setLoading(prev => ({ ...prev, enhance: true }))
    setError(null)
    try {
      const fullPrompt = `${SCORING_TIPS}\n${prompt}`;
      setFinalPrompt(fullPrompt);
      const response = await fetch(`${API_BASE}/enhance-prompt`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ prompt: fullPrompt, frontendStack, backendStack, includeGoogleServices, includeLogo })
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setEnhancedPrompt(data.enhancedPrompt)
      setView('enhanced')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(prev => ({ ...prev, enhance: false }))
    }
  }

  const handleGenerate = async () => {
    setLoading(prev => ({ ...prev, generate: true }))
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/generate-project`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ enhancedPrompt, frontendStack, backendStack, includeGoogleServices, includeLogo })
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setProjectData(data)
      setView('result')
      saveToHistory(prompt.slice(0, 30) + '...', 'architect', data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(prev => ({ ...prev, generate: false }))
    }
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    showToast('Copied to clipboard!')
  }

  const handleSpeak = (lang) => {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const cleanText = (translatedPrompt || enhancedPrompt)
      .replace(/[#*_~`\[\]()]/g, '') // Remove markdown special characters
      .replace(/[-+]/g, ' ') // Replace bullets/plus with space
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText)

    // Explicitly set language
    const currentLangCode = translatedPrompt ?
      (LANGUAGES.find(l => l.name === targetLang)?.code || 'en-US') :
      'en-US';

    utterance.lang = currentLangCode;

    // Get all voices
    let voices = window.speechSynthesis.getVoices()

    // If voices aren't loaded yet, try to wait a bit
    if (voices.length === 0) {
      setTimeout(() => {
        voices = window.speechSynthesis.getVoices()
        startSpeaking(utterance, voices, currentLangCode)
      }, 100)
    } else {
      startSpeaking(utterance, voices, currentLangCode)
    }
  }

  const startSpeaking = (utterance, voices, langCode) => {
    // Find a matching voice if possible
    const matchingVoice = voices.find(v => v.lang.includes(langCode) || v.lang.replace('_', '-').includes(langCode))

    if (matchingVoice) {
      utterance.voice = matchingVoice
    } else {
      console.warn(`No specific voice found for ${lang}, using default.`)
    }

    utterance.rate = 1.0
    utterance.pitch = 1.0
    window.speechSynthesis.speak(utterance)
  }

  const handleStop = () => {
    window.speechSynthesis.cancel()
  }

  const handleTranslate = async () => {
    setLoading(prev => ({ ...prev, translate: true }))
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/translate-prompt`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ prompt: enhancedPrompt, targetLanguage: targetLang })
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setTranslatedPrompt(data.translatedText)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(prev => ({ ...prev, translate: false }))
    }
  }

  const handleVoiceTyping = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Your browser does not support voice typing.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setLoading(prev => ({ ...prev, listening: true }));
    recognition.onend = () => setLoading(prev => ({ ...prev, listening: false }));
    recognition.onerror = () => setLoading(prev => ({ ...prev, listening: false }));

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setPrompt(prev => prev + (prev ? " " : "") + transcript);
    };

    recognition.start();
  }

  const handleGeneralChat = async () => {
    setLoading(prev => ({ ...prev, chat: true }))
    setError(null)
    setProjectData(null)
    setEnhancedPrompt('')
    try {
      const response = await fetch(`${API_BASE}/general-chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ prompt })
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setChatResponse(data.response)
      setView('chat')
      saveToHistory(prompt.slice(0, 30) + '...', 'chat', data.response)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(prev => ({ ...prev, chat: false }))
    }
  }

  const handleJiraMode = async () => {
    setLoading(prev => ({ ...prev, chat: true }))
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/jira-prompt`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ ticketDetails: prompt })
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setChatResponse(data.enhancedPrompt)
      setView('chat')
      saveToHistory('Jira: ' + prompt.slice(0, 20) + '...', 'jira', data.enhancedPrompt)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(prev => ({ ...prev, chat: false }))
    }
  }

  const handleImproveMode = async () => {
    setLoading(prev => ({ ...prev, chat: true }))
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/improve-prompt`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ prompt })
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setChatResponse(data.improvedPrompt)
      setView('chat')
      saveToHistory('Improved: ' + prompt.slice(0, 20) + '...', 'improver', data.improvedPrompt)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(prev => ({ ...prev, chat: false }))
    }
  }

  const loadHistoryItem = (item) => {
    if (item.type === 'chat' || item.type === 'jira' || item.type === 'improver') {
      setAppMode(item.type === 'jira' ? 'jira' : (item.type === 'improver' ? 'improver' : 'general'))
      setChatResponse(item.contentData)
      setView('chat')
    } else {
      setAppMode('architect')
      setProjectData(item.contentData)
      setView('result')
    }
  }

  const startNewChat = () => {
    setView('input')
    setPrompt('')
    setEnhancedPrompt('')
    setChatResponse('')
    setProjectData(null)
  }

  return (
    <div className="layout-container">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <button className="new-chat-btn" onClick={startNewChat}>
          <span style={{ fontSize: '1.2rem' }}>+</span> New Chat
        </button>

        <div className="history-list">
          <p className="history-title">Recent History</p>
          {chatHistory.map(item => (
            <div key={item.id} className="history-item" onClick={() => loadHistoryItem(item)}>
              <span className="history-icon">
                {item.type === 'chat' ? '💬' : item.type === 'improver' ? '✨' : '🏗️'}
              </span>
              <span className="history-text">{item.title}</span>
            </div>
          ))}
        </div>

        <div className="extensions-section" style={{ padding: '1rem', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
          <p className="history-title" style={{ marginBottom: '0.75rem' }}>🔌 Extensions</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <a href="/extensions/browser-extension.zip" download className="history-item" style={{ fontSize: '0.75rem', textDecoration: 'none', color: 'inherit' }}>
              <span className="history-icon">🌐</span> Browser Extension (.zip)
            </a>
            <a href="/extensions/cursor-extension.vsix" download className="history-item" style={{ fontSize: '0.75rem', textDecoration: 'none', color: 'inherit' }}>
              <span className="history-icon">🖱️</span> Cursor Extension (.vsix)
            </a>
          </div>
        </div>

        <div className="user-profile" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          {!user ? (
            <GoogleLogin
              onSuccess={handleLoginSuccess}
              onError={() => showToast('Login Failed')}
              theme="filled_black"
              shape="pill"
            />
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', marginBottom: '0.5rem' }}>
                <img src={user.picture} alt="Profile" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                <div className="user-info">
                  <span className="user-name" style={{ fontSize: '0.8rem' }}>{user.name}</span>
                  <span className="user-plan" style={{ fontSize: '0.65rem', cursor: 'pointer' }} onClick={handleLogout}>Logout</span>
                </div>
              </div>
              <input
                type="password"
                placeholder="Paste Gemini API Key..."
                value={personalApiKey}
                onChange={(e) => handleSetApiKey(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.75rem', background: 'rgba(0,0,0,0.3)' }}
                title="Used locally to bypass server rate limits"
              />
            </>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {toast && (
          <div className="toast">
            {toast}
          </div>
        )}

        <header className="header-simple">
          <div className="mode-toggle">
            <span
              className={appMode === 'architect' ? 'active' : ''}
              onClick={() => { setAppMode('architect'); startNewChat(); }}
            >Architect</span>
            <span
              className={appMode === 'general' ? 'active' : ''}
              onClick={() => { setAppMode('general'); startNewChat(); }}
            >General AI</span>
            <span
              className={appMode === 'jira' ? 'active' : ''}
              onClick={() => { setAppMode('jira'); startNewChat(); }}
            >Jira Assistant</span>
            <span
              className={appMode === 'improver' ? 'active' : ''}
              onClick={() => { setAppMode('improver'); startNewChat(); }}
            >Prompt Improver</span>
          </div>
        </header>

        <div className="content-scroll">
          {error && <div style={{ background: '#ef4444', color: 'white', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}

          {/* VIEW 1: INPUT SCREEN */}
          {view === 'input' && (
            <section className="card" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
              <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>
                    {appMode === 'architect' && 'Project Requirement'}
                    {appMode === 'general' && 'Ask Anything'}
                    {appMode === 'jira' && 'Jira Ticket / Bug Details'}
                    {appMode === 'improver' && 'Simple Prompt to Improve'}
                  </label>
                  <button
                    onClick={handleVoiceTyping}
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: loading.listening ? '#ef4444' : 'var(--accent)' }}
                  >
                    {loading.listening ? 'Listening...' : '🎤 Talk to Write'}
                  </button>
                </div>
                <textarea
                  placeholder={
                    appMode === 'architect' ? "E.g., Build a personal finance tracker..." :
                      appMode === 'jira' ? "Paste your Jira ticket description or bug logs here..." :
                        appMode === 'improver' ? "Paste your simple prompt here (e.g., write a story about a cat)..." :
                          "Type your message here..."
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={loading.enhance || loading.generate || loading.chat}
                />
              </div>

              {appMode === 'architect' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="input-group">
                      <label>Frontend Stack</label>
                      <select value={frontendStack} onChange={(e) => setFrontendStack(e.target.value)}>
                        <option value="React">React</option>
                        <option value="Angular">Angular</option>
                        <option value="Vue.js">Vue.js</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label>Backend Stack</label>
                      <select value={backendStack} onChange={(e) => setBackendStack(e.target.value)}>
                        <option value="Node.js">Node.js</option>
                        <option value="Python (FastAPI/Flask)">Python</option>
                        <option value="Java (Spring Boot)">Java</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input type="checkbox" id="google-toggle" checked={includeGoogleServices} onChange={(e) => setIncludeGoogleServices(e.target.checked)} />
                    <label htmlFor="google-toggle">Include Google Services & Security</label>
                  </div>

                  <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <input type="checkbox" id="logo-toggle" checked={includeLogo} onChange={(e) => setIncludeLogo(e.target.checked)} />
                    <label htmlFor="logo-toggle">Generate Logo & Branding</label>
                  </div>
                </>
              )}

              <div className="actions">
                <button
                  onClick={
                    appMode === 'architect' ? handleEnhance :
                      appMode === 'jira' ? handleJiraMode :
                        appMode === 'improver' ? handleImproveMode :
                          handleGeneralChat
                  }
                  disabled={!prompt || loading.enhance || loading.chat}
                >
                  {(loading.enhance || loading.chat) && <span className="loading-spinner"></span>}
                  {appMode === 'architect' ? (loading.enhance ? 'Enhancing...' : 'Generate Prompt') :
                    appMode === 'jira' ? (loading.chat ? 'Analyzing Ticket...' : 'Analyze Ticket') :
                      appMode === 'improver' ? (loading.chat ? 'Improving Prompt...' : 'Improve Prompt ✨') :
                        (loading.chat ? 'Thinking...' : 'Ask AI')}
                </button>
              </div>
            </section>
          )}

          {/* VIEW 2: ENHANCED PROMPT SCREEN */}
          {view === 'enhanced' && enhancedPrompt && (
            <section className="card" style={{ animation: 'fadeInRight 0.4s ease-out' }}>
              <button onClick={() => setView('input')} style={{ background: 'transparent', border: '1px solid var(--border)', marginBottom: '1rem', padding: '0.4rem 1rem' }}>← Back</button>

              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label>Enhanced Super Prompt</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleCopy(enhancedPrompt)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'var(--primary)' }}>Copy</button>
                    <button onClick={() => handleSpeak()} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'var(--accent)' }}>Listen</button>
                    <button onClick={handleStop} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: '#ef4444' }}>Stop</button>
                  </div>
                </div>

                {/* Translation Dropdown */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} style={{ flex: 1, padding: '0.4rem' }}>
                    {LANGUAGES.map(l => (
                      <option key={l.code} value={l.name}>{l.name}</option>
                    ))}
                  </select>
                  <button onClick={handleTranslate} disabled={loading.translate} style={{ background: 'var(--secondary)' }}>Translate</button>
                </div>

                <div className="enhanced-prompt-area" style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '1.5rem' }}>
                  {translatedPrompt || enhancedPrompt}
                </div>

                <div className="final-prompt-section" style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.1)', padding: '0.8rem', borderRadius: '6px' }}>
                  <strong>Final Prompt Sent:</strong>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginTop: '0.5rem' }}>{finalPrompt}</pre>
                </div>
              </div>

              <div className="actions">
                <button onClick={handleGenerate} disabled={loading.generate} style={{ width: '100%', justifyContent: 'center' }}>
                  {loading.generate && <span className="loading-spinner"></span>}
                  {loading.generate ? 'Architecting Project...' : 'Generate Full Project Blueprint'}
                </button>
              </div>
            </section>
          )}

          {/* VIEW 3: PROJECT RESULT SCREEN */}
          {view === 'result' && projectData && (
            <section className="project-data" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
              <button onClick={() => setView('enhanced')} style={{ background: 'transparent', border: '1px solid var(--border)', marginBottom: '1.5rem', padding: '0.4rem 1rem' }}>← Back to Prompt</button>

              <div className="card">
                <h3>Design Specifications (Figma Style)</h3>
                <div className="enhanced-prompt-area" style={{ fontSize: '0.9rem' }}>
                  {typeof projectData.designSpecs === 'string' ? projectData.designSpecs : JSON.stringify(projectData.designSpecs, null, 2)}
                </div>
              </div>

              {projectData.logoDesign && (
                <div className="card" style={{ borderColor: 'var(--accent)' }}>
                  <h3>Logo & Branding Concept</h3>
                  <div className="enhanced-prompt-area">{projectData.logoDesign}</div>
                </div>
              )}

              <div className="card">
                <h3>Project Structure & Files</h3>
                <ul className="file-tree">
                  {projectData.projectStructure.map((item, idx) => <li key={idx}>{item}</li>)}
                </ul>
              </div>

              <div className="card">
                <h3>Full Documentation</h3>
                <div className="enhanced-prompt-area">{projectData.documentation}</div>
                <button onClick={() => handleCopy(projectData.documentation)} style={{ marginTop: '1rem', width: '100%', justifyContent: 'center' }}>Copy Full README</button>
              </div>
            </section>
          )}

          {/* VIEW 4: CHAT SCREEN */}
          {view === 'chat' && chatResponse && (
            <section className="card chat-result" style={{ animation: 'fadeInUp 0.4s ease-out' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <label style={{ color: 'var(--accent)', fontWeight: '700' }}>AI Response</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleCopy(chatResponse)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'var(--primary)' }}>Copy</button>
                  <button onClick={handleStop} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: '#ef4444' }}>Stop</button>
                </div>
              </div>
              <div className="enhanced-prompt-area" style={{ minHeight: '400px' }}>{chatResponse}</div>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
