import CodeMirror, { EditorConfiguration, Editor as Editor_1, KeyMap, TextMarker } from "codemirror"
import "codemirror/addon/mode/simple.js"
import "codemirror/lib/codemirror.css"
import { PropType, defineComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { eventDecorator } from "../eventDecorator"
import { MountNode } from "../vue3gui/MountNode"
import { EXTENDED_SHORTCUTS } from "./extendedShortcuts"

export type EditorHighlightOptions = { offset: number, length: number, lineOffset?: number }
export const Editor = eventDecorator(defineComponent({
    name: "Editor",
    props: {
        content: { type: String, default: "" },
        highlight: { type: Object as PropType<EditorHighlightOptions | null> },
        mode: { type: null },
        config: { type: Object as PropType<EditorConfiguration> },
        useExtendedShortcuts: { type: Boolean, default: true },
    },
    emits: {
        change: (value: string) => true,
    },
    setup(props, ctx) {
        const editorHost = ref<HTMLElement>()
        let editor: Editor_1 | null = null
        let value = props.content

        watch(() => props.content, newValue => {
            if (!editor) return
            if (newValue != editor.getValue()) editor.setValue(newValue)
        })

        watch(() => props.mode, newMode => {
            if (!editor) return
            editor.setOption("mode", newMode)
        })

        function mountEditorHost(host: HTMLElement) {
            host.classList.add("absolute-fill")
            host.style.height = "100%"
            editorHost.value = host
        }

        onMounted(() => {
            editor = CodeMirror(mountEditorHost, {
                value: value,
                lineNumbers: true,
                mode: props.mode ?? "simple",
                lineWrapping: true,
                indentUnit: 4,
                ...props.config,
                extraKeys: {
                    ...(props.useExtendedShortcuts ? EXTENDED_SHORTCUTS : undefined),
                    ...(props.config?.extraKeys as KeyMap | undefined),
                    "Ctrl-S": () => ctx.emit("change", value),
                },
            })

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
                className: "bg-warning-translucent",
            })
        })

        return () => (
            <div>
                <MountNode node={editorHost.value} />
            </div>
        )
    },
}))
