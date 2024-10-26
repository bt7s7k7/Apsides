/// <reference path="./.vscode/config.d.ts" />
// @ts-check

const { project, github, join, constants, run, copy, getProjectDetails, log, include, path } = require("ucpem")
const { readdir, writeFile, mkdir, rm, readFile } = require("fs/promises")
const { extname, basename, relative } = require("path")
const { readFileSync, statSync } = require("fs")
const { spawn } = require("child_process")
const { console } = require("inspector")

include("examples/todo/ucpem.js")

project.prefix("src").res("formML",
    github("bt7s7k7/Struct").res("struct"),
    github("bt7s7k7/CommonTypes").res("comTypes"),
)

project.prefix("src").res("formBuilder",
    project.ref("formML"),
    github("bt7s7k7/Vue3GUI").res("vue3gui"),
)

project.prefix("src").res("editor",
    github("bt7s7k7/Vue3GUI").res("vue3gui"),
    github("bt7s7k7/CommonTypes").res("comTypes"),
)

project.prefix("src").res("events",
    github("bt7s7k7/CommonTypes").res("comTypes"),
)

project.prefix("src").res("foundation",
    github("bt7s7k7/LogLib").res("prettyPrint"),
    project.ref("serviceProvider"),
)

project.prefix("src").res("vueFoundation",
    github("bt7s7k7/Vue3GUI").res("vue3gui"),
    project.ref("foundation"),
)

project.prefix("src").res("serviceProvider",
    project.ref("events"),
)

project.prefix("src").res("honoService",
    project.ref("foundation"),
)

project.prefix("src").res("socketIOTransport",
    project.ref("foundation"),
)

project.prefix("src").res("restTransport",
    project.ref("honoService"),
    project.ref("structRpc"),
)

project.prefix("src").res("structRpc",
    github("bt7s7k7/Struct").res("struct"),
    project.ref("foundation"),
)

/** @typedef {{ name: string, version: string, devDependencies: Record<string, string>, dependencies: Record<string, string>, optionalDependencies?: Record<string, string> } & Record<string, any>} PackageJson */
/** @typedef {{ compilerOptions: any, include?: string[], exclude?: string[] }} TSConfig */

const RESOURCES = new class {
    _projectPackageJSON = /** @type {PackageJson | null} */(null)
    getProjectPackageJSON() {
        return this._projectPackageJSON ??= /** @type {never} */(JSON.parse(readFileSync(join(constants.projectPath, "package.json")).toString()))
    }

    _projectTSConfig = /** @type {TSConfig | null} */(null)
    getProjectTSConfig() {
        return this._projectTSConfig ??= /** @type {never} */(JSON.parse(readFileSync(join(constants.projectPath, "tsconfig.json")).toString()))
    }
}

class Package {
    getPath() {
        return join(constants.projectPath, "src", this.folder)
    }

    applyDependencies(/** @type {PackageJson} */ packageJSON) {
        const version = packageJSON.version
        for (const dependency of this.dependencies) {
            packageJSON.dependencies[dependency] = version
            const dependencyPackages = packagesLookup.get(dependency)
            if (dependencyPackages == null) throw new TypeError("Cannot find package: " + dependency)
            dependencyPackages.applyDependencies(packageJSON)
        }

        this.packageMerge?.(packageJSON)
    }

    async executeCallback(/** @type {string} */ src, /** @type {string} */ dest) {
        await this.callback?.(src, dest)
        for (const dependency of this.dependencies) {
            const dependencyPackages = packagesLookup.get(dependency)
            if (dependencyPackages == null) throw new TypeError("Cannot find package: " + dependency)
            await dependencyPackages.executeCallback(src, dest)
        }
    }

    /**
     * @param {string} name
     * @param {string} folder
     */
    constructor(
        name, folder,
        {
            umdName = /** @type {string | null} */(null),
            dependencies = /** @type {string[]} */([]),
            packageMerge = /** @type {((pkg: PackageJson) => void) | null} */(null),
            callback = /** @type {((src: string, dest: string) => Promise<void>) | null} */(null),
            strategy = /** @type {"vite" | "esbuild"} */("vite"),
            customReadme = false
        } = {}
    ) {
        this.name = name
        this.folder = folder
        this.shortName = /** @type {string} */(name.split("/").at(-1))
        this.umdName = umdName ?? /** @type {string} */(name.replace(/^@/, "").split("/").map(v => v[0].toUpperCase() + v.slice(1)).join(""))
        this.dependencies = dependencies
        this.packageMerge = packageMerge
        this.callback = callback
        this.customReadme = customReadme
        this.strategy = strategy
    }
}

