const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    console.log('Prompt Enhancer is now active!');

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'prompt-enhancer.enhance';
    statusBarItem.text = '$(sparkle) Enhance Prompt';
    statusBarItem.tooltip = 'Select text or click to type a prompt to enhance';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    let disposable = vscode.commands.registerCommand('prompt-enhancer.enhance', async function () {
        let text = '';

        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const selection = editor.selection;

            if (!selection.isEmpty) {
                const range = new vscode.Range(selection.start, selection.end);
                text = editor.document.getText(range);
            }

            if (!text || text.trim().length === 0) {
                const activeLine = selection.active.line;
                const line = editor.document.lineAt(activeLine);
                text = line.text;
            }

            if (!text || text.trim().length === 0) {
                const allText = editor.document.getText();
                if (allText && allText.trim().length > 0 && allText.trim().length < 5000) {
                    text = allText;
                }
            }
        }

        if (!text || text.trim().length === 0) {
            text = await vscode.window.showInputBox({
                prompt: 'Enter the prompt you want to enhance',
                placeHolder: 'E.g., Write a REST API for user authentication...',
                ignoreFocusOut: true
            });

            if (!text || text.trim().length === 0) {
                return;
            }
        }

        text = text.trim();

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

                // 1. Automatically copy to clipboard for immediate use
                await vscode.env.clipboard.writeText(data.improvedPrompt);

                // 2. Open in a new unsaved document so the user can see/edit it
                const doc = await vscode.workspace.openTextDocument({
                    content: data.improvedPrompt,
                    language: 'markdown'
                });
                await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);

                vscode.window.showInformationMessage('✨ Prompt Improved & Copied to Clipboard!');

            } catch (err) {
                vscode.window.showErrorMessage('Error improving prompt: ' + err.message);
            }
        });
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}
