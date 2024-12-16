const vscode = require('vscode');

const requireRegex = /const\s+(\S*|{[^}]+})\s*=\s*require\(([^\)]*)\)/
const moduleExportsObjectRegex = /module\.exports\s*=\s*{([^}]*)}/
const moduleExportsDefaultRegex = /module\.exports\s*=\s*([^\s{]+)/
const exportsSingleRegex = /(?:module\.)?exports\.(\S+)\s*=\s*(\S+)/

/**
 * 
 * @param {vscode.TextEditor} textEditor 
 * @param {vscode.TextEditorEdit} editBuilder 
 * @param {string} exportName 
 * @param {string} objectName 
 */
function replaceModuleExport(textEditor, editBuilder, exportName, objectName) {
    const replaces = {
        [`async function ${objectName}`]: exportName == null ? `export default async function ${objectName}` : `export async function ${exportName}`,
        [`function ${objectName}`]: exportName == null ? `export default function ${objectName}` : `export function ${exportName}`,
    }

    for (const [replaceFrom, replaceTo] of Object.entries(replaces)) {
        const index = textEditor.document.getText().indexOf(replaceFrom)
        if (index == -1) continue;

        editBuilder.replace(new vscode.Range(textEditor.document.positionAt(index), textEditor.document.positionAt(index + replaceFrom.length)), replaceTo)
        return null
    }
    
    return {
        exportName,
        objectName
    }


}

function commandConvertCJSToESM() {
    const textEditor = vscode.window.activeTextEditor

    const indentCharacter = textEditor.options.insertSpaces ? " ".repeat(textEditor.options.indentSize) : "\t"

    textEditor.edit((editBuilder) => {
        let didEdit = false;

        const failedExportTransformation = []

        // Replace require with imports

        for (let i = 0; i < textEditor.document.lineCount; i++) {
            const line = textEditor.document.lineAt(i)
            const result = line.text.match(requireRegex)
            if (result == null) continue;

            const imported = result[1]
            const fileName = result[2]

            let edited = "import "
            
            if (imported.startsWith("{") && imported.endsWith("}")) {
                edited += imported
            } else {
                edited += "* as " + imported
            }

            edited += " from " + fileName

            editBuilder.replace(line.range, edited)

            didEdit = true
        }

        // Replace module.exports = {}

        const exportsResult = textEditor.document.getText().match(moduleExportsObjectRegex)
        if (exportsResult != null) {
            editBuilder.delete(new vscode.Range(textEditor.document.positionAt(exportsResult.index - 1), textEditor.document.positionAt(exportsResult.index + exportsResult[0].length + 2)))
            for (const exportEntryRaw of exportsResult[1].split(",")) {
                const exportEntry = exportEntryRaw.trim()

                if (exportEntry.length == 0) continue;

                const splitted = exportEntry.split(":")

                const exportName = splitted[0].trim()
                let objectName = exportName

                if (splitted.length == 2) {
                    objectName = splitted[1].trim()
                }

                failedExportTransformation.push(replaceModuleExport(textEditor, editBuilder, exportName, objectName))
            }

            didEdit = true
        }

        // Replace [module.]exports.name = name

        for (let i = 0; i < textEditor.document.lineCount; i++) {
            const line = textEditor.document.lineAt(i)
            const result = line.text.match(exportsSingleRegex)
            if (result == null) continue;

            const exportName = result[1]
            const objectName = result[2]

            editBuilder.delete(line.rangeIncludingLineBreak)

            failedExportTransformation.push(replaceModuleExport(textEditor, editBuilder, exportName, objectName))

            didEdit = true
        }

        // Replace module.exports = name

        for (let i = 0; i < textEditor.document.lineCount; i++) {
            const line = textEditor.document.lineAt(i)
            const result = line.text.match(moduleExportsDefaultRegex)
            if (result == null) continue;

            const objectName = result[1]

            editBuilder.delete(line.rangeIncludingLineBreak)

            failedExportTransformation.push(replaceModuleExport(textEditor, editBuilder, null, objectName))

            didEdit = true
        }

        // Add extra "export {}"

        let extraExport = []

        for (const transformation of failedExportTransformation) {
            if (transformation == null) continue;

            if (transformation.exportName == null) {
                const toInsert = `\nexport default ${transformation.objectName}`

                editBuilder.insert(textEditor.document.positionAt(textEditor.document.getText().length), toInsert)
                didEdit = true
            } else {
                if (transformation.exportName != transformation.objectName) {
                    extraExport.push(`${transformation.objectName} as ${transformation.exportName}`)
                } else {
                    extraExport.push(transformation.exportName)
                }
            }

        }

        if (extraExport.length > 0) {
            const toInsert = `\nexport {\n${indentCharacter}` + extraExport.join(`,\n${indentCharacter}`) + "\n}"

            editBuilder.insert(textEditor.document.positionAt(textEditor.document.getText().length), toInsert)
            didEdit = true
        }



        if (!didEdit) {
            vscode.window.showInformationMessage("File " + textEditor.document.fileName.replaceAll("\\","/").split("/").pop() + " is already in ESM format, nothing was done")
        }
    })
}

module.exports = {
    commandConvertCJSToESM
}