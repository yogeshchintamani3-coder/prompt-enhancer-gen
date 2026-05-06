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

                editor.edit(editBuilder => {
                    editBuilder.replace(selection, data.improvedPrompt);
                });

                vscode.window.showInformationMessage('Prompt improved successfully!');
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
