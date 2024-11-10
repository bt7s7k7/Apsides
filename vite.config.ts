/* eslint-disable no-console */
import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import * as dotenv from "dotenv"
import { join } from "path"
import { Alias, Plugin, UserConfigExport, defineConfig } from "vite"
import { GenericParser } from "./src/comTypes/GenericParser"
import { Optional } from "./src/comTypes/Optional"
import { isWord, modify } from "./src/comTypes/util"
import { Type } from "./src/struct/Type"

const _SNIPPETS_IMPORT: Plugin = {
    name: "snippets",
    apply: () => true,
    transform(source, id, options) {
        if (!id.endsWith("?snippets")) return

        const result: [string, string][] = []
        const lines = source.split("\n")

        let functionData: { name: string, lines: string[] } | null = null
        const parser = new GenericParser()

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i]
            parser.restart(line)

            if (functionData == null) {
                if (parser.consume("function ")) {
                    const name = parser.readWhile(isWord)
                    functionData = { name, lines: [] }
                }
            } else {
                if (line == "}") {
                    result.push([functionData.name, functionData.lines.join("\n")])
                    functionData = null
                    continue
                }

                functionData.lines.push(line.slice(4))
            }
        }

        const resultJSON = JSON.stringify(Object.fromEntries(result))

        return {
            code: `export default JSON.parse(${JSON.stringify(resultJSON)})`,
            map: { mappings: "" },
        }
    },
}

const LibDef_t = Type.object({
    name: Type.string,
    entry: Type.string,
    extern: Type.string.as(Type.map),
    neighbours: Type.string.as(Type.map),
    outDir: Type.string,
})

export type LibDef = Type.Extract<typeof LibDef_t>

// https://vitejs.dev/config/
export default defineConfig(() => {
    dotenv.config({ path: join(__dirname, ".env.local") })
    dotenv.config({ path: join(__dirname, ".env") })

    const config: UserConfigExport = {
        plugins: [
            _SNIPPETS_IMPORT,
            vue(), vueJsx(),
        ],
        resolve: {
            preserveSymlinks: true,
            alias: [],
        },
        server: {
            port: +(process.env.PORT ?? 8080),
            /* proxy: {
                "^/api": { target: process.env.BACKEND_URL, changeOrigin: true },
            } */
        },
        build: {},
    }

    const options = Optional.value(process.env.LIB_OPTIONS).do(v => v == null ? null : LibDef_t.deserialize(JSON.parse(v))).unwrap()
    if (options != null) {
        if (process.env.BUILD_DEBUG) {
            config.plugins!.unshift({
                name: "debug-print",
                configResolved(config) {
                    console.log(config.build.rollupOptions.output)
                },
                transform(code, id, options) {
                    console.log(id, options)
                },
            })
        }

        modify(config.build!, {
            sourcemap: true,
            lib: {
                entry: options.entry,
                name: options.name,
                fileName: (format) => `index.${format}.js`,
            },
            rollupOptions: {
                external: ["vue", "vue-router", ...options.extern.values()],
                output: {
                    globals: {
                        vue: "Vue",
                        "vue-router": "VueRouter",
                        ...Object.fromEntries(options.neighbours),
                    },
                },
            },
            outDir: options.outDir,
        })

        for (const [folder, pkg] of options.extern) {
            (config.resolve!.alias! as Alias[]).push({
                find: new RegExp(`^\\.\\./${folder}.*$`),
                replacement: pkg,
            })
        }
    }

    return config
})
