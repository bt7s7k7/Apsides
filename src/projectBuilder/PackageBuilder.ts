/// <reference path="../../.vscode/config.d.ts" />

import { log } from "console"
import { readFileSync } from "fs"
import { mkdir, readdir, readFile, rm, writeFile } from "fs/promises"
import { basename, extname, join, relative } from "path"
import { copy, ProjectDetails, run } from "ucpem"
import { ShiftTuple } from "../comTypes/types"
import { Package } from "./Package"
import { PackageJson, TSConfig } from "./config"

export interface LibDef {
    name: string
    entry: string
    extern: Map<string, string>
    neighbours: Map<string, string>
    outDir: string
}

export class PackageBuilder {
    public readonly packages: Package[] = []
    public readonly packagesLookup = new Map<string, Package>()

    public shouldBuildTypes = true
    public shouldBuildEsm = true
    public shouldCreateMasterIndex = true

    public addPackage(...args: ShiftTuple<ConstructorParameters<typeof Package>>) {
        const pkg = new Package(this, ...args)
        this.packages.push(pkg)
        this.packagesLookup.set(pkg.name, pkg)
        return this
    }

    protected _projectPackageJSON: PackageJson | null = null
    public getProjectPackageJSON() {
        return this._projectPackageJSON ??= JSON.parse(readFileSync(join(this.root, "package.json")).toString()) as never
    }

    protected _projectTSConfig: TSConfig | null = null
    public getProjectTSConfig() {
        return this._projectTSConfig ??= JSON.parse(readFileSync(join(this.root, "tsconfig.json")).toString()) as never
    }

    public async buildIndex() {
        const indexes: string[] = []
        const src = join(this.root, "src")

        for (const pkg of this.packages) {
            const files: string[] = []
            const rootPath = pkg.getPath()

            async function visit(path: string) {
                for await (const dirent of await readdir(path, { withFileTypes: true })) {
                    if (dirent.isDirectory()) {
                        await visit(join(path, dirent.name))
                        continue
                    }

                    if (!dirent.isFile()) continue
                    const ext = extname(dirent.name)
                    if (dirent.name.endsWith(".d.ts")) continue
                    if (ext != ".ts" && ext != ".tsx") continue
                    const relativePath = "./" + pkg.folder + "/" + relative(rootPath, join(path, basename(dirent.name, ext)))
                    files.push(relativePath)
                }
            }

            await visit(rootPath)

            const index = "index_" + pkg.shortName
            indexes.push(index)
            await writeFile(join(src, index) + ".ts", files.map(file => `export * from "${file}"`).join("\n") + "\n")
        }

        if (this.shouldCreateMasterIndex) {
            await writeFile(join(src, "index.ts"), indexes.map(file => `export * from "./${file}"`).join("\n") + "\n")
        }
    }

    public async buildPackage(packageName: string) {
        const pkg = this.packages.find(v => v.shortName == packageName)
        if (pkg == null) throw new Error("Cannot find package " + JSON.stringify(packageName))

        const outFolder = join(this.root, "pkg-" + pkg.shortName)
        const typesFolder = join(this.root, "dist-types")
        const allProjects = this.project
        const root = this.root

        const resource = pkg.resource != null ? (
            Object.values(allProjects.resources).find(v => v.resourceName.endsWith(pkg.resource!))
        ) : (
            Object.values(allProjects.resources).find(v => v.path.endsWith(pkg.folder))
        )
        if (!resource) {
            // eslint-disable-next-line no-console
            console.log(allProjects, pkg)
            throw new Error("Cannot find resource " + (pkg.resource ?? pkg.folder))
        }
        const project = allProjects.projects[resource.portName]
        const port = allProjects.ports[resource.portName]

        await rm(outFolder, { recursive: true }).catch(err => { if (err.code == "ENOENT") return; throw err })
        await mkdir(outFolder)

        const viteOptions: LibDef = {
            name: pkg.umdName,
            entry: pkg.entryPoint ?? join("src", "index_" + pkg.shortName + ".ts"),
            extern: new Map(),
            neighbours: new Map(),
            outDir: outFolder,
        }

        const replacements: Parameters<typeof copy>[2] = []

        for (const externPkg of this.packages) {
            if (externPkg == pkg) continue
            viteOptions.extern.set(externPkg.folder, externPkg.name)
            viteOptions.neighbours.set(externPkg.name, externPkg.umdName)
            replacements.push([new RegExp(`"(?:\\.\\.\\/)*\\.\\.\\/${externPkg.folder}(?:\\/[^"]*)?"`, "g"), "\"" + externPkg.name + "\""])
        }

        async function buildVite() {
            // @ts-ignore
            viteOptions.extern = Object.fromEntries(viteOptions.extern)
            // @ts-ignore
            viteOptions.neighbours = Object.fromEntries(viteOptions.neighbours)
            process.env.LIB_OPTIONS = JSON.stringify(viteOptions)
            await run("yarn vite build", root)
        }

        const buildEsbuild = async () => {
            const { build } = (require("esbuild") as typeof import("esbuild"))

            let options: Parameters<typeof build>[0] = {
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
                    "using": false,
                },
                external: [...viteOptions.extern.keys()].map(v => "./src/" + v + "/*"),
                write: false,
            }

            async function buildAndProcess() {
                const result = await build(options)
                if (result.outputFiles == null) throw new TypeError()
                for (const file of result.outputFiles) {
                    let content = file.text
                    if (!file.path.endsWith(".map")) {
                        for (const [folder, pkg] of viteOptions.extern) {
                            content = content.replace(new RegExp(`(?:\\.\\.\\/)*\\.\\.\\/src\\/${folder}(?:\\/[^"]*)?(?=")`, "g"), pkg)
                        }
                    }

                    await writeFile(file.path, content)
                }
            }

            const step1 = this.shouldBuildEsm ? buildAndProcess() : Promise.resolve()

            options = {
                ...(options as Parameters<typeof build>[0]),
                format: "cjs",
                outfile: join(viteOptions.outDir, "index.cjs"),
            }

            const step2 = buildAndProcess()

            await step1
            await step2
        }

