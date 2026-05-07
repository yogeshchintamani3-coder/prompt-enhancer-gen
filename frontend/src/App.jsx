import { useState, useEffect } from 'react'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { auth, googleProvider, saveUserKeys, loadUserKeys } from './firebase'
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
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [groqApiKey, setGroqApiKey] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [image, setImage] = useState(null) // base64 string
  const [mimeType, setMimeType] = useState('image/png')

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
    const savedOpenAI = localStorage.getItem('openaiApiKey')
    if (savedOpenAI) setOpenaiApiKey(savedOpenAI)
    const savedGroq = localStorage.getItem('groqApiKey')
    if (savedGroq) setGroqApiKey(savedGroq)

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          name: firebaseUser.displayName,
          email: firebaseUser.email,
          picture: firebaseUser.photoURL
        })
        // Auto-load API keys from Firestore
        const keys = await loadUserKeys(firebaseUser.uid)
        if (keys) {
          if (keys.geminiKey) { setPersonalApiKey(keys.geminiKey); localStorage.setItem('personalApiKey', keys.geminiKey) }
          if (keys.openaiKey) { setOpenaiApiKey(keys.openaiKey); localStorage.setItem('openaiApiKey', keys.openaiKey) }
          if (keys.groqKey) { setGroqApiKey(keys.groqKey); localStorage.setItem('groqApiKey', keys.groqKey) }
        }
      } else {
        setUser(null)
      }
    })
    return () => unsubscribe()
  }, [])

  const handleSetApiKey = (val) => {
    setPersonalApiKey(val)
    localStorage.setItem('personalApiKey', val)
    // Sync to Firestore if signed in
    if (auth.currentUser) saveUserKeys(auth.currentUser.uid, { geminiKey: val, openaiKey: openaiApiKey, groqKey: groqApiKey })
  }

  const handleSetOpenaiKey = (val) => {
    setOpenaiApiKey(val)
    localStorage.setItem('openaiApiKey', val)
    if (auth.currentUser) saveUserKeys(auth.currentUser.uid, { geminiKey: personalApiKey, openaiKey: val, groqKey: groqApiKey })
  }

  const handleSetGroqKey = (val) => {
    setGroqApiKey(val)
    localStorage.setItem('groqApiKey', val)
    if (auth.currentUser) saveUserKeys(auth.currentUser.uid, { geminiKey: personalApiKey, openaiKey: openaiApiKey, groqKey: val })
  }

  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      showToast(`Welcome, ${result.user.displayName}!`)
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        showToast('Sign in failed: ' + (err.message || 'Unknown error'))
      }
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    setUser(null)
    setPersonalApiKey('')
    setOpenaiApiKey('')
    setGroqApiKey('')
    localStorage.removeItem('personalApiKey')
    localStorage.removeItem('openaiApiKey')
    localStorage.removeItem('groqApiKey')
  }

  const getHeaders = () => {
    const headers = { 'Content-Type': 'application/json' }
    if (personalApiKey) headers['x-api-key'] = personalApiKey
    if (openaiApiKey) headers['x-openai-key'] = openaiApiKey
    if (groqApiKey) headers['x-groq-key'] = groqApiKey
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

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Image size should be less than 5MB")
        return
      }
      setMimeType(file.type)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImage(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImage(null)
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
        body: JSON.stringify({ prompt: fullPrompt, frontendStack, backendStack, includeGoogleServices, includeLogo, image, mimeType })
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
        body: JSON.stringify({ enhancedPrompt, frontendStack, backendStack, includeGoogleServices, includeLogo, image, mimeType })
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

  const handleSpeak = (textToSpeak) => {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel()

    const text = typeof textToSpeak === 'string' ? textToSpeak : (translatedPrompt || enhancedPrompt);
    const cleanText = text
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

  const handleTranslate = async (textToTranslate = enhancedPrompt, isChat = false) => {
    setLoading(prev => ({ ...prev, translate: true }))
    setError(null)
    try {
      const response = await fetch(`${API_BASE}/translate-prompt`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ prompt: textToTranslate, targetLanguage: targetLang })
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      
      if (isChat) {
        setChatResponse(data.translatedText)
      } else {
        setTranslatedPrompt(data.translatedText)
      }
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
        body: JSON.stringify({ prompt, image, mimeType })
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
        body: JSON.stringify({ ticketDetails: prompt, image, mimeType })
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
        body: JSON.stringify({ prompt, image, mimeType })
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
            <button
              onClick={handleGoogleSignIn}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.6rem 1rem', border: '1px solid var(--border)',
                borderRadius: '24px', background: 'rgba(255,255,255,0.05)',
                cursor: 'pointer', color: 'inherit', fontSize: '0.8rem',
                width: '100%', justifyContent: 'center', transition: 'all 0.2s'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Sign in with Google
            </button>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', marginBottom: '0.5rem' }}>
                <img src={user.picture} alt="Profile" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                <div className="user-info">
                  <span className="user-name" style={{ fontSize: '0.8rem' }}>{user.name}</span>
                  <span className="user-plan" style={{ fontSize: '0.65rem', cursor: 'pointer' }} onClick={handleLogout}>Logout</span>
                </div>
              </div>
              <p
                style={{ fontSize: '0.6rem', color: 'var(--text-muted)', cursor: 'pointer', margin: '0.25rem 0', userSelect: 'none' }}
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? '\u25BE Advanced Settings' : '\u25B8 Advanced Settings'}
              </p>
              {showAdvanced && (
                <>
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', margin: '0.15rem 0' }}>Optional: use your own keys for higher quotas</p>
                  <input
                    type="password"
                    placeholder="Gemini API Key (AIza...)"
                    value={personalApiKey}
                    onChange={(e) => handleSetApiKey(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', fontSize: '0.7rem', background: 'rgba(0,0,0,0.3)', marginBottom: '0.3rem', borderRadius: '4px', border: personalApiKey ? '1px solid #4caf50' : '1px solid var(--border)' }}
                    title="Google Gemini API key from aistudio.google.com"
                  />
                  <input
                    type="password"
                    placeholder="OpenAI Key (sk-...)"
                    value={openaiApiKey}
                    onChange={(e) => handleSetOpenaiKey(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', fontSize: '0.7rem', background: 'rgba(0,0,0,0.3)', marginBottom: '0.3rem', borderRadius: '4px', border: openaiApiKey ? '1px solid #4caf50' : '1px solid var(--border)' }}
                    title="OpenAI API key from platform.openai.com"
                  />
                  <input
                    type="password"
                    placeholder="Groq Key (gsk_...)"
                    value={groqApiKey}
                    onChange={(e) => handleSetGroqKey(e.target.value)}
                    style={{ width: '100%', padding: '0.4rem', fontSize: '0.7rem', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', border: groqApiKey ? '1px solid #4caf50' : '1px solid var(--border)' }}
                    title="Groq API key from console.groq.com (free)"
                  />
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-muted)', margin: '0.3rem 0 0', opacity: 0.7 }}>
                    {personalApiKey || openaiApiKey || groqApiKey ? '\u2713 Using your keys' : 'Server AI keys active'}
                  </p>
                </>
              )}
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
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      onClick={handleVoiceTyping}
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: loading.listening ? '#ef4444' : 'var(--accent)', border: 'none', borderRadius: '4px', cursor: 'pointer', color: 'white' }}
                    >
                      {loading.listening ? 'Listening...' : '🎤 Talk to Write'}
                    </button>
                    <label style={{ cursor: 'pointer', fontSize: '1.2rem' }} title="Upload Image/Screenshot">
                      📷
                      <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                    </label>
                  </div>
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
                {image && (
                  <div style={{ position: 'relative', marginTop: '0.5rem', width: '100px' }}>
                    <img src={image} alt="Preview" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }} />
                    <button 
                      onClick={removeImage}
                      style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px' }}
                    >✕</button>
                  </div>
                )}
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
              <button onClick={() => setView('input')} style={{ background: 'transparent', border: '1px solid var(--border)', marginBottom: '1rem', padding: '0.4rem 1rem' }}>← Back</button>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <label style={{ color: 'var(--accent)', fontWeight: '700' }}>AI Response</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleCopy(chatResponse)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'var(--primary)' }}>Copy</button>
                  <button onClick={() => handleSpeak(chatResponse)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', background: 'var(--accent)' }}>Listen</button>
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
                <button onClick={() => handleTranslate(chatResponse, true)} disabled={loading.translate} style={{ background: 'var(--secondary)' }}>Translate</button>
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