function addVueDependencies(/** @type {PackageJson} */pkg) {
    const our = RESOURCES.getProjectPackageJSON()
    pkg.dependencies["vue"] = our.dependencies["vue"]
    pkg.dependencies["vue-router"] = our.dependencies["vue-router"]
}

function addHono(/** @type {PackageJson} */pkg) {
    const our = RESOURCES.getProjectPackageJSON()
    pkg.dependencies["hono"] = our.dependencies["hono"]
    pkg.dependencies["@hono/node-server"] = our.dependencies["@hono/node-server"]
}

function addSocketIO(/** @type {PackageJson} */pkg) {
    const our = RESOURCES.getProjectPackageJSON()
    pkg.dependencies["socket.io"] = our.dependencies["socket.io"]
    pkg.dependencies["socket.io-client"] = our.dependencies["socket.io-client"]
    if (our.optionalDependencies) {
        pkg.optionalDependencies ??= {}
        pkg.optionalDependencies["bufferutil"] = our.optionalDependencies["bufferutil"]
        pkg.optionalDependencies["utf-8-validate"] = our.optionalDependencies["utf-8-validate"]
    }
}

const packages = [
    new Package("@apsides/struct", "struct", { customReadme: true, strategy: "esbuild" }),
    new Package("@apsides/form-builder", "formBuilder", { dependencies: ["@apsides/struct", "@apsides/form-ml", "@apsides/ui"], packageMerge: addVueDependencies, customReadme: true }),
    new Package("@apsides/form-ml", "formML", { dependencies: ["@apsides/struct", "kompa"], customReadme: true, strategy: "esbuild" }),
    new Package("kompa", "comTypes", { strategy: "esbuild" }),
    new Package("@apsides/ui", "vue3gui", {
        umdName: "ApsidesUI", packageMerge: addVueDependencies,
        async callback(src, dest) {
            await copy(join(src, "eventDecorator.d.ts"), join(dest, "eventDecorator.d.ts"))
        }
    }),
    new Package("@apsides/events", "events", { customReadme: true, dependencies: ["kompa"], strategy: "esbuild" }),
    new Package("@apsides/object-description", "prettyPrint", { customReadme: true, strategy: "esbuild" }),
    new Package("@apsides/services", "serviceProvider", { customReadme: true, dependencies: ["kompa", "@apsides/events"], strategy: "esbuild" }),
    new Package("@apsides/foundation", "foundation", { customReadme: true, dependencies: ["@apsides/object-description", "@apsides/services"], strategy: "esbuild" }),
    new Package("@apsides/rpc", "structRpc", { customReadme: true, dependencies: ["@apsides/struct", "@apsides/foundation"], strategy: "esbuild" }),
    new Package("@apsides/hono-integration", "honoService", { customReadme: true, dependencies: ["@apsides/foundation"], packageMerge: addHono, strategy: "esbuild" }),
    new Package("@apsides/socket.io-integration", "socketIOTransport", { customReadme: true, dependencies: ["@apsides/foundation"], packageMerge: addSocketIO, strategy: "esbuild" }),
    new Package("@apsides/rest-integration", "restTransport", { customReadme: true, dependencies: ["@apsides/hono-integration", "@apsides/rpc"], strategy: "esbuild" }),
    new Package("@apsides/vue-integration", "vueFoundation", { customReadme: true, dependencies: ["@apsides/foundation", "@apsides/ui"] }),
]
const packagesLookup = new Map(packages.map(v => [v.name, v]))

