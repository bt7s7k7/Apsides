/// <reference path="./.vscode/config.d.ts" />
// @ts-check

const { project } = require("ucpem")

project.isChild()

project.prefix("src").res("todoExample",
    project.ref("formBuilder"),
    project.ref("structRpc"),
    project.ref("vueFoundation"),
    project.ref("honoService"),
    project.ref("socketIOTransport"),
)
