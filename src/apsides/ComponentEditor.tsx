import "codemirror/mode/jsx/jsx.js"
import { defineComponent, onMounted, ref, shallowRef, toRef } from "vue"
import { EditorView } from "../editor/EditorView"
import { ComponentEditorState } from "./ComponentEditorState"

export const ComponentEditor = (defineComponent({
    name: "ComponentEditor",
    props: {
        name: { type: String, required: true },
        code: { type: String },
        large: { type: Boolean },
    },
    setup(props, ctx) {
        const component = shallowRef<any | null>(null)
        const mount = ref(false)
        const placeholder = ref<HTMLElement>()
        let observer: IntersectionObserver | null = null

        onMounted(() => {
            observer = new IntersectionObserver(([entry]) => {
                if (!entry.isIntersecting) return
                observer!.disconnect()
                observer = null
                window.requestIdleCallback(() => {
                    mount.value = true
                })
            })
            observer.observe(placeholder.value!)
        })

        const state = new ComponentEditorState(toRef(props, "name"))

        return () => <>
            {mount.value ? (
                <EditorView
                    class={["-insert border rounded overflow-hidden", props.large ? "h-500" : "h-300"]}
                    code={props.code} mode="jsx"
                    config={{ lineWrapping: false }}
                    codeRatio={1.25}
                    state={state}
                />
            ) : (
                <div class={["-insert border rounded", props.large ? "h-500" : "h-300"]} ref={placeholder}></div>
            )}
        </>
    },
}))
