/// <reference path="./.vscode/config.d.ts" />
// @ts-check

const { project, github, join, constants, copy, getProjectDetails, log, include, run } = require("ucpem")
const { PackageBuilder } = require("./src/projectBuilder/PackageBuilder")
const { ProjectBuilder } = require("./src/projectBuilder/ProjectBuilder")
const { multicast } = require("./src/comTypes/util")
const { readFile, writeFile, rm } = require("fs/promises")
const { dirname } = require("path")

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

project.prefix("src").res("projectBuilder")

function getPackageBuilder() {
    const builder = new PackageBuilder(constants.projectPath, getProjectDetails(), "https://github.com/bt7s7k7/Apsides")

    /** @typedef {import("./src/projectBuilder/config").PackageJson} PackageJson */

    function addVueDependencies(/** @type {PackageJson} */pkg) {
        const our = builder.getProjectPackageJSON()
        pkg.dependencies["vue"] = our.dependencies["vue"]
        pkg.dependencies["vue-router"] = our.dependencies["vue-router"]
    }

    function addHono(/** @type {PackageJson} */pkg) {
        const our = builder.getProjectPackageJSON()
        pkg.dependencies["hono"] = our.dependencies["hono"]
        pkg.dependencies["@hono/node-server"] = our.dependencies["@hono/node-server"]
    }

    function addSocketIO(/** @type {PackageJson} */pkg) {
        const our = builder.getProjectPackageJSON()
        pkg.dependencies["socket.io"] = our.dependencies["socket.io"]
        pkg.dependencies["socket.io-client"] = our.dependencies["socket.io-client"]
        if (our.optionalDependencies) {
            pkg.optionalDependencies ??= {}
            pkg.optionalDependencies["bufferutil"] = our.optionalDependencies["bufferutil"]
            pkg.optionalDependencies["utf-8-validate"] = our.optionalDependencies["utf-8-validate"]
        }
    }

    function addDebug(/** @type {PackageJson} */pkg) {
        const our = builder.getProjectPackageJSON()
        pkg.dependencies["debug"] = our.dependencies["debug"]
    }

    builder
        .addPackage("@apsides/struct", "struct", { customReadme: true, strategy: "esbuild" })
        .addPackage("@apsides/form-builder", "formBuilder", { dependencies: ["@apsides/struct", "@apsides/form-ml", "@apsides/ui"], packageMerge: addVueDependencies, customReadme: true })
        .addPackage("@apsides/form-ml", "formML", { dependencies: ["@apsides/struct", "kompa"], customReadme: true, strategy: "esbuild" })
        .addPackage("kompa", "comTypes", { strategy: "esbuild" })
        .addPackage("@apsides/ui", "vue3gui", {
            umdName: "ApsidesUI", packageMerge: addVueDependencies,
            async callback(src, dest) {
                await copy(join(src, "eventDecorator.d.ts"), join(dest, "eventDecorator.d.ts"))
            },
        })
        .addPackage("@apsides/events", "events", { customReadme: true, dependencies: ["kompa"], strategy: "esbuild" })
        .addPackage("@apsides/object-description", "prettyPrint", { customReadme: true, strategy: "esbuild" })
        .addPackage("@apsides/services", "serviceProvider", { customReadme: true, dependencies: ["kompa", "@apsides/events"], strategy: "esbuild" })
        .addPackage("@apsides/foundation", "foundation", { customReadme: true, dependencies: ["@apsides/object-description", "@apsides/services"], strategy: "esbuild" })
        .addPackage("@apsides/rpc", "structRpc", { customReadme: true, dependencies: ["@apsides/struct", "@apsides/foundation"], strategy: "esbuild", packageMerge: addDebug })
        .addPackage("@apsides/hono-integration", "honoService", { customReadme: true, dependencies: ["@apsides/foundation"], packageMerge: addHono, strategy: "esbuild" })
        .addPackage("@apsides/socket.io-integration", "socketIOTransport", { customReadme: true, dependencies: ["@apsides/foundation"], packageMerge: multicast(addSocketIO, addDebug), strategy: "esbuild" })
        .addPackage("@apsides/rest-integration", "restTransport", {
            customReadme: true, dependencies: ["@apsides/hono-integration", "@apsides/rpc"], strategy: "esbuild",
            packageMerge(pkg) {
                pkg.exports["./page.html"] = "./page.html"
                addDebug(pkg)
            },
            async callback(src, dest) {
                await copy(join(src, "../src/restTransport/page.html"), join(dest, "page.html"))
            },
        })
        .addPackage("@apsides/vue-integration", "vueFoundation", { customReadme: true, dependencies: ["@apsides/foundation", "@apsides/ui"], packageMerge: addDebug })
        .addPackage("@apsides/project-builder", "projectBuilder", {
            customReadme: true, strategy: "esbuild", entryPoint: "src/projectBuilder/bin.ts",
            async callback(src, dest) {
                await copy(join(src, "../src/projectBuilder/esbuild.d.ts"), join(dest, "esbuild.d.ts"))
            },
            packageMerge(pkg) {
                pkg.bin = { "builder": "./index.cjs" }
                pkg.dependencies["ucpem"] = "2.9.0"
            },
        })

    return builder
}

