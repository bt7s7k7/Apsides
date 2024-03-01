import vue from "@vitejs/plugin-vue"
import vueJsx from "@vitejs/plugin-vue-jsx"
import * as dotenv from "dotenv"
import { join } from "path"
import { Plugin, defineConfig } from "vite"
import { GenericParser } from "./src/comTypes/GenericParser"
import { isWord } from "./src/comTypes/util"

const _SNIPPETS_IMPORT: Plugin = {
    name: "snippets",
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
            map: { mappings: "" }
        }
    },
}

// https://vitejs.dev/config/
export default defineConfig(() => {
    dotenv.config({ path: join(__dirname, ".env.local") })
    dotenv.config({ path: join(__dirname, ".env") })

    return {
        plugins: [
            _SNIPPETS_IMPORT,
            vue(), vueJsx()
        ],
        resolve: {
            preserveSymlinks: true
        },
        server: {
            port: +(process.env.PORT ?? 8080),
            /* proxy: {
                "^/api": { target: process.env.BACKEND_URL, changeOrigin: true },
            } */
        }
    }
})
