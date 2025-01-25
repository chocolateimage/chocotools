const vscode = require("vscode");

/**
 * @param {vscode.ExtensionContext} context
 */
function registerGitPrefixer(context) {
    const gitExtension = vscode.extensions.getExtension("vscode.git").exports;
    const git = gitExtension.getAPI(1);

    function getKeyForBranch(repo) {
        return repo.rootUri.toString() + ":" + repo.state.HEAD.name;
    }
    function getGlobalStateKeyForBranch(repo) {
        return "chocotools.branchprefix." + getKeyForBranch(repo);
    }

    function onInputChange(repo) {
        const prefix = context.globalState.get(getGlobalStateKeyForBranch(repo));
        if (prefix == null) return;
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
    async function onDidCommit(repo) {
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
            'Do you want to use the prefix "' + prefix + '" for the branch "' + branchName + '"?',

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
            });
            context.globalState.update(key, newPrefix);
        } else if (response == "Never show again") {
            config.update("newGitPrefixAskAutomatically", false);
        }
    }

    function registerRepository(repo) {
        context.subscriptions.push(repo.repository.inputBox.onDidChange(() => onInputChange(repo)));
        context.subscriptions.push(repo.onDidCommit(() => onDidCommit(repo)));
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
        });
        if (newPrefix == null) return;
        context.globalState.update(key, newPrefix != "" ? newPrefix : null);
    }

    git.onDidOpenRepository((repo) => {
        registerRepository(repo);
    });
    for (const repo of git.repositories) {
        registerRepository(repo);
    }

    context.subscriptions.push(
        vscode.commands.registerCommand("chocotools.gitPrefixEdit", gitPrefixEditCommand)
    );
}

module.exports = {
    registerGitPrefixer,
};
