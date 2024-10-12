import * as dotenv from "dotenv"
import { join } from "path"
import { Type } from "../struct/Type"

let root: string

if (import.meta.env.DEV) {
    // During development, the compiled file is stored in the ./build folder so we have to adjust the dirname
    root = join(import.meta.dirname, "..")
} else {
    root = import.meta.dirname
}

dotenv.config({ path: join(root, ".env.local") })
dotenv.config({ path: join(root, ".env") })

export const ENV = {
    MODE: import.meta.env.MODE,
    PATH: root,
    ...Type.object({
        PORT: Type.string
    }).deserialize(process.env),
}
