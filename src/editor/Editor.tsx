import { EditorConfiguration, EditorFromTextArea, KeyMap, TextMarker, fromTextArea } from "codemirror"
import "codemirror/addon/mode/simple.js"
import "codemirror/lib/codemirror.css"
import { PropType, defineComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"

export type EditorHighlightOptions = { offset: number, length: number, lineOffset?: number }
export const Editor = (defineComponent({
    name: "Editor",
    props: {
        content: { type: String, default: "" },
        highlight: { type: Object as PropType<EditorHighlightOptions | null> },
        mode: { type: String },
        config: { type: Object as PropType<EditorConfiguration> }
    },
    emits: {
        change: (value: string) => true
    },
    setup(props, ctx) {
        const textarea = ref<HTMLTextAreaElement>()
        let editor: EditorFromTextArea | null = null
        let value = props.content

        watch(() => props.content, newValue => {
            if (!editor) return
            if (newValue != editor.getValue()) editor.setValue(newValue)
        })

        onMounted(() => {
            editor = fromTextArea(textarea.value!, {
                lineNumbers: true,
                mode: props.mode ?? "simple",
                lineWrapping: true,
                indentUnit: 4,
                ...props.config,
                extraKeys: {
                    ...(props.config?.extraKeys as KeyMap | undefined),
                    "Ctrl-S": () => ctx.emit("change", value)
                },
            })

            editor.setValue(props.content)

            editor.getWrapperElement().classList.add("absolute-fill")
            nextTick(() => editor!.refresh())

            editor.on("change", () => {
                value = editor!.getValue()
            })

            editor.on("blur", () => {
                ctx.emit("change", value)
            })
        })

        onBeforeUnmount(() => {
            ctx.emit("change", value)
        })

        let lastHighlight: TextMarker | null = null
        watch(() => props.highlight, highlight => {
            if (lastHighlight) {
                lastHighlight.clear()
                lastHighlight = null
            }

            if (editor == null) return
            if (highlight == null) return

            let offset = highlight.offset
            if (highlight.lineOffset) {
                offset += editor.indexFromPos({ ch: 0, line: highlight.lineOffset })
            }

            const start = editor.posFromIndex(offset)
            const end = editor.posFromIndex(offset + highlight.length)


            editor.scrollIntoView(start)
            lastHighlight = editor.getDoc().markText(start, end, {
                className: "bg-warning-translucent"
            })
        })

        return () => (
            <div>
                <textarea ref={textarea} value="" />
            </div>
        )
    }
}))
