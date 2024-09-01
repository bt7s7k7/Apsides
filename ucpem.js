/// <reference path="./.vscode/config.d.ts" />
// @ts-check

const { writeFile, readFile, rm } = require("fs/promises")
const { project, github, copy, join, constants, log } = require("ucpem")

project.prefix("src").res("todoExample",
    github("bt7s7k7/Vue3GUI").res("vue3gui"),
    github("bt7s7k7/CommonTypes").res("comTypes"),
    github("bt7s7k7/LogLib").res("prettyPrint"),
    github("bt7s7k7/Struct").res("struct")
)

project.script("build-backend", async () => {
    const { build } = require("esbuild")

    const packageJSON = JSON.parse((await readFile(join(constants.projectPath, "package.json"))).toString())

    await rm(join(constants.projectPath, "build"), { force: true, recursive: true })

    await build({
        bundle: true,
        format: "esm",
        entryPoints: ["./src/index.ts"],
        outfile: "build/index.mjs",
        sourcemap: true,
        logLevel: "info",
        platform: "node",
        preserveSymlinks: true,
        supported: {
            "using": false
        }
    })

    try {
        await copy(join(constants.projectPath, "dist"), join(constants.projectPath, "build/frontend/dist"), { quiet: true })
    } catch {
        log("Missing frontend folder")
    }

    await writeFile(join(constants.projectPath, "build/package.json"), JSON.stringify({
        ...packageJSON,
        devDependencies: undefined,
        dependencies: undefined,
        scripts: {
            "start": "node --enable-source-maps index.mjs"
        },
        main: "index.mjs"
    }, null, 4))

}, { desc: "Builds and bundles backend code" })