        const viteBuildPromise = process.env.SKIP_VITE || (pkg.strategy == "esbuild" ? buildEsbuild() : buildVite())

        const version = this.getProjectPackageJSON().version

        const repository = port?.source ?? this.repository

        const packageJSON: PackageJson = {
            name: pkg.name, version,
            dependencies: {},
            devDependencies: {},
            license: "MIT",
            author: "bt7s7k7",
            exports: {
                ".": pkg.strategy == "vite" ? {
                    types: "./index.d.ts",
                    import: "./index.es.js",
                    require: "./index.umd.js",
                } : {
                    types: "./index.d.ts",
                    import: "./index.mjs",
                    require: "./index.cjs",
                },
            },
            types: "./index.d.ts",
            repository: {
                type: "git",
                url: "git+" + repository,
            },
            homepage: pkg.customReadme ? this.repository + "/blob/master/docs/" + pkg.shortName + ".md" : repository + "#readme",
        }

        if (!this.shouldBuildTypes) {
            delete packageJSON.types
            delete packageJSON.exports["."].types
        }

        if (!this.shouldBuildEsm) {
            delete packageJSON.exports["."].import
        }

        pkg.applyDependencies(packageJSON)

        const tsConfig = this.getProjectTSConfig()
        tsConfig.include?.pop()

        await viteBuildPromise

        await writeFile(join(outFolder, "package.json"), JSON.stringify(packageJSON, null, 4))
        await writeFile(join(outFolder, "tsconfig.json"), JSON.stringify(tsConfig, null, 4))

        if (this.shouldBuildTypes) {
            await copy(join(typesFolder, pkg.folder), join(outFolder, pkg.folder), { replacements, quiet: !process.env.BUILD_DEBUG })
            await copy(join(typesFolder, "index_" + pkg.shortName + ".d.ts"), join(outFolder, "index.d.ts"), { quiet: !process.env.BUILD_DEBUG })
        }

        await copy(join("src", pkg.folder), outFolder, { predicate: (path) => path.endsWith(".scss") })

        const readme = await readFile(join(this.root, "docs", pkg.shortName + ".md")).catch(err => {
            if (err.code != "ENOENT") throw err

            const projectPath = project.path
            return readFile(join(projectPath, "README.md")).catch(err => {
                if (err.code != "ENOENT") throw err
                // eslint-disable-next-line no-console
                console.error(`\x1b[93m[WARN] No readme file found\x1b[0m`)
                return null
            })
        })

        if (readme != null) {
            await writeFile(join(outFolder, "README.md"), readme.toString())
        }

        await copy(join(this.root, "LICENSE.md"), join(outFolder, "LICENSE.md")).catch(err => {
            if (err.code != "ENOENT") throw err
            return copy(join(this.root, "LICENSE"), join(outFolder, "LICENSE")).catch(err => {
                if (err.code != "ENOENT") throw err
                // eslint-disable-next-line no-console
                console.error(`\x1b[93m[WARN] No license file found\x1b[0m`)
            })
        })

        await pkg.executeCallback(typesFolder, outFolder)
    }

    public getDevResolutionObject() {
        const result: Record<string, string> = {}

        for (const pkg of this.packages) {
            const outFolder = join(this.root, "pkg-" + pkg.shortName)
            result[pkg.name] = `file:${outFolder}`
        }

        return result
    }

    public async buildAll() {
        await this.buildIndex()

        if (this.shouldBuildTypes && !process.env.SKIP_TS) {
            await run("yarn tsc --emitDeclarationOnly", this.root)
            await run("yarn eslint --fix dist-types", this.root)
        }

        const queue: Promise<void>[] = []

        for (const pkg of this.packages) {
            queue.push(this.buildPackage(pkg.shortName))
        }

        await Promise.all(queue)
    }

    public async clean() {
        for await (const dirent of await readdir(this.root)) {
            if (dirent.startsWith("pkg-")) {
                log("Deleting " + dirent)
                await rm(join(this.root, dirent), { recursive: true })
            }
        }
    }

    constructor(
        public readonly root: string,
        public readonly project: ProjectDetails,
        public readonly repository: string,
    ) { }
}
