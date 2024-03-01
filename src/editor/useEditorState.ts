import { reactive, shallowReactive } from "vue"
import { escapeHTML } from "../comTypes/util"
import { stringifyError } from "../vue3gui/util"

export type EditorState = ReturnType<typeof useEditorState>

export function useEditorState(callback: (code: string) => void) {
    return shallowReactive({
        errors: [] as string[],
        ast: null as string | null,
        loaded: null as string | null,
        result: reactive([]) as string[],
        ready: false,
        compile(code: string) {
            this.errors = []
            this.ast = null
            this.loaded = null
            this.result.length = 0

            try {
                callback(code)
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error(err)
                this.errors.push(`<span class="text-danger">Failed to run code due to internal error:<br />&nbsp;&nbsp;${escapeHTML(stringifyError(err))}</span>`)
            }
        }
    })
}
