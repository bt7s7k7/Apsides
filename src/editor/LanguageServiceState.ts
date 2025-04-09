import CodeMirror, { Editor, Hint, HintFunction, Hints, Position } from "codemirror"
import "codemirror/addon/hint/show-hint.css"
import "codemirror/addon/hint/show-hint.js"
import "codemirror/addon/lint/lint.css"
import "codemirror/addon/lint/lint.js"
import { Annotation } from "codemirror/addon/lint/lint.js"
import { isWord } from "../comTypes/util"
import { EditorState } from "./useEditorState"

export interface LanguageServiceHintResult {
    list: Hint[]
    selectedHint?: number
}

export abstract class LanguageServiceState extends EditorState {
    public override isLanguageService(): this is LanguageServiceState { return true }

    /**
     * Standard handler of the hint helper, gets the current word and calls {@link _getHints}
     */
    public getHints(editor: Editor): ReturnType<HintFunction> {
        const cursor = editor.getCursor()
        const wordEnd = cursor.ch
        const lineContent = editor.getLine(cursor.line)
        let wordStart = wordEnd
        while (wordStart > 0 && isWord(lineContent, wordStart - 1)) wordStart--
        const word = lineContent.slice(wordStart, wordEnd).toLowerCase()

        const hints = this._getHints(editor, cursor, word)

        return {
            from: CodeMirror.Pos(cursor.line, wordStart),
            to: CodeMirror.Pos(cursor.line, wordEnd),
            ...hints,
        } satisfies Hints
    }

    /**
     * Gets called by {@link getHints} when the editor requests hints. If you want raw access to the editor override it.
    */
    protected abstract _getHints(editor: Editor, position: Position, word: string): LanguageServiceHintResult

    public abstract getAnnotations(code: string, editor: CodeMirror.Editor): Annotation[]
}
