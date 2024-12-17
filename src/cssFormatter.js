const vscode = require('vscode');
const allCSSProperties = require("./allCSSProperties")

function getRuleOrder() {
    // Modified from https://9elements.com/css-rule-order/
    const original = ["content",
        null,
        "position",
        "z-index",
        "top",
        "bottom",
        "left",
        "right",
        "float",
        "clear",
        null,
        "display",
        "opacity",
        "transform",
        null,
        "flex",
        null,
        "overflow",
        "clip",
        null,
        "animation",
        "transition",
        null,
        "margin",
        "box-shadow",
        "border",
        "border-radius",
        "box-sizing",
        "width",
        "height",
        "padding",
        null,
        "background",
        "cursor",
        null,
        "font",
        "line-height",
        "word-spacing",
    ]

    const ruleOrder = []

    for (const i of original) {
        if (i == null) {
            ruleOrder.push(null)
            continue
        }

        const filtered = allCSSProperties.filter((x) => x.startsWith(i))

        for (const j of filtered) {
            ruleOrder.push(j)
        }
        if (!ruleOrder.includes(i)) {
            ruleOrder.push(i)
        }
    }

    return ruleOrder
}

function showCSSFormatError(info) {
    vscode.window.showErrorMessage("CSS was not formatted correctly. Message: " + info)
}

/**
     * document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken): 
     * @param {vscode.TextDocument} document 
     * @param {vscode.FormattingOptions} options 
     * @param {vscode.CancellationToken} token 
     * @returns {vscode.ProviderResult<vscode.TextEdit[]>}
     */
function provideDocumentFormattingEdits(document, options, token) {
    const ruleOrder = getRuleOrder()

    const edits = []

    const language = document.languageId
    const htmlLike = language != "css"

    let isProcessingCSS = !htmlLike; // Default to true if it is a native CSS file
    let isInRule = false;
    let ruleStartLine = null;
    let properties = {};
    let restProperties = [];

    for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
        const line = document.lineAt(lineIndex);
        const trim = line.text.trim();

        if (htmlLike) {
            if (isProcessingCSS) {
                if (trim.replaceAll(" ", "") == "</style>") {
                    isProcessingCSS = false;
                    continue;
                }
            } else {
                if (trim.startsWith("<style") && trim.endsWith(">")) {
                    isProcessingCSS = true;
                    continue; // Skip line as else it's processing the "<style>" line as CSS
                }
            }
        }

        if (!isProcessingCSS) continue;

        // TODO: Handle comments

        if (trim.endsWith("{")) {
            if (isInRule) {
                showCSSFormatError("A } is probably missing before a CSS rule")
                return []
            }

            isInRule = true;
            ruleStartLine = line;
            continue; // Skip line as else it's processing the "<selector> {" line as inside of a rule
        }

        if (!isInRule) continue;

        if (trim.endsWith("}")) {
            // In addition of ending the rule, add the correct order of rules in here
            const position = ruleStartLine.rangeIncludingLineBreak.end;
            let needLineBreak = false;
            let insertText = "";

            for (const ruleIndex in ruleOrder) {
                const rule = ruleOrder[ruleIndex]

                if (rule == null) {
                    needLineBreak = true
                }

                if (properties.hasOwnProperty(rule)) {
                    if (needLineBreak) {
                        needLineBreak = false
                        if (insertText != "") {
                            insertText += "\n"
                        }
                    }
                    insertText += properties[rule] + "\n"
                }
            }

            if (Object.keys(properties).length > 0 && restProperties.length > 0) {
                insertText += "\n"
            }

            for (const restProperty of restProperties) {
                insertText += restProperty + "\n"
            }

            edits.push(vscode.TextEdit.insert(position, insertText))


            isInRule = false
            ruleStartLine = null

            properties = {}
            restProperties = []

            continue; // Skip line as else it's processing the "}" line as inside of a rule
        }

        const property = line.text.split(':')[0].trim()

        if (trim == "") {

        } else if (ruleOrder.includes(property)) {
            properties[property] = line.text;
        } else {
            restProperties.push(line.text);
        }

        edits.push(vscode.TextEdit.delete(line.rangeIncludingLineBreak))
    }

    if (htmlLike && isProcessingCSS) {
        showCSSFormatError("The </style> tag is missing")
        return []
    }

    if (isInRule) {
        showCSSFormatError("The } is missing at the end of the CSS style")
        return []
    }

    return edits
}

/**
 * @type {vscode.DocumentFormattingEditProvider}
 */
const formattingProviderCSS = {
    provideDocumentFormattingEdits
}

module.exports = {
    formattingProviderCSS
}