import { existsSync } from "fs"
import { join } from "path/posix"
import { ProjectBuilder } from "./ProjectBuilder"


export async function executeProjectBuilder(root: string, args: string[]) {
    const argument = args.shift()!
    const mode = argument == "build" ? "build" : argument == "dev" ? "dev" : argument == "watch" ? "watch" : argument == "vite" ? "vite" : argument == "run" ? "run" : null
    if (mode == null) throw new Error("Invalid mode, expected: build, dev, watch, run, vite")

    const builder = new ProjectBuilder(root)

    for (const file of ["builder.js", "builder.cjs"]) {
        const configFile = join(root, file)
        if (existsSync(configFile)) {
            const settings = require(configFile)
            Object.assign(builder, settings)
        }
    }

    builder.runArguments.push(...args)

    await builder.build(mode)
}
