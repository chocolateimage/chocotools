const vscode = require('vscode');
const { commandConvertCJSToESM } = require("./convertCJSToESM")
const { formattingProviderCSS } = require("./cssFormatter")

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	context.subscriptions.push(vscode.commands.registerCommand('chocotools.convertCJSToESM', commandConvertCJSToESM));
	context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('css', formattingProviderCSS));
	context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('vue', formattingProviderCSS));
	context.subscriptions.push(vscode.languages.registerDocumentFormattingEditProvider('html', formattingProviderCSS));
}

module.exports = {
	activate
}
