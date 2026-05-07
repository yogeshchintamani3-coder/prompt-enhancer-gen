const vscode = require('vscode');

const BACKEND_URL = 'https://prompt-enhancer-backend-vfkc.onrender.com';

// Firebase config — same project as the web app
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyB1cPI1CiSt7dbdZ5MyxTMmYZmpvnoYVBU",
    authDomain: "prompt-enhancer-ai-gen.firebaseapp.com",
    projectId: "prompt-enhancer-ai-gen",
    storageBucket: "prompt-enhancer-ai-gen.firebasestorage.app",
    messagingSenderId: "72198722809",
    appId: "1:72198722809:web:353d4296e249bf1d0afe28"
};

// In-memory session (backed by globalState for persistence)
let currentUser  = null;
let currentApiKey = null;
let settingsPanel = null;

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVATE
// ─────────────────────────────────────────────────────────────────────────────
function activate(context) {
    console.log('✨ Prompt Enhancer is now active!');

    // Restore saved session
    currentUser   = context.globalState.get('pe_user')    || null;
    currentApiKey = context.globalState.get('pe_api_key') || null;

    // Status bar item
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.command = 'prompt-enhancer.enhance';
    statusBar.tooltip = 'AI Prompt Enhancer — click to enhance selected text';
    refreshStatusBar(statusBar);
    statusBar.show();
    context.subscriptions.push(statusBar);

    // Command: Enhance
    context.subscriptions.push(
        vscode.commands.registerCommand('prompt-enhancer.enhance', () =>
            runEnhance(context, statusBar)
        )
    );

    // Command: Settings / Sign-in panel
    context.subscriptions.push(
        vscode.commands.registerCommand('prompt-enhancer.settings', () =>
            openSettingsPanel(context, statusBar)
        )
    );
}

function refreshStatusBar(bar) {
    if (currentUser) {
        const firstName = currentUser.name.split(' ')[0];
        bar.text = `$(sparkle) Enhance  $(account) ${firstName}`;
    } else {
        bar.text = '$(sparkle) Enhance Prompt';
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENHANCE COMMAND
// ─────────────────────────────────────────────────────────────────────────────
async function runEnhance(context, statusBar) {
    let text = getSelectedText();

    // Only use selected text — no input box
    if (!text) {
        vscode.window.showInformationMessage('✨ Select some text first, then click Enhance.');
        return;
    }

    text = text.trim();

    // Warn if selection looks like code
    if (looksLikeCode(text)) {
        const pick = await vscode.window.showWarningMessage(
            '⚠️ The selected text looks like code, not a prompt. Enhance anyway?',
            'Yes, enhance it',
            'Cancel'
        );
        if (pick !== 'Yes, enhance it') return;
    }

    // Nudge to add API key if missing
    if (!currentApiKey) {
        const pick = await vscode.window.showInformationMessage(
            '💡 Add your Gemini API key for faster, unlimited responses.',
            'Add Key',
            'Continue Anyway'
        );
        if (pick === 'Add Key') {
            openSettingsPanel(context, statusBar);
            return;
        }
    }

    // Call backend
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: '✨ Building your Master Prompt…',
        cancellable: false
    }, async () => {
        try {
            // Use native fetch (Node 18+ / Electron)

            const headers = { 'Content-Type': 'application/json' };
            if (currentApiKey) headers['x-api-key'] = currentApiKey;

            const res = await fetch(`${BACKEND_URL}/api/improve-prompt`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ prompt: text })
            });

            if (!res.ok) {
                const e = await res.json().catch(() => ({}));
                throw new Error(e.error || `Server error ${res.status}`);
            }

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            const master = data.improvedPrompt;

            // Copy to clipboard automatically
            await vscode.env.clipboard.writeText(master);

            // Open the markdown document in a side column
            const doc = await vscode.workspace.openTextDocument({
                content: buildOutputDoc(text, master),
                language: 'markdown'
            });
            const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside, { preview: true });

            // Auto-open rendered Markdown Preview beside the raw doc
            try {
                await vscode.commands.executeCommand('markdown.showPreviewToSide', doc.uri);
            } catch (_) {
                // If preview command isn't available, the raw doc is still open — no problem
            }

            // Offer toggle buttons in notification
            const choice = await vscode.window.showInformationMessage(
                '✅ Master Prompt copied to clipboard!',
                'Show Preview',
                'Show Raw',
                'Copy Again'
            );
            if (choice === 'Show Preview') {
                try { await vscode.commands.executeCommand('markdown.showPreviewToSide', doc.uri); } catch (_) {}
            } else if (choice === 'Show Raw') {
                await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            } else if (choice === 'Copy Again') {
                await vscode.env.clipboard.writeText(master);
                vscode.window.showInformationMessage('📋 Copied again!');
            }

        } catch (err) {
            vscode.window.showErrorMessage(`Prompt Enhancer: ${err.message}`);
        }
    });
}

