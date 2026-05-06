const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Prompt Enhancer is now active!');

    // Create Status Bar Item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'prompt-enhancer.enhance';
    statusBarItem.text = '$(sparkle) Enhance Prompt';
    statusBarItem.tooltip = 'Highlight text and click to improve your prompt';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    let disposable = vscode.commands.registerCommand('prompt-enhancer.enhance', async function () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('Open a file to enhance a prompt.');
            return;
        }

        const selection = editor.selection;
        const text = editor.document.getText(selection);

        if (!text) {
            vscode.window.showWarningMessage('Please select some text to enhance.');
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Improving Prompt...",
            cancellable: false
        }, async (progress) => {
            try {
                // Dynamic import to support both new and old Cursor versions
                const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
                
                const response = await fetch('https://prompt-enhancer-backend-vfkc.onrender.com/api/improve-prompt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: text })
                });

                const data = await response.json();

                if (data.error) {
                    throw new Error(data.error);
                }

                // Show the result in a Webview popup instead of replacing text
                const panel = vscode.window.createWebviewPanel(
                    'promptResult',
                    '✨ Improved Prompt',
                    vscode.ViewColumn.Beside,
                    { enableScripts: true }
                );

                panel.webview.html = getWebviewContent(data.improvedPrompt);

                // Handle messages from the webview (like copying)
                panel.webview.onDidReceiveMessage(
                    message => {
                        switch (message.command) {
                            case 'copy':
                                vscode.env.clipboard.writeText(message.text);
                                vscode.window.showInformationMessage('Copied to clipboard!');
                                return;
                        }
                    },
                    undefined,
                    context.subscriptions
                );

            } catch (err) {
                vscode.window.showErrorMessage('Error improving prompt: ' + err.message);
            }
        });
    });

    context.subscriptions.push(disposable);
}

function getWebviewContent(prompt) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: sans-serif; padding: 20px; background: #1e1e1e; color: #ccc; }
            pre { background: #2d2d2d; padding: 15px; border-radius: 8px; white-space: pre-wrap; border: 1px solid #444; }
            button { 
                background: #6366f1; color: white; border: none; padding: 10px 20px; 
                border-radius: 5px; cursor: pointer; font-weight: bold; margin-bottom: 15px;
            }
            button:hover { background: #4f46e5; }
            h2 { color: #a855f7; margin-top: 0; }
        </style>
    </head>
    <body>
        <h2>✨ Your Improved Prompt</h2>
        <button onclick="copyText()">📋 Copy to Clipboard</button>
        <pre id="promptText">${prompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        <script>
            const vscode = acquireVsCodeApi();
            function copyText() {
                const text = document.getElementById('promptText').innerText;
                vscode.postMessage({
                    command: 'copy',
                    text: text
                });
            }
        </script>
    </body>
    </html>`;
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
