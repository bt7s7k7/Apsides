/// <reference path="./.vscode/config.d.ts" />
// @ts-check

const { project, github, join, constants, run, copy, getProjectDetails, log } = require("ucpem")
const { readdir, writeFile, mkdir, rm, readFile } = require("fs/promises")
const { extname, basename } = require("path")
const { readFileSync } = require("fs")

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

/** @typedef {{ name: string, version: string, devDependencies: Record<string, string>, dependencies: Record<string, string> } & Record<string, any>} PackageJson */
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
            callback = /** @type {((src: string, dest: string) => void) | null} */(null),
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
    }
}

function addVueDependencies(/** @type {PackageJson} */pkg) {
    const our = RESOURCES.getProjectPackageJSON()
    pkg.dependencies["vue"] = our.dependencies["vue"]
    pkg.dependencies["vue-router"] = our.dependencies["vue-router"]
}

const packages = [
    new Package("@apsides/struct", "struct", { customReadme: true }),
    new Package("@apsides/form-builder", "formBuilder", { dependencies: ["@apsides/struct", "@apsides/formML", "@apsides/ui"], packageMerge: addVueDependencies, customReadme: true }),
    new Package("@apsides/form-ml", "formML", { dependencies: ["@apsides/struct"], customReadme: true }),
    new Package("kompa", "comTypes"),
    new Package("@apsides/ui", "vue3gui", {
        umdName: "ApsidesUI", packageMerge: addVueDependencies,
        async callback(src, dest) {
            await copy(join(src, "eventDecorator.d.ts"), join(dest, "eventDecorator.d.ts"))
        }
    }),
]

project.script("build-index", async () => {
    /** @type {string[]} */
    const indexes = []
    const src = join(constants.projectPath, "src")

    for (const package of packages) {
        /** @type {string[]} */
        const files = []
        const path = package.getPath()
        for await (const dirent of await readdir(path, { withFileTypes: true })) {
            if (!dirent.isFile()) continue
            const ext = extname(dirent.name)
            if (ext != ".ts" && ext != ".tsx") continue
            const relativePath = "./" + package.folder + "/" + basename(dirent.name, ext)
            files.push(relativePath)
        }

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

    const viteBuildPromise = process.env.SKIP_VITE || buildVite()

    const version = RESOURCES.getProjectPackageJSON().version

    const repository = port?.source ?? "https://github.com/bt7s7k7/Apsides"

    /** @type {PackageJson} */
    const packageJSON = {
        name: package.name, version,
        dependencies: Object.fromEntries(package.dependencies.map(name => [name, version])),
        devDependencies: {},
        license: "MIT",
        author: "bt7s7k7",
        exports: {
            ".": {
                types: "./index.d.ts",
                import: "./index.es.js",
                require: "./index.umd.js"
            }
        },
        types: "./index.d.ts",
        repository: {
            type: "git",
            url: "git+" + repository
        },
        homepage: package.customReadme ? "https://github.com/bt7s7k7/Apsides/blob/master/docs/" + package.shortName + ".md" : repository + "#readme",
    }

    package.packageMerge?.(packageJSON)

    const tsConfig = RESOURCES.getProjectTSConfig()
    tsConfig.include?.pop()

    await viteBuildPromise

    await writeFile(join(outFolder, "package.json"), JSON.stringify(packageJSON, null, 4))
    await writeFile(join(outFolder, "tsconfig.json"), JSON.stringify(tsConfig, null, 4))

    await copy(join(typesFolder, package.folder), join(outFolder, package.folder), { replacements, quiet: !process.env.BUILD_DEBUG })
    await copy(join(typesFolder, "index_" + package.shortName + ".d.ts"), join(outFolder, "index.d.ts"), { quiet: !process.env.BUILD_DEBUG })

    const readme = await readFile(join(constants.projectPath, "docs", package.shortName + ".md")).catch(err => {
        if (err.code != "ENOENT") throw err

        const projectPath = project.path
        return readFile(join(projectPath, "README.md"))
    })

    await writeFile(join(outFolder, "README.md"), readme.toString())

    await copy(join(constants.projectPath, "LICENSE.md"), join(outFolder, "LICENSE.md"))

    await package.callback?.(typesFolder, outFolder)
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
