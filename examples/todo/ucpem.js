/// <reference path="./.vscode/config.d.ts" />
// @ts-check

const { project } = require("ucpem")

project.isChild()

project.prefix("src").use(
    project.ref("formBuilder"),
    project.ref("structRpc"),
    project.ref("vueFoundation"),
    project.ref("honoService"),
    project.ref("socketIOTransport"),
    project.ref("restTransport"),
)
