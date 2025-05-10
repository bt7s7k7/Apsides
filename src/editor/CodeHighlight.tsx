import CodeMirror from "codemirror"
import "codemirror/addon/runmode/runmode.js"
import { defineComponent } from "vue"
import { MountNode } from "../vue3gui/MountNode"

export const CodeHighlight = defineComponent({
    name: "CodeHighlight",
    props: {
        content: { type: String, required: true },
        mode: { type: String, required: true },
    },
    setup(props, ctx) {
        const host = document.createElement("code")
        CodeMirror.runMode(props.content, props.mode, host)

        return () => (
            <pre class="cm-s-default">
                <MountNode node={host} />
            </pre>
        )
    },
})
