# Choco Tools

## Installation

You can get this extension on the [VS Code marketplace](https://marketplace.visualstudio.com/items?itemName=chocolateimage.chocotools) and on [OpenVSX](https://open-vsx.org/extension/chocolateimage/chocotools).

## CJS to ESM converter

Open your command palette (<kbd>CTRL</kbd> + <kbd>SHIFT</kbd> + <kbd>P</kbd>) then execute "Convert current file from CommonJS to ESM", this will change the imports and exports of your file from CommonJS (`require()`) to ESM `import ""`.

## CSS orderer

The CSS orderer is available as a formatter, to use it add what you need to your project's settings.json:

```json
"[html]": {
    "editor.defaultFormatter": "chocolateimage.chocotools"
},
"[css]": {
    "editor.defaultFormatter": "chocolateimage.chocotools"
},
"[vue]": {
    "editor.defaultFormatter": "chocolateimage.chocotools"
},
```

It uses [9elements' CSS rule order](https://9elements.com/css-rule-order/) that can be found [here](src/ruleOrder.js) and supports CSS, HTML and Vue files.

If Prettier is installed, it will be automatically formatted with Prettier too and can be disabled in the [settings](vscode://settings/chocotools.runPrettier) as `chocotools.runPrettier`.

## Automatic Git commit message prefixer

If you checkout on a branch with double dashes, for example `TICKET-1234--Broken-link`, Choco Tools will automatically ask you if you want to have `TICKET-1234: ` as a Git commit message prefix. So if you try to type a commit message it will automatically add the prefix.
