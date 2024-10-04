import CodeMirror from "codemirror"
import { escapeRegex } from "../comTypes/util"
type Mode = Parameters<typeof CodeMirror.defineSimpleMode>[1]

export interface CreateModeOptions {
    keywords?: string[],
    keywordsWithModifiers?: Record<string, string[]>
    constants?: string[]
    defs?: string[]
    strings?: { start: string, end: string }[]
    lineComment?: string | boolean
    multilineComment?: { start: string, end: string }
    indent?: string[]
    dedent?: string[]
    pascalCaseAsType?: boolean
    hexNumbers?: boolean
    binaryNumbers?: boolean
    decimalNumbers?: false | "integers" | "floats" | "scientific"
    operators?: string[]
    functionCalls?: boolean
}

// Token types:
//     - `keyword` => purple
//     - `atom` => dark blue
//     - `number` => dark green
//     - `def` => blue
//     - `variable`, `punctuation`, `property`, `operator` => no default style
//     - `variable-2` => light blue
//     - `variable-3` => light green
//     - `comment` => brown
//     - `string` => red
//     - `string-2` => orange
//     - `meta`, `qualifier` => grey
//     - `builtin` => dark blue
//     - `bracket` => light khaki
//     - `tag` => green
//     - `attribute` => blue
//     - `hr` => light grey
//     - `link` => blue
//     - `error` => red

export function createMode(options: CreateModeOptions) {
    const mode: Mode = { start: [] }
    const meta: Record<string, any> = {}

    const start = mode.start

    if (options.lineComment) {
        const lineComment = typeof options.lineComment == "string" ? options.lineComment : "//"
        meta.lineComment = lineComment
        start.push({ regex: new RegExp("\\/\\/.*"), token: "comment" })
    }

    if (options.multilineComment) {
        start.push({ regex: new RegExp(escapeRegex(options.multilineComment.start)), token: "comment", push: "multi_comment" })
        mode.multi_comment = [
            { regex: new RegExp(escapeRegex(options.multilineComment.start)), token: "comment", push: "multi_comment" },
            { regex: new RegExp(escapeRegex(options.multilineComment.end)), token: "comment", pop: true },
            { regex: new RegExp(`.+?(?=${escapeRegex(options.multilineComment.start)}|${escapeRegex(options.multilineComment.end)}|$)`), token: "comment" },
        ]
    }

    if (options.keywords) {
        start.push({ regex: new RegExp(`\\b(?:${options.keywords.map(escapeRegex).join("|")})\\b`), token: "keyword" })
    }

    if (options.constants) {
        start.push({ regex: new RegExp(`\\b(?:${options.constants.map(escapeRegex).join("|")})\\b`), token: "variable-2" })
    }

    if (options.defs) {
        start.push({ regex: new RegExp(`\\b(?:${options.defs.map(escapeRegex).join("|")})\\b`), token: "def" })
    }

    if (options.keywordsWithModifiers) {
        for (const [keyword, modifiers] of Object.entries(options.keywordsWithModifiers)) {
            start.push({ regex: new RegExp(`((?:(?:${modifiers.map(escapeRegex).join("|")})\\s+)*)(${escapeRegex(keyword)})`), token: ["atom", "keyword"] })
        }
    }

    if (options.strings) {
        let number = 0
        for (const string of options.strings) {
            number++
            const id = "string_" + number
            start.push({ regex: new RegExp(escapeRegex(string.start)), token: "string", push: id })
            mode[id] = [
                { regex: new RegExp(`\\\\.`), token: "string" },
                { regex: new RegExp(escapeRegex(string.end)), token: "string", pop: true },
                { regex: new RegExp(`[^\\\\${escapeRegex(string.end)}]+`), token: "string" },
            ]
        }
    }

    if (options.hexNumbers) {
        start.push({ regex: /0x[0-9abcdef]+/i, token: "number" })
    }

    if (options.binaryNumbers) {
        start.push({ regex: /0b[01]+/, token: "number" })
    }

    if (options.decimalNumbers == "scientific") {
        start.push({ regex: /[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/, token: "number" })
    } else if (options.decimalNumbers == "floats") {
        start.push({ regex: /[0-9]+(?:\.[0-9]+)?/, token: "number" })
    } else if (options.decimalNumbers == "integers") {
        start.push({ regex: /[0-9]/, token: "number" })
    }

    if (options.pascalCaseAsType) {
        start.push({ regex: new RegExp("(?:[A-Z]|_[A-Z])\\w*"), token: "def" })
    }

    if (options.functionCalls) {
        start.push({ regex: new RegExp("[a-zA-Z_]\\w*(?=[(<])"), token: "atom" })
    }

    start.push({ regex: new RegExp("[a-zA-Z_]\\w*"), token: "variable" })

    // @ts-ignore
    mode.meta = meta

    return mode
}
