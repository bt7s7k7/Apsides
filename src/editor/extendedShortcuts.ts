import CodeMirror, { KeyMap } from "codemirror"
import { escapeRegex, reverseIterate } from "../comTypes/util"

export function searchInCodeMirrorDocument(cm: CodeMirror.Editor | CodeMirror.Doc, query: string, start: CodeMirror.Position | null = null, end: CodeMirror.Position | null = null) {
    const queryRegex = new RegExp(escapeRegex(query))
    const startLine = (start ?? cm.posFromIndex(0)).line
    const endLine = end?.line ?? cm.lastLine()

    for (let i = startLine; i <= endLine; i++) {
        let line = cm.getLine(i)

        if (i == endLine && end != null) {
            line = line.slice(0, end.ch)
        }

        if (i == startLine && start != null) {
            line = line.slice(start.ch)
        }

        const match = queryRegex.exec(line)
        if (match) {
            let matchIndex = match.index
            if (i == startLine && start != null) {
                matchIndex += start.ch
            }

            return { line: i, ch: matchIndex } as CodeMirror.Position
        }
    }

    return null
}

export const EXTENDED_SHORTCUTS: KeyMap = {
    "Shift-Ctrl-L": "deleteLine",
    "Ctrl-D"(cm) {
        const lines = new Set<number>()
        for (const selection of cm.listSelections()) {
            const startLine = selection.from().line
            const endLine = selection.to().line
            for (let i = startLine; i <= endLine; i++) {
                lines.add(i)
            }
        }

        const linesArray = [...lines]
        for (const line of reverseIterate(linesArray)) {
            const lineContent = cm.getLine(line)
            const lineEnd = { ch: lineContent.length, line }
            cm.replaceRange("\n" + lineContent, lineEnd, lineEnd)
        }
    },
    "Shift-Tab": "indentLess",
    "Shift-Alt-D"(cm) {
        if (!cm.somethingSelected()) {
            const current = cm.findWordAt(cm.getCursor())
            cm.addSelection(current.from(), current.to())
            return
        }

        const selections = cm.listSelections()
        const current = selections.at(-1)!

        const word = cm.getRange(current.from(), current.to())

        const searchResult = searchInCodeMirrorDocument(cm, word, current.to())
        if (searchResult) {
            cm.addSelection(searchResult, { line: searchResult.line, ch: searchResult.ch + word.length })
        }
    },
}
