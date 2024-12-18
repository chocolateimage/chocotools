const vscode = require("vscode");
const allCSSProperties = require("./allCSSProperties");

function getRuleOrder() {
    // Modified from https://9elements.com/css-rule-order/
    const original = [
        // GENERATED CONTENT
        "content",
        null,
        // POSITION AND LAYOUT
        "z-index",
        "position",
        "top",
        "bottom",
        "left",
        "right",
        "float",
        "clear",
        null,
        // DISPLAY AND VISIBILITY
        "display",
        "flex",
        "justify-content",
        "align-items",
        "align-self",
        null,
        "opacity",
        "transform",
        null,
        // CLIPPING
        "overflow",
        "clip",
        null,
        // ANIMATION
        "animation",
        "transition",
        null,
        // BOX MODEL (FROM OUTSIDE IN)
        "margin",
        "margin-top",
        "margin-right",
        "margin-bottom",
        "margin-left",
        "margin-inline",
        "margin-block",
        null,
        "box-shadow",
        "border",
        "border-radius",
        "box-sizing",
        null,
        "min-width",
        "min-height",
        "width",
        "height",
        "max-width",
        "max-height",
        null,
        "padding",
        "padding-top",
        "padding-right",
        "padding-bottom",
        "padding-left",
        "padding-inline",
        "padding-block",
        null,
        // BACKGROUND
        "background",
        "cursor",
        null,
        // TYPOGRAPHY
        "font",
        "text",
        "line-height",
        "word-spacing",
        "color",
    ];

    const ruleOrder = [];

    for (const i of original) {
        if (i == null) {
            ruleOrder.push(null);
            continue;
        }

        const filtered = allCSSProperties.filter((x) => x.startsWith(i));

        for (const j of filtered) {
            if (ruleOrder.includes(j)) {
                ruleOrder.splice(ruleOrder.indexOf(j), 1);
            }
            ruleOrder.push(j);
        }

        if (ruleOrder.includes(i)) {
            ruleOrder.splice(ruleOrder.indexOf(i), 1);
        }
        ruleOrder.push(i);
    }

    return ruleOrder;
}

function showCSSFormatError(info) {
    vscode.window.showErrorMessage("CSS was not formatted correctly. Message: " + info);
}

/**
 * document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken):
 * @param {vscode.TextDocument} document
 * @param {vscode.FormattingOptions} options
 * @param {vscode.CancellationToken} token
 * @returns {vscode.ProviderResult<vscode.TextEdit[]>}
 */
