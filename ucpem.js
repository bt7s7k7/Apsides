/// <reference path="./.vscode/config.d.ts" />

const { project, github } = require("ucpem")

project.prefix("src").res("formML",
    github("bt7s7k7/Struct").res("struct"),
    github("bt7s7k7/CommonTypes").res("comTypes"),
)

project.prefix("src").res("formBuilder",
    project.ref("formML"),
    github("bt7s7k7/Vue3GUI").res("vue3gui"),
)