project.script("build-index", async () => {
    /** @type {string[]} */
    const indexes = []
    const src = join(constants.projectPath, "src")

    for (const package of packages) {
        /** @type {string[]} */
        const files = []
        const rootPath = package.getPath()

        async function visit(/** @type {string} */ path) {
            for await (const dirent of await readdir(path, { withFileTypes: true })) {
                if (dirent.isDirectory()) {
                    await visit(join(path, dirent.name))
                    continue
                }

                if (!dirent.isFile()) continue
                const ext = extname(dirent.name)
                if (dirent.name.endsWith(".d.ts")) continue
                if (ext != ".ts" && ext != ".tsx") continue
                const relativePath = "./" + package.folder + "/" + relative(rootPath, join(path, basename(dirent.name, ext)))
                files.push(relativePath)
            }
        }

        await visit(rootPath)

        const index = "index_" + package.shortName
        indexes.push(index)
        await writeFile(join(src, index) + ".ts", files.map(file => `export * from "${file}"`).join("\n") + "\n")
    }

    await writeFile(join(src, "index.ts"), indexes.map(file => `export * from "./${file}"`).join("\n") + "\n")
}, { desc: "Creates index files for all packages" })

project.script("build-package", async ([packageName]) => {
    const package = packages.find(v => v.shortName == packageName)
    if (package == null) throw new Error("Cannot find package " + JSON.stringify(packageName))

    const outFolder = join(constants.projectPath, "pkg-" + package.shortName)
    const typesFolder = join(constants.projectPath, "dist-types")
    const projectDetails = getProjectDetails()

    const resource = Object.values(projectDetails.resources).find(v => v.path.endsWith(package.folder))
    if (!resource) throw new Error("Cannot find resource")
    const project = projectDetails.projects[resource.portName]
    const port = projectDetails.ports[resource.portName]

    await rm(outFolder, { recursive: true }).catch(err => { if (err.code == "ENOENT") return; throw err })
    await mkdir(outFolder)

    /** @type {import("./vite.config").LibDef} */
    const viteOptions = {
        name: package.umdName,
        entry: join("src", "index_" + package.shortName + ".ts"),
        extern: new Map(),
        neighbours: new Map(),
        outDir: outFolder
    }

    /** @type {Parameters<typeof copy>[2]} */
    const replacements = []

    for (const externPkg of packages) {
        if (externPkg == package) continue
        viteOptions.extern.set(externPkg.folder, externPkg.name)
        viteOptions.neighbours.set(externPkg.name, externPkg.umdName)
        replacements.push([new RegExp("\"\\.\\./" + externPkg.folder + ".*?\"", "g"), "\"" + externPkg.name + "\""])
    }

    async function buildVite() {
        // @ts-ignore
        viteOptions.extern = Object.fromEntries(viteOptions.extern)
        // @ts-ignore
        viteOptions.neighbours = Object.fromEntries(viteOptions.neighbours)
        process.env.LIB_OPTIONS = JSON.stringify(viteOptions)
        await run("yarn vite build")
    }

    async function buildEsbuild() {
        const { build } = require("esbuild")

        /** @type {Parameters<typeof build>[0]} */
        let options = {
            bundle: true,
            format: "esm",
            entryPoints: [viteOptions.entry],
            outfile: join(viteOptions.outDir, "index.mjs"),
            sourcemap: true,
            logLevel: "info",
            platform: "node",
            preserveSymlinks: true,
            packages: "external",
            define: {
                "import.meta.env.MODE": JSON.stringify("production"),
                "import.meta.env.DEV": "false",
                "import.meta.env.PROD": "true",
            },
            supported: {
                "using": false
            },
            external: [...viteOptions.extern.keys()].map(v => "./src/" + v + "/*"),
            write: false
        }

        async function buildAndProcess() {
            const result = await build(options)
            if (result.outputFiles == null) throw new TypeError()
            for (const file of result.outputFiles) {
                let content = file.text
                if (!file.path.endsWith(".map")) {
                    for (const [folder, pkg] of viteOptions.extern) {
                        content = content.replace(new RegExp(`\\.\\./src/${folder}[^"]*`, "g"), pkg)
                    }
                }

                await writeFile(file.path, content)
            }
        }

        const step1 = buildAndProcess()

        options = {
            ...options,
            format: "cjs",
            outfile: join(viteOptions.outDir, "index.cjs"),
        }

        const step2 = buildAndProcess()

        await step1
        await step2
    }

    const viteBuildPromise = process.env.SKIP_VITE || (package.strategy == "esbuild" ? buildEsbuild() : buildVite())

    const version = RESOURCES.getProjectPackageJSON().version

    const repository = port?.source ?? "https://github.com/bt7s7k7/Apsides"

    /** @type {PackageJson} */
    const packageJSON = {
        name: package.name, version,
        dependencies: {},
        devDependencies: {},
        license: "MIT",
        author: "bt7s7k7",
        exports: {
            ".": package.strategy == "vite" ? {
                types: "./index.d.ts",
                import: "./index.es.js",
                require: "./index.umd.js"
            } : {
                types: "./index.d.ts",
                import: "./index.mjs",
                require: "./index.cjs"
            }
        },
        types: "./index.d.ts",
        repository: {
            type: "git",
            url: "git+" + repository
        },
        homepage: package.customReadme ? "https://github.com/bt7s7k7/Apsides/blob/master/docs/" + package.shortName + ".md" : repository + "#readme",
    }

    package.applyDependencies(packageJSON)

    const tsConfig = RESOURCES.getProjectTSConfig()
    tsConfig.include?.pop()

    await viteBuildPromise

    await writeFile(join(outFolder, "package.json"), JSON.stringify(packageJSON, null, 4))
    await writeFile(join(outFolder, "tsconfig.json"), JSON.stringify(tsConfig, null, 4))

    await copy(join(typesFolder, package.folder), join(outFolder, package.folder), { replacements, quiet: !process.env.BUILD_DEBUG })
    await copy(join(typesFolder, "index_" + package.shortName + ".d.ts"), join(outFolder, "index.d.ts"), { quiet: !process.env.BUILD_DEBUG })

    await copy(join("src", package.folder), outFolder, { predicate: (path) => path.endsWith(".scss") })

    const readme = await readFile(join(constants.projectPath, "docs", package.shortName + ".md")).catch(err => {
        if (err.code != "ENOENT") throw err

        const projectPath = project.path
        return readFile(join(projectPath, "README.md"))
    })

    await writeFile(join(outFolder, "README.md"), readme.toString())

    await copy(join(constants.projectPath, "LICENSE.md"), join(outFolder, "LICENSE.md"))

    await package.executeCallback(typesFolder, outFolder)
}, { desc: "Builds a package :: Arguments: <name>", argc: 1 })


