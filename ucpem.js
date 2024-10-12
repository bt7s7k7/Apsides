/// <reference path="./.vscode/config.d.ts" />
// @ts-check

const { spawn } = require("child_process")
const { writeFile, readFile, rm } = require("fs/promises")
const { project, github, copy, join, constants, log, run } = require("ucpem")

project.prefix("src").res("todoExample",
    github("bt7s7k7/Vue3GUI").res("vue3gui"),
    github("bt7s7k7/CommonTypes").res("comTypes"),
    github("bt7s7k7/LogLib").res("prettyPrint"),
    github("bt7s7k7/Struct").res("struct")
)

async function buildBackend(/** @type {boolean} */ isDev) {
    const { build, context } = require("esbuild")

    await rm(join(constants.projectPath, "build"), { force: true, recursive: true })

    /** @type {Parameters<typeof build>[0]} */
    const options = {
        bundle: true,
        format: "esm",
        entryPoints: ["./src/index.ts"],
        outfile: "build/index.mjs",
        sourcemap: true,
        logLevel: isDev ? "silent" : "info",
        platform: "node",
        preserveSymlinks: true,
        packages: isDev ? "external" : "bundle",
        define: {
            "import.meta.env.MODE": isDev ? JSON.stringify("development") : JSON.stringify("production"),
            "import.meta.env.DEV": JSON.stringify(isDev),
            "import.meta.env.PROD": JSON.stringify(!isDev),
        },
        supported: {
            "using": false
        }
    }

    if (isDev) {
        const watcher = await context(options)
        await watcher.watch()
        return
    }

    await build(options)
}

project.script("build-backend", async () => {
    const packageJSON = JSON.parse((await readFile(join(constants.projectPath, "package.json"))).toString())

    await buildBackend(false)

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

async function watchBackend() {

    await buildBackend(true)

    /** @type {import("child_process").ChildProcess | null} */
    let child = null

    function log(/** @type {string} */ msg) {
        // eslint-disable-next-line no-console
        console.log("\x1b[96m[backend] " + msg + "\x1b[0m")
    }

    function execute() {
        if (child != null) {
            child.kill()
            child = null
        }

        child = spawn(process.argv[0], ["--enable-source-maps", "--inspect", "./build/index.mjs"], { stdio: "inherit" })
    }

    process.stdin.on("data", (data) => {
        if (data.toString() == "rs\n") {
            execute()
            log("Reloaded due to user command.")
        }
    })

    const tsc = spawn("yarn tsc --noEmit --watch --incremental --preserveWatchOutput --pretty", {
        stdio: "pipe",
        shell: true,
    })

    tsc.stdout.addListener("data", (chunk) => {
        process.stdout.write(chunk)
        if (chunk.toString().includes("Found 0 errors.")) {
            log("Reloaded due to changes.")
            execute()
        }
    })

    tsc.stderr.addListener("data", (chunk) => {
        process.stderr.write(chunk)
    })
}

project.script("watch-backend", async () => {
    watchBackend()
}, { desc: "Builds backend code in dev mode and watches for changes" })

project.script("dev", async () => {
    run("yarn vite")
    await watchBackend()
}, { desc: "Builds backend code in dev mode and watches for changes" })