project.script("build-index", async () => {
    await getPackageBuilder().buildIndex()
}, { desc: "Creates index files for all packages" })

project.script("build-package", async ([packageName]) => {
    await getPackageBuilder().buildPackage(packageName)
}, { desc: "Builds a package :: Arguments: <name>", argc: 1 })

project.script("get-dev-resolution-object", async () => {
    log(JSON.stringify(getPackageBuilder().getDevResolutionObject(), null, 4))
}, { desc: "Returns a configuration for project resolution to be used in dependant projects during development" })

project.script("build-all", async () => {
    await getPackageBuilder().buildAll()
}, { desc: "Builds all packages" })

project.script("build-clean", async () => {
    await getPackageBuilder().clean()
})

project.script("builder", async (args) => {
    const mode = args[0] == "build" ? "build" : args[0] == "dev" ? "dev" : args[0] == "watch" ? "watch" : args[0] == "vite" ? "vite" : args[0] == "run" ? "run" : null
    if (mode == null) throw new Error("Invalid mode, expected build, watch or dev")

    const root = constants.installPath
    await new ProjectBuilder(root).build(mode)
}, { desc: "Builds and or executes Node.js project :: Arguments: <build|watch|dev|vite|run>", argc: 1 })

project.script("publish-all", async () => {
    const packages = Object.values(getPackageBuilder().getDevResolutionObject())
    for (const package of packages) {
        await run("npm publish --dry-run", package.slice(5))
    }
}, { desc: "Publishes packages to NPM" })

project.script("clear-resolve", async ([path, verb_1]) => {
    const verb = verb_1 == "apply" ? "apply" : verb_1 == "undo" ? "undo" : null
    if (verb == null) new Error("Invalid verb, expected apply or undo")

    if (verb == "apply") {
        const originalData = await readFile(path, { encoding: "utf-8" })
        let didChanges = false
        const package = JSON.parse(originalData)
        if ("resolutions" in package) {
            for (const [key, value] of Object.entries(package.resolutions)) {
                if (value.startsWith("file:")) {
                    delete package.resolutions[key]
                    didChanges = true
                }
            }
            if (JSON.stringify(package.resolutions) == "{}") {
                delete package.resolutions
            }
        }

        for (const target of [package.dependencies, package.devDependencies]) {
            for (const [key, value] of Object.entries(target)) {
                if (value.startsWith("file:/")) {
                    didChanges = true
                    const targetPath = join(dirname(path), "node_modules", key, "package.json")
                    const targetPackage = JSON.parse(await readFile(targetPath, { encoding: "utf-8" }))
                    const version = targetPackage.version
                    target[key] = "^" + version
                }
            }
        }

        if (didChanges) {
            await writeFile(path + ".local", originalData)
            await writeFile(path, JSON.stringify(package, null, 4))
        }
    } else {
        await copy(path + ".local", path)
        await rm(path + ".local")
    }
}, { desc: "Replaces all file paths in package.json with their real version or undoes this operation :: <path> <apply|undo>", argc: 2 })
