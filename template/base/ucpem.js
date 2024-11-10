/// <reference path="./.vscode/config.d.ts" />
// @ts-check

const { project, github } = require("ucpem")

project.isChild()

project.prefix("src").res("__APP")
project.use(github("bt7s7k7/Apsides").script("builder"))
