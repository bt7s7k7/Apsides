/// <reference path="./.vscode/config.d.ts" />
// @ts-check

const { spawn } = require("child_process")
const { statSync } = require("fs")
const { writeFile, readFile, rm } = require("fs/promises")
const { project, github, copy, join, constants, log, run } = require("ucpem")

project.prefix("src").res("todoExample",
    github("bt7s7k7/Vue3GUI").res("vue3gui"),
    github("bt7s7k7/CommonTypes").res("comTypes"),
    github("bt7s7k7/LogLib").res("prettyPrint"),
    github("bt7s7k7/Struct").res("struct"),
    github("bt7s7k7/Apsides").res("formBuilder")
)

async function buildBackend(/** @type {boolean} */ isDev, /** @type {import("esbuild").Plugin | null} */ plugin = null) {
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
        },
    }

    if (plugin != null) {
        options.plugins = [plugin]
    }

    if (isDev) {
        const watcher = await context(options)
        return watcher
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
    let lastDate = NaN
    let date = NaN

    const esbuildContext = await buildBackend(true, {
        name: "watch-runner",
        setup(build) {
            build.onEnd(() => {
                lastDate = date
                date = statSync("./build/index.mjs").ctimeMs
            })
        }
    })

    /** @type {import("child_process").ChildProcess | null} */
    let child = null

    function log(/** @type {string} */ msg) {
        // eslint-disable-next-line no-console
        console.log("\x1b[96m[backend] " + msg + "\x1b[0m")
    }

    /** @type {ReturnType<typeof setTimeout> | null} */
    let debounceTimerId = null

    function execute() {
        if (child != null) {
            child.kill()
            child = null
        }

        child = spawn(process.argv[0], ["--enable-source-maps", "--inspect", "./build/index.mjs"], { stdio: "inherit" })
    }

    async function rebuildNow(params) {
        if (debounceTimerId != null) {
            clearTimeout(debounceTimerId)
            debounceTimerId = null
        }

        if (esbuildContext == null) throw new TypeError("Build backend didn't return a context when isDev was true")
        await esbuildContext.rebuild()
    }

    async function rebuild() {
        if (debounceTimerId != null) {
            clearTimeout(debounceTimerId)
        }

        debounceTimerId = setTimeout(() => {
            debounceTimerId = null
            rebuildNow().then(() => {
                if (date == lastDate) return
                log("Reloaded due to changes.")
                execute()
            })
        }, 1000)
    }

    process.stdin.on("data", (data) => {
        if (data.toString() == "rs\n") {
            log("Reloaded due to user command.")
            execute()
        }
    })

    const tsc = spawn("yarn tsc --noEmit --watch --incremental --preserveWatchOutput --pretty", {
        stdio: "pipe",
        shell: true,
    })

    let first = true
    tsc.stdout.addListener("data", (chunk) => {
        process.stdout.write(chunk)
        if (chunk.toString().includes("Found 0 errors.")) {
            if (first) {
                first = false
                rebuildNow().then(() => execute())
            } else {
                rebuild()
            }
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