function getSelectedText() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return '';
    const sel = editor.selection;
    if (sel.isEmpty) return '';
    return editor.document.getText(new vscode.Range(sel.start, sel.end)).trim();
}

function looksLikeCode(t) {
    return [
        /^(import|export|const|let|var|function|class|def|return|if|for|while)\s/m,
        /[{};]\s*$/m,
        /^\s*(\/\/|#|\/\*|\*)/m,
        /\b(console\.log|print\(|System\.out)\b/
    ].some(r => r.test(t));
}

function buildOutputDoc(original, master) {
    return [
        '# ✨ AI Master Prompt',
        '',
        '---',
        '',
        '## Your Original Input',
        '',
        '> ' + original.replace(/\n/g, '\n> '),
        '',
        '---',
        '',
        '## Master Prompt  _(paste this into any AI)_',
        '',
        master,
        '',
        '---',
        '',
        '_Generated by **AI Prompt Enhancer** for Cursor_'
    ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PANEL  (Firebase Google Sign-in lives here inside the webview)
// ─────────────────────────────────────────────────────────────────────────────
function openSettingsPanel(context, statusBar) {
    if (settingsPanel) {
        settingsPanel.reveal(vscode.ViewColumn.One);
        // Refresh state
        settingsPanel.webview.postMessage({
            command: 'syncState',
            user: currentUser,
            apiKey: currentApiKey
        });
        return;
    }

    settingsPanel = vscode.window.createWebviewPanel(
        'promptEnhancerSettings',
        '✨ Prompt Enhancer Settings',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            // Allow Firebase CDN
            localResourceRoots: []
        }
    );

    settingsPanel.webview.html = buildSettingsHTML(FIREBASE_CONFIG, currentUser, currentApiKey);

    // Messages from webview → extension
    settingsPanel.webview.onDidReceiveMessage(async (msg) => {
        switch (msg.command) {

            // Firebase sign-in succeeded in the webview
            case 'signedIn': {
                currentUser   = msg.user;   // { name, email, picture, uid }
                currentApiKey = msg.apiKey || currentApiKey;
                context.globalState.update('pe_user',    currentUser);
                context.globalState.update('pe_api_key', currentApiKey);
                refreshStatusBar(statusBar);
                vscode.window.showInformationMessage(`Welcome, ${currentUser.name}! 🎉`);
                break;
            }

            case 'signedOut': {
                currentUser   = null;
                currentApiKey = null;
                context.globalState.update('pe_user',    null);
                context.globalState.update('pe_api_key', null);
                refreshStatusBar(statusBar);
                vscode.window.showInformationMessage('Signed out.');
                break;
            }

            case 'saveApiKey': {
                currentApiKey = msg.apiKey || null;
                context.globalState.update('pe_api_key', currentApiKey);
                refreshStatusBar(statusBar);
                if (currentApiKey) {
                    vscode.window.showInformationMessage('✅ API Key saved!');
                }
                break;
            }

            case 'testApiKey': {
                await doTestApiKey(msg.apiKey);
                break;
            }

            case 'openExternal': {
                vscode.env.openExternal(vscode.Uri.parse(msg.url));
                break;
            }
        }
    }, undefined, context.subscriptions);

    settingsPanel.onDidDispose(() => { settingsPanel = null; }, null, context.subscriptions);
}

async function doTestApiKey(apiKey) {
    try {
        // Use native fetch (Node 18+ / Electron)
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['x-api-key'] = apiKey;
        const res  = await fetch(`${BACKEND_URL}/api/improve-prompt`, {
            method: 'POST', headers,
            body: JSON.stringify({ prompt: 'test connection ping' })
        });
        const data = await res.json();
        if (data.improvedPrompt) {
            vscode.window.showInformationMessage('✅ Connection successful — API key works!');
        } else {
            vscode.window.showWarningMessage('⚠️ Unexpected response: ' + JSON.stringify(data).slice(0, 120));
        }
    } catch (err) {
        vscode.window.showErrorMessage('❌ Test failed: ' + err.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// WEBVIEW HTML — Firebase SDK loaded from CDN, full Google sign-in in-panel
// ─────────────────────────────────────────────────────────────────────────────
function buildSettingsHTML(firebaseCfg, user, apiKey) {
    const cfgJson   = JSON.stringify(firebaseCfg);
    const userJson  = JSON.stringify(user || null);
    const savedKey  = apiKey || '';
    const maskedKey = apiKey ? apiKey.slice(0, 8) + '••••••••••' : '';

    return /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Prompt Enhancer Settings</title>

  <!-- Firebase v10 CDN (compat layer — works without bundler) -->
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>

  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>

  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: linear-gradient(135deg, #0f0c29 0%, #302b63 55%, #24243e 100%);
      min-height: 100vh; color: #e2e8f0; padding: 2rem 1.5rem;
    }
    .wrap { max-width: 560px; margin: auto; }

    /* Header */
    .hd { text-align: center; margin-bottom: 2.5rem; }
    .hd .icon { font-size: 3.5rem; }
    .hd h1 {
      font-size: 1.7rem; font-weight: 700;
      background: linear-gradient(90deg, #a78bfa, #60a5fa);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      margin: .4rem 0 .2rem;
    }
    .hd p { color: #94a3b8; font-size: .83rem; }

    /* Card */
    .card {
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 16px; padding: 1.5rem; margin-bottom: 1.4rem;
      backdrop-filter: blur(12px); transition: border-color .2s;
    }
    .card:hover { border-color: rgba(167,139,250,.35); }
    .card-title {
      font-size: .88rem; font-weight: 600; color: #a78bfa;
      margin-bottom: 1.1rem; display: flex; align-items: center; gap: .4rem;
    }

    /* Google button */
    .g-btn {
      display: flex; align-items: center; justify-content: center; gap: .75rem;
      width: 100%; padding: .85rem 1.5rem;
      background: #fff; color: #374151;
      border: none; border-radius: 10px;
      font-size: .95rem; font-weight: 600;
      cursor: pointer; transition: all .2s; font-family: inherit;
    }
    .g-btn:hover {
      background: #f3f4f6; transform: translateY(-1px);
      box-shadow: 0 6px 24px rgba(0,0,0,.35);
    }
    .g-btn:disabled { opacity: .6; cursor: default; transform: none; }

    /* User row */
    .user-row { display: flex; align-items: center; gap: 1rem; }
    .avatar {
      width: 52px; height: 52px; border-radius: 50%;
      border: 2px solid #a78bfa; object-fit: cover; flex-shrink: 0;
    }
    .avatar-init {
      width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0;
      background: linear-gradient(135deg,#a78bfa,#60a5fa);
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 1.3rem; color: #fff;
    }
    .user-info { flex: 1; }
    .user-name { font-weight: 600; font-size: 1rem; display: block; }
    .user-email { font-size: .75rem; color: #94a3b8; margin-top: .15rem; display: block; }
    .badge {
      display: inline-flex; align-items: center; gap: .25rem; margin-top: .35rem;
      background: rgba(74,222,128,.15); border: 1px solid rgba(74,222,128,.4);
      color: #4ade80; font-size: .68rem; padding: .18rem .6rem; border-radius: 100px;
    }

    /* Input */
    .lbl { display: block; font-size: .78rem; color: #94a3b8; margin-bottom: .45rem; }
    .inp-row { display: flex; gap: .5rem; }
    input[type=password], input[type=text] {
      flex: 1; padding: .72rem 1rem;
      background: rgba(0,0,0,.3); border: 1px solid rgba(255,255,255,.15);
      border-radius: 10px; color: #e2e8f0; font-size: .85rem;
      font-family: monospace; outline: none; transition: border-color .2s;
    }
    input:focus { border-color: #a78bfa; }
    input.ok   { border-color: rgba(74,222,128,.6); }

    /* Buttons */
    .btn {
      padding: .72rem 1.1rem; border: none; border-radius: 10px;
      font-size: .8rem; font-weight: 600; cursor: pointer;
      transition: all .2s; font-family: inherit; white-space: nowrap;
    }
    .btn-primary {
      background: linear-gradient(135deg,#a78bfa,#60a5fa); color: #fff;
    }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(167,139,250,.45); }
    .btn-ghost {
      background: transparent; border: 1px solid rgba(255,255,255,.15); color: #94a3b8;
    }
    .btn-ghost:hover { border-color: #ef4444; color: #ef4444; }
    .btn-sm { padding: .45rem .85rem; font-size: .74rem; }

    .hint { font-size: .71rem; color: #64748b; margin-top: .4rem; line-height: 1.5; }
    .hint span { color: #a78bfa; cursor: pointer; }

    /* Steps */
    .steps { list-style: none; }
    .steps li {
      display: flex; gap: .7rem; align-items: flex-start;
      padding: .55rem 0; border-bottom: 1px solid rgba(255,255,255,.05);
      font-size: .8rem; color: #94a3b8; line-height: 1.55;
    }
    .steps li:last-child { border-bottom: none; }
    .snum {
      min-width: 22px; height: 22px; border-radius: 50%;
      background: rgba(167,139,250,.2); color: #a78bfa;
      font-size: .68rem; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }

    .info-text { font-size: .82rem; color: #94a3b8; line-height: 1.6; margin-bottom: 1rem; }
    .err { color: #f87171; font-size: .78rem; margin-top: .5rem; min-height: 1.2em; }
    .spinner { display: inline-block; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
<div class="wrap">
  <div class="hd">
    <div class="icon">✨</div>
    <h1>AI Prompt Enhancer</h1>
    <p>Cursor Extension · Settings</p>
  </div>

  <!-- ① ACCOUNT CARD -->
  <div class="card" id="accountCard">
    <div class="card-title">👤 Account</div>
    <div id="accountBody">Loading…</div>
  </div>

  <!-- ② API KEY CARD -->
  <div class="card">
    <div class="card-title">🔑 Gemini API Key</div>
    <label class="lbl">Paste your key from <span onclick="openLink('https://aistudio.google.com/app/apikey')" style="color:#a78bfa;cursor:pointer">aistudio.google.com</span></label>
    <div class="inp-row">
      <input type="password" id="keyInput" placeholder="AIzaSy…" value="${savedKey}" class="${savedKey ? 'ok' : ''}" oninput="onKeyInput(this)"/>
      <button class="btn btn-primary" onclick="saveKey()">Save</button>
    </div>
    ${maskedKey ? `<p class="hint" style="color:#4ade80">✓ Saved: ${maskedKey} &nbsp;·&nbsp; <span onclick="clearKey()">Clear</span></p>` : ''}
    <p class="hint">Your key is stored locally and only sent to our backend for AI calls. Never shared.</p>
    <button class="btn btn-ghost btn-sm" style="margin-top:.6rem" onclick="testKey()">🧪 Test Connection</button>
  </div>

  <!-- ③ HOW TO USE -->
  <div class="card">
    <div class="card-title">📖 How to Use</div>
    <ol class="steps">
      <li><span class="snum">1</span>Select your prompt text in any Cursor editor file.</li>
      <li><span class="snum">2</span>Click <strong style="color:#a78bfa">✨ Enhance Prompt</strong> in the bottom status bar, or right-click → <em>Prompt Enhancer: Enhance Selection</em>.</li>
      <li><span class="snum">3</span>The Master Prompt opens beside your file and is auto-copied to clipboard.</li>
      <li><span class="snum">4</span>Paste it into Cursor's AI chat or any AI tool for superior results.</li>
    </ol>
  </div>
</div>

<script>
  const vscode = acquireVsCodeApi();

  // ── Firebase init ──────────────────────────────────────────────
  const fbCfg  = ${cfgJson};
  if (!firebase.apps.length) firebase.initializeApp(fbCfg);
  const auth   = firebase.auth();
  const provider = new firebase.auth.GoogleAuthProvider();

  // Restore state passed from extension
  let currentUser  = ${userJson};
  let currentApiKey = ${JSON.stringify(apiKey || null)};

  // Listen for state sync from extension (e.g. panel re-revealed)
  window.addEventListener('message', e => {
    const msg = e.data;
    if (msg.command === 'syncState') {
      currentUser   = msg.user;
      currentApiKey = msg.apiKey;
      renderAccount();
    }
  });

  // Also listen to Firebase auth state in case user signs in/out
  auth.onAuthStateChanged(fbUser => {
    if (fbUser && !currentUser) {
      // Freshly signed in from a previous session
      currentUser = {
        uid: fbUser.uid,
        name: fbUser.displayName || 'User',
        email: fbUser.email,
        picture: fbUser.photoURL || ''
      };
      vscode.postMessage({ command: 'signedIn', user: currentUser, apiKey: currentApiKey });
    }
    renderAccount();
  });

  function renderAccount() {
    const el = document.getElementById('accountBody');
    if (currentUser) {
      const initial = (currentUser.name || 'U').charAt(0).toUpperCase();
      const avatarHtml = currentUser.picture
        ? \`<img src="\${currentUser.picture}" class="avatar" onerror="this.style.display='none'">\`
        : \`<div class="avatar-init">\${initial}</div>\`;

      el.innerHTML = \`
        <div class="user-row">
          \${avatarHtml}
          <div class="user-info">
            <span class="user-name">\${escHtml(currentUser.name)}</span>
            <span class="user-email">\${escHtml(currentUser.email)}</span>
            <span class="badge">✓ Signed in with Google</span>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="signOut()">Sign out</button>
        </div>
      \`;
    } else {
      el.innerHTML = \`
        <p class="info-text">Sign in with Google to link your account. After signing in, paste your Gemini API key below for rate-limit-free usage.</p>
        <button class="g-btn" id="gBtn" onclick="signIn()">
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Sign in with Google
        </button>
        <p class="err" id="authErr"></p>
      \`;
    }
  }

  // ── Sign-in: open web app in browser, then link session ──────
  function signIn() {
    // VS Code webviews block popups — open the web app externally
    vscode.postMessage({ command: 'openExternal', url: 'https://prompt-enhancer-ai-gen.web.app/' });

    // Show a simple form so the user can link their session
    const el = document.getElementById('accountBody');
    el.innerHTML = \`
      <p class="info-text">A browser window was opened for Google Sign-in.<br/>After signing in on the web, enter your details below to link this session:</p>
      <div style="display:flex;flex-direction:column;gap:.5rem">
        <input type="text" id="nameInput" placeholder="Your name" style="font-family:inherit"/>
        <input type="text" id="emailInput" placeholder="Your email" style="font-family:inherit"/>
      </div>
      <div style="display:flex;gap:.5rem;margin-top:.8rem">
        <button class="btn btn-primary" onclick="linkSession()">Link Session</button>
        <button class="btn btn-ghost btn-sm" onclick="renderAccount()">Cancel</button>
      </div>
      <p class="err" id="authErr"></p>
      <p class="hint" style="margin-top:.8rem">This links your identity for display. Your API key (below) handles authentication.</p>
    \`;
  }

  function linkSession() {
    const name  = (document.getElementById('nameInput').value || '').trim();
    const email = (document.getElementById('emailInput').value || '').trim();
    const errEl = document.getElementById('authErr');
    if (!name || !email) {
      if (errEl) errEl.textContent = 'Please enter both name and email.';
      return;
    }
    currentUser = {
      uid: 'cursor-' + Date.now(),
      name: name,
      email: email,
      picture: ''
    };
    renderAccount();
    vscode.postMessage({ command: 'signedIn', user: currentUser, apiKey: currentApiKey });
  }

  async function signOut() {
    try {
      await auth.signOut();
      currentUser  = null;
      currentApiKey = null;
      renderAccount();
      vscode.postMessage({ command: 'signedOut' });
    } catch (e) {
      console.error(e);
    }
  }

  // ── API Key helpers ────────────────────────────────────────────
  function onKeyInput(el) { el.classList.toggle('ok', el.value.length > 0); }

  function saveKey() {
    const k = document.getElementById('keyInput').value.trim();
    currentApiKey = k || null;
    vscode.postMessage({ command: 'saveApiKey', apiKey: k });
  }

  function clearKey() {
    document.getElementById('keyInput').value = '';
    document.getElementById('keyInput').classList.remove('ok');
    currentApiKey = null;
    vscode.postMessage({ command: 'saveApiKey', apiKey: '' });
  }

  function testKey() {
    const k = document.getElementById('keyInput').value.trim();
    vscode.postMessage({ command: 'testApiKey', apiKey: k });
  }

  function openLink(url) {
    vscode.postMessage({ command: 'openExternal', url });
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Initial render
  renderAccount();
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
function deactivate() {}
module.exports = { activate, deactivate };
