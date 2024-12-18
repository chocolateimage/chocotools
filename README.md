# Choco Tools

## CJS to ESM converter

Open your command palette (<kbd>CTRL</kbd> + <kbd>SHIFT</kbd> + <kbd>P</kbd>) then execute "Convert current file from CommonJS to ESM", this will change the imports and exports of your file from CommonJS (`require()`) to ESM `import ""`.

## CSS orderer

The CSS orderer is available as a formatter:

```json
"[css]": {
    "editor.defaultFormatter": "chocolateimage.chocotools"
},
```

It uses [9elements' CSS rule order](https://9elements.com/css-rule-order/) that can be found [here](src/ruleOrder.js) and supports CSS, HTML and Vue files.

If Prettier is installed, it will be automatically formatted with Prettier too and can be disabled in the [settings](vscode://settings/chocotools.runPrettier) as `chocotools.runPrettier`.