function provideDocumentFormattingEdits(document, options, token) {
    const editorConfig = vscode.workspace.getConfiguration("editor", document);
    const config = vscode.workspace.getConfiguration("chocotools", document);

    const ruleOrder = getRuleOrder();

    const edits = [];

    const language = document.languageId;
    const htmlLike = language != "css";

    let isProcessingCSS = !htmlLike; // Default to true if it is a native CSS file
    let isInRule = false;
    let ruleStartLine = null;
    let properties = {};
    let restProperties = [];
    let currentProperty = null;
    let currentPropertyFull = "";

    let isInComment = false;
    let commentsAttachedToProperties = {};
    let restComments = [];
    let currentComment = "";

    function endOfRule() {
        if (currentProperty == null) return;

        // In case the rule wasn't ended correctly a semicolon is added
        if (
            !currentPropertyFull.trim().endsWith(";") &&
            !currentPropertyFull.trim().endsWith("*/")
        ) {
            currentPropertyFull += ";";
        }

        if (currentComment != "") {
            commentsAttachedToProperties[currentPropertyFull] = currentComment;
            currentComment = "";
        }
        if (ruleOrder.includes(currentProperty)) {
            properties[currentProperty] = currentPropertyFull;
        } else {
            restProperties.push(currentPropertyFull);
        }
        currentPropertyFull = "";
        currentProperty = null;
    }

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

        if (trim.endsWith("{") && !isInComment) {
            if (isInRule) {
                showCSSFormatError("A } is probably missing before a CSS rule");
                return [];
            }

            isInRule = true;
            ruleStartLine = line;
            continue; // Skip line as else it's processing the "<selector> {" line as inside of a rule
        }

        if (!isInRule) continue;

        if (trim.endsWith("}") && !isInComment) {
            endOfRule();

            if (currentComment != "") {
                restComments.push(currentComment);
                currentComment = "";
            }

            // In addition of ending the rule, add the correct order of rules in here
            const position = ruleStartLine.rangeIncludingLineBreak.end;
            let needLineBreak = false;
            let insertText = "";

            for (const ruleIndex in ruleOrder) {
                const rule = ruleOrder[ruleIndex];

                if (rule == null) {
                    needLineBreak = true;
                }

                if (properties.hasOwnProperty(rule)) {
                    if (needLineBreak) {
                        needLineBreak = false;
                        if (insertText != "") {
                            insertText += "\n";
                        }
                    }
                    if (commentsAttachedToProperties.hasOwnProperty(properties[rule])) {
                        insertText += commentsAttachedToProperties[properties[rule]] + "\n";
                    }
                    insertText += properties[rule] + "\n";
                }
            }

            if (insertText != "" && restProperties.length > 0) {
                insertText += "\n";
            }

            for (const restProperty of restProperties) {
                if (commentsAttachedToProperties.hasOwnProperty(restProperty)) {
                    insertText += commentsAttachedToProperties[restProperty] + "\n";
                }
                insertText += restProperty + "\n";
            }

            if (insertText != "" && restComments.length > 0) {
                insertText += "\n";
            }

            for (const restComment of restComments) {
                insertText += restComment + "\n";
            }

            edits.push(vscode.TextEdit.insert(position, insertText));

            isInRule = false;
            ruleStartLine = null;

            properties = {};
            restProperties = [];

            continue; // Skip line as else it's processing the "}" line as inside of a rule
        }

        edits.push(vscode.TextEdit.delete(line.rangeIncludingLineBreak));

        if (trim == "" && !isInComment) continue; // Don't do anything with empty lines

        // Comments
        if (trim.startsWith("/*") && !isInComment) {
            if (currentComment != "") {
                restComments.push(currentComment);
                currentComment = "";
            }
            isInComment = true;
        }

        if (isInComment) {
            if (currentComment != "") {
                currentComment += "\n"; // For multiline comments add a newline
            }

            for (const index in line.text) {
                const character = line.text[index];

                currentComment += character;

                // This will be the comment end like this: `*/`
                if (character == "/" && index > 0 && line.text[index - 1] == "*") {
                    isInComment = false;
                }
            }
            continue;
        }

        // Properties
        if (currentProperty == null) {
            currentProperty = line.text.split(":")[0].trim();
        } else {
            currentPropertyFull += "\n";
        }

        let endOfLine = false;

        for (const character of line.text) {
            currentPropertyFull += character;

            // End of property/line, add to property list
            if (character == ";") {
                endOfLine = true;
            }
        }

        if (endOfLine) {
            endOfRule();
        }
    }

    if (isInComment) {
        showCSSFormatError("A comment was not closed correctly");
        return [];
    }

    if (htmlLike && isProcessingCSS) {
        showCSSFormatError("The </style> tag is missing");
        return [];
    }

    if (isInRule) {
        showCSSFormatError("The } is missing at the end of the CSS style");
        return [];
    }

    // Run Prettier after formatting the document
    if (config.get("runPrettier")) {
        setTimeout(async () => {
            const hasPrettier = (await vscode.commands.getCommands(true)).includes(
                "prettier.forceFormatDocument"
            );
            if (!hasPrettier) return;

            await vscode.commands.executeCommand("prettier.forceFormatDocument");
            if (editorConfig.get("formatOnSave")) {
                await vscode.commands.executeCommand(
                    "workbench.action.files.saveWithoutFormatting"
                );
            }
        }, 50);
    }

    return edits;
}

/**
 * @type {vscode.DocumentFormattingEditProvider}
 */
const formattingProviderCSS = {
    provideDocumentFormattingEdits,
};

module.exports = {
    formattingProviderCSS,
};
