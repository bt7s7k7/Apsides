import * as dotenv from "dotenv"
import { join } from "path"
import { Type } from "../struct/Type"

dotenv.config({ path: join(import.meta.dirname, ".env.local") })
dotenv.config({ path: join(import.meta.dirname, ".env") })

export const ENV = Type.object({
    PORT: Type.string
}).deserialize(process.env)
