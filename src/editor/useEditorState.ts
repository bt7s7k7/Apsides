import { reactive, shallowReactive, shallowRef } from "vue"
import { escapeHTML } from "../comTypes/util"
import { stringifyError } from "../vue3gui/util"
import { LanguageServiceState } from "./LanguageServiceState"

export abstract class EditorState {
    public readonly code = shallowRef("")

    public readonly errors: string[] = reactive([])
    public ready = false
    public abstract getOutput(): EditorState.OutputTab[]

    public isLanguageService(): this is LanguageServiceState { return false }

    public compile(code: string) {
        this.ready = false
        this.errors.length = 0

        try {
            this._compile(code)
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error(err)
            this.errors.push(`<span class="text-danger">Failed to run code due to internal error:<br />&nbsp;&nbsp;${escapeHTML(stringifyError(err))}</span>`)
        }
    }

    protected abstract _compile(code: string): void

    constructor() {
        return shallowReactive(this)
    }
}

export namespace EditorState {
    export interface OutputTab {
        name: string
        label: string
        content: string | (() => any)
    }
}
