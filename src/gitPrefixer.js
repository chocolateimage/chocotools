const vscode = require("vscode");

/**
 * @param {vscode.ExtensionContext} context
 */
function registerGitPrefixer(context) {
    const gitExtension = vscode.extensions.getExtension("vscode.git").exports;
    const git = gitExtension.getAPI(1);
    const registeredRepositoryInterval = {};

    function getKeyForBranch(repo) {
        return repo.rootUri.toString() + ":" + repo.state.HEAD.name;
    }
    function getGlobalStateKeyForBranch(repo) {
        return "chocotools.branchprefix." + getKeyForBranch(repo);
    }

    function onInputChange(repo) {
        const prefix = context.globalState.get(getGlobalStateKeyForBranch(repo));
        if (prefix == null || prefix == "") return;
        const inputBoxValue = repo.inputBox.value;
        if (inputBoxValue.length == 1) {
            repo.inputBox.value = prefix + inputBoxValue;
        } else if (
            inputBoxValue.startsWith(prefix.slice(0, -1)) &&
            !inputBoxValue.startsWith(prefix)
        ) {
            repo.inputBox.value = inputBoxValue.substring(prefix.length - 1);
        }
    }

    /**
     * @param {vscode.TextEditor} editor
     */
    function onDidChangeActiveTextEditor(editor) {
        if (!editor) return;
        if (!editor.document) return;
        if (editor.document.languageId !== "git-commit") return;

        const line = editor.document.lineAt(0);
        if (line.text !== "") return;

        const repo = git.repositories[0];

        const prefix = context.globalState.get(getGlobalStateKeyForBranch(repo));
        if (prefix == null || prefix == "") return;

        editor.edit((editBuild) => {
            editBuild.insert(line.range.start, prefix);
        });
    }

    function commitPrefixValidation(value) {
        if (value.length > 0) {
            return {
                severity: vscode.InputBoxValidationSeverity.Info,
                message: `Example: ${value}Commit message`,
            };
        }

        return null;
    }

    async function askCommitPrefix(repo) {
        const config = vscode.workspace.getConfiguration("chocotools");
        if (!config.get("newGitPrefixAskAutomatically")) return;
        const key = getGlobalStateKeyForBranch(repo);
        const hasPrefix = context.globalState.get(key) != null;
        if (hasPrefix) return;

        const branchName = repo.state.HEAD.name;
        if (!branchName.includes("--")) return;
        let prefix = branchName.split("--")[0];
        prefix += ": ";
        const response = await vscode.window.showInformationMessage(
            'Do you want to use the commit prefix "' +
                prefix +
                '" for the branch "' +
                branchName +
                '"?',

            "Use",
            "Edit and use",
            "Never show again"
        );
        if (response == "Use") {
            context.globalState.update(key, prefix);
        } else if (response == "Edit and use") {
            const newPrefix = await vscode.window.showInputBox({
                title: 'Enter a prefix for the branch "' + branchName + '"',
                value: prefix,
                validateInput: commitPrefixValidation,
            });
            context.globalState.update(key, newPrefix);
        } else if (response == "Never show again") {
            config.update("newGitPrefixAskAutomatically", false, vscode.ConfigurationTarget.Global);
        }
    }

    function registerRepository(repo) {
        /* I hate Microsoft, sadly they removed access to the internal inputBox in commit
         *
         * https://github.com/microsoft/vscode/commit/777fd07cccc3de449e529c9f701c2cfdd36ecb3e
         *
         * so we can't detect changes directly (with repo.repository.inputBox.onDidChange)
         * and have to do this fucking hacky workaround until someone finds out a better way.
         */

        let lastValue = null;
        const checkInterval = setInterval(() => {
            try {
                const value = repo.inputBox.value;
                if (lastValue == value) return;
                lastValue = value;

                // Make sure we handle a potential error separately so we don't cancel the check interval
                try {
                    onInputChange(repo);
                } catch (error) {
                    console.error(error);
                }
            } catch (error) {
                console.warn(error);
                clearInterval(checkInterval);
            }
        }, 70);
        registeredRepositoryInterval[repo.rootUri.toString()] = checkInterval;
        context.subscriptions.push(repo.onDidCheckout(() => askCommitPrefix(repo)));
    }
    function unregisterRepository(repo) {
        const checkInterval = registeredRepositoryInterval[repo.rootUri.toString()];
        if (checkInterval != null) {
            clearInterval(checkInterval);
        }
    }

    async function gitPrefixEditCommand() {
        const repo = git.repositories[0];
        const branchName = repo.state.HEAD.name;
        const key = getGlobalStateKeyForBranch(repo);
        const prefix = context.globalState.get(key) ?? "";

        const newPrefix = await vscode.window.showInputBox({
            title:
                'Enter a prefix for the branch "' + branchName + '", leave it empty for no prefix',
            value: prefix,
            validateInput: commitPrefixValidation,
        });
        if (newPrefix == null) return;
        context.globalState.update(key, newPrefix != "" ? newPrefix : null);
    }

    git.onDidOpenRepository((repo) => {
        registerRepository(repo);
    });
    git.onDidCloseRepository((repo) => {
        unregisterRepository(repo);
    });
    for (const repo of git.repositories) {
        registerRepository(repo);
    }

    context.subscriptions.push(
        vscode.commands.registerCommand("chocotools.gitPrefixEdit", gitPrefixEditCommand)
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(onDidChangeActiveTextEditor)
    );
}

module.exports = {
    registerGitPrefixer,
};
