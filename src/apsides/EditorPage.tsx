import { defineComponent, ref } from "vue"
import { EditorView } from "../editor/EditorView"
import { ComponentEditorState } from "./ComponentEditorState"

const defaultCode = `return defineComponent({
    name: "Component",
    setup(props, ctx) {
        return () => (
            <div>Hello World</div>
        )
    }
})
`

export const EditorPage = (defineComponent({
    name: "EditorPage",
    setup(props, ctx) {
        const state = new ComponentEditorState(ref("main-editor"))

        return () => (
            <EditorView
                class={"flex-fill"}
                code={defaultCode} mode="jsx"
                config={{ lineWrapping: false }}
                codeRatio={1.25}
                state={state}
            />
        )
    },
}))
