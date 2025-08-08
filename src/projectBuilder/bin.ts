#!/usr/bin/env node

import { executeProjectBuilder } from "./executeProjectBuilder"

export * from "./config"
export * from "./Package"
export * from "./PackageBuilder"
export * from "./ProjectBuilder"

if (require.main == module) {
    const root = process.cwd()
    executeProjectBuilder(root, process.argv.slice(2))
}
