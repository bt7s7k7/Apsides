import { ChildProcess, spawn } from "child_process"
import { Plugin } from "esbuild"
import { statSync } from "fs"
import { readFile, rm, writeFile } from "fs/promises"
import { createRequire } from "module"
import { join } from "path"
import { copy, run } from "ucpem"

type BuildOptions = Parameters<(typeof import("esbuild"))["build"]>[0]

export class ProjectBuilder {
    public modifyOptions: ((options: BuildOptions) => void) | null = null

    public async buildBackend(isDev: boolean, watch: boolean, plugin: Plugin | null = null) {
        const projectRequire = createRequire(join(this.root, "ucpem.js"))
        const { build, context } = projectRequire("esbuild") as typeof import("esbuild")

        await rm(join(this.root, "build"), { force: true, recursive: true })

        const options: BuildOptions = {
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
            loader: {
                ".html": "text"
            }
        }

        if (plugin != null) {
            options.plugins = [plugin]
        }

        this.modifyOptions?.(options)

        if (watch) {
            const watcher = await context(options)
            return watcher
        }

        await build(options)
    }

    public runBuild() {
        return spawn(process.argv[0], ["--enable-source-maps", "--inspect", "./build/index.mjs"], { stdio: "inherit" })
    }

    public async watchBackend(shouldExecute = true) {
        let lastDate = NaN
        let date = NaN

        const esbuildContext = await this.buildBackend(true, true, {
            name: "watch-runner",
            setup(build) {
                build.onEnd(() => {
                    lastDate = date
                    date = statSync("./build/index.mjs").ctimeMs
                })
            }
        })

        let child: ChildProcess | null = null

        function log(msg: string) {
            // eslint-disable-next-line no-console
            console.log("\x1b[96m[backend] " + msg + "\x1b[0m")
        }

        let debounceTimerId: ReturnType<typeof setTimeout> | null = null

        const execute = () => {
            if (child != null) {
                child.kill()
                child = null
            }

            if (!shouldExecute) return

            child = this.runBuild()
        }

        async function rebuildNow() {
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
            } else if (data.toString() == "rebuild\n") {
                log("Reloaded due to user command.")
                rebuildNow().then(() => execute())
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

    public async build(mode: "dev" | "watch" | "build" | "run" | "vite") {
        if (mode == "run") {
            await this.buildBackend(true, false)

            const child = this.runBuild()
            await new Promise<void>(v => child.on("exit", () => v()))
            return
        }

        if (mode == "build") {
            const packageJSON = JSON.parse((await readFile(join(this.root, "package.json"))).toString())

            await this.buildBackend(false, false)

            try {
                await copy(join(this.root, "dist"), join(this.root, "build/frontend/dist"), { quiet: true })
            } catch {
                // eslint-disable-next-line no-console
                console.error(`[\x1b[96mINFO\x1b[0m] No frontend folder found`)
            }

            await writeFile(join(this.root, "build/package.json"), JSON.stringify({
                ...packageJSON,
                devDependencies: undefined,
                dependencies: undefined,
                scripts: {
                    "start": "node --enable-source-maps index.mjs"
                },
                main: "index.mjs"
            }, null, 4))

            return
        }

        if (mode == "watch") {
            await this.watchBackend(false)
            return
        }

        if (mode == "dev") {
            await this.watchBackend()
            return
        }

        if (mode == "vite") {
            run("yarn vite", this.root)
            await this.watchBackend()
        }
    }

    constructor(
        public readonly root: string
    ) { }
}
