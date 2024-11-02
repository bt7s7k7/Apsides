import { join } from "path"
import { PackageBuilder } from "./PackageBuilder"
import { PackageJson } from "./config"

export class Package {
    public getPath() {
        return join(this.builder.root, "src", this.folder)
    }

    public applyDependencies(packageJSON: PackageJson) {
        const version = packageJSON.version
        for (const dependency of this.dependencies) {
            packageJSON.dependencies[dependency] = version
            const dependencyPackages = this.builder.packagesLookup.get(dependency)
            if (dependencyPackages == null) throw new TypeError("Cannot find package: " + dependency)
            dependencyPackages.applyDependencies(packageJSON)
        }

        this.packageMerge?.(packageJSON)
    }

    public async executeCallback(src: string, dest: string) {
        await this.callback?.(src, dest)

        for (const dependency of this.dependencies) {
            const dependencyPackages = this.builder.packagesLookup.get(dependency)
            if (dependencyPackages == null) throw new TypeError("Cannot find package: " + dependency)
            await dependencyPackages.executeCallback(src, dest)
        }
    }

    public readonly name
    public readonly folder
    public readonly shortName
    public readonly umdName
    public readonly dependencies
    public readonly packageMerge
    public readonly callback
    public readonly customReadme
    public readonly strategy
    public readonly resource
    public readonly entryPoint

    constructor(
        public readonly builder: PackageBuilder,
        name: string, folder: string,
        {
            umdName = null as string | null,
            dependencies = [] as string[],
            packageMerge = null as ((pkg: PackageJson) => void) | null,
            callback = null as ((src: string, dest: string) => Promise<void>) | null,
            strategy = "vite" as "vite" | "esbuild",
            customReadme = false,
            resource = null as string | null,
            entryPoint = null as string | null
        } = {}
    ) {
        this.name = name
        this.folder = folder
        this.shortName = name.split("/").at(-1)!
        this.umdName = umdName ?? /** @type {string} */(name.replace(/^@/, "").split("/").map(v => v[0].toUpperCase() + v.slice(1)).join(""))
        this.dependencies = dependencies
        this.packageMerge = packageMerge
        this.callback = callback
        this.customReadme = customReadme
        this.strategy = strategy
        this.resource = resource
        this.entryPoint = entryPoint
    }
}
