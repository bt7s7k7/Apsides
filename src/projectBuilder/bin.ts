#!/usr/bin/env node

import { existsSync } from "fs"
import { join } from "path"
import { ProjectBuilder } from "./ProjectBuilder"

export * from "./config"
export * from "./Package"
export * from "./PackageBuilder"
export * from "./ProjectBuilder"

if (require.main == module) {
    const argument = process.argv.at(-1)!
    const mode = argument == "build" ? "build" : argument == "dev" ? "dev" : argument == "watch" ? "watch" : argument == "vite" ? "vite" : argument == "run" ? "run" : null
    if (mode == null) throw new Error("Invalid mode, expected: build, dev, watch, run, vite")

    const root = process.cwd()

    const builder = new ProjectBuilder(root)

    const configFile = join(root, "builder.js")
    if (existsSync(configFile)) {
        const settings = require(configFile)
        Object.assign(builder, settings)
    }

    builder.build(mode)
}