project.script("build-all", async () => {
    await run("ucpem run build-index")

    if (!process.env.SKIP_TS) {
        await run("yarn tsc --emitDeclarationOnly")
        await run("yarn eslint --fix dist-types")
    }

    await run(`yarn concurrently -n ${packages.map(v => v.shortName).join(",")} ${packages.map(v => `ucpem run build-package ${v.shortName}`).map(v => JSON.stringify(v)).join(" ")}`)
}, { desc: "Builds all packages" })

project.script("build-clean", async () => {
    for await (const dirent of await readdir(constants.projectPath)) {
        if (dirent.startsWith("pkg-")) {
            log("Deleting " + dirent)
            await rm(join(constants.projectPath, dirent), { recursive: true })
        }
    }
})

project.script("builder", async (args) => {
    const mode = args[0] == "build" ? "build" : args[0] == "dev" ? "dev" : args[0] == "watch" ? "watch" : null
    if (mode == null) throw new Error("Invalid mode, expected build, watch or dev")

    const root = constants.installPath

    async function buildBackend(/** @type {boolean} */ isDev, /** @type {import("esbuild").Plugin | null} */ plugin = null) {
        const { build, context } = require("esbuild")

        await rm(join(root, "build"), { force: true, recursive: true })

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
            loader: {
                ".html": "text"
            }
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

    if (mode == "build") {
        const packageJSON = JSON.parse((await readFile(join(root, "package.json"))).toString())

        await buildBackend(false)

        try {
            await copy(join(root, "dist"), join(root, "build/frontend/dist"), { quiet: true })
        } catch {
            log("Missing frontend folder")
        }

        await writeFile(join(root, "build/package.json"), JSON.stringify({
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

    if (mode == "watch") {
        await watchBackend()
        return
    }

    if (mode == "dev") {
        run("yarn vite", root)
        await watchBackend()
    }
}, { desc: "Builds and or executes Node.js project :: Arguments: <build|watch|dev>", argc: 1 })
