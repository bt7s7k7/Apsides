#!/usr/bin/env node

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
    new ProjectBuilder(root).build(mode)
}
