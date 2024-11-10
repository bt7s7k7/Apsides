import { mdiChevronRight } from "@mdi/js"
import { EditorConfiguration } from "codemirror"
import { PropType, defineComponent, ref, shallowRef, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { eventDecorator } from "../eventDecorator"
import { Button } from "../vue3gui/Button"
import { Icon } from "../vue3gui/Icon"
import { Tab, TabbedContainer, Tabs, useTabs } from "../vue3gui/Tabs"
import { useResizeWatcher } from "../vue3gui/util"
import { Editor, EditorHighlightOptions } from "./Editor"
import { EditorState } from "./useEditorState"

export const EditorView = eventDecorator(defineComponent({
    name: "EditorView",
    props: {
        code: { type: String },
        root: { type: Boolean },
        tab: { type: String },
        mode: { type: null },
        localStorageId: { type: String },
        config: { type: Object as PropType<EditorConfiguration> },
        codeRatio: { type: Number },
        state: { type: EditorState as PropType<EditorState>, required: true },
        toolbarClass: { type: null }
    },
    emits: {
        compile: (state: EditorState, code: string) => true
    },
    setup(props, ctx) {
        const route = useRoute()
        const router = useRouter()

        if (props.localStorageId && !props.root) {
            // eslint-disable-next-line no-console
            console.warn("EditorView has localStorageId but it is not root, so no state will be saved")
        }

        watch(() => props.code, () => {
            if (props.code != null) {
                props.state.code.value = props.code
            }
        }, { immediate: true })

        const outputView = useTabs()
        if (props.tab != null) {
            outputView.selected = props.tab
        }
        watch(() => props.tab, () => {
            if (props.tab != null) {
                outputView.selected = props.tab
            }
        })

        if (props.root) {
            if (route.query.code) {
                const queryCode = route.query.code as string
                props.state.code.value = queryCode

                router.replace({ query: { code: undefined } })
            } else if (props.localStorageId != null) {
                const savedCode = localStorage.getItem(props.localStorageId + ":editor-code")
                if (savedCode != null) {
                    props.state.code.value = savedCode
                }
            }

            if (props.localStorageId) {
                const savedTab = localStorage.getItem(props.localStorageId + ":editor-tab")
                if (savedTab != null) outputView.selected = savedTab as any

                watch(props.state.code, code => localStorage.setItem(props.localStorageId + ":editor-code", code))
                watch(() => outputView.selected, tab => localStorage.setItem(props.localStorageId + ":editor-tab", tab!))
            }
        }

        function runCode() {
            props.state.compile(props.state.code.value)
        }
        watch(props.state.code, runCode, { immediate: true })

        const outputPanel = ref<HTMLDivElement>()
        const isSmallMode = ref(false)
        useResizeWatcher(() => {
            const height = outputPanel.value!.clientHeight
            const smallMode = height < 500
            if (isSmallMode.value == smallMode) return
            isSmallMode.value = smallMode
        }, { immediate: true })

        function errorPanel() {
            return (
                <div class="absolute-fill flex column gap-2 scroll p-2">
                    {props.state.errors.map(err => (
                        <div class="border border-danger rounded pre-wrap monospace px-2" innerHTML={err} />
                    ))}
                </div>
            )
        }

        let highlightElement: HTMLElement | null = null
        const highlighting = shallowRef<EditorHighlightOptions | null>(null)
        function handlePositionHighlight(event: MouseEvent) {
            if (highlightElement) {
                highlightElement.classList.remove("bg-warning-translucent")
                highlightElement = null
            }

            highlighting.value = null
            if (event.target instanceof HTMLElement) {
                const highlightSource = event.target.closest("[data-offset][data-length]") as HTMLElement
                if (highlightSource) {
                    const offset = +highlightSource.dataset["offset"]!
                    const length = +highlightSource.dataset["length"]!
                    let lineOffset = highlightSource.dataset["lineOffset"] as any
                    if (lineOffset != undefined) lineOffset = +lineOffset
                    highlightElement = highlightSource
                    highlightElement.classList.add("bg-warning-translucent")
                    highlighting.value = { offset, length, lineOffset }
                }
            }
        }

        return () => (
            <div class="flex column flex-fill">
                <div class="flex row border-bottom">
                    <div class={["border-right p-1 px-2 flex-fill flex row", props.toolbarClass]} style={{ flexGrow: props.codeRatio }}>
                        {ctx.slots.default?.()}
                        <div class="flex-fill"></div>
                        <Button onClick={runCode} variant="success">Run <Icon icon={mdiChevronRight} /> </Button>
                    </div>
                    <div class="p-1 px-2 flex-fill">
                        <Tabs border class="absolute left-0 bottom-0 ml-1" tabs={outputView} />
                    </div>
                </div>
                <div class="flex row flex-fill">
                    <div class="flex-fill border-right" style={{ flexGrow: props.codeRatio }}>
                        <Editor
                            content={props.state.code.value}
                            onChange={v => props.state.code.value = v}
                            class="absolute-fill"
                            highlight={highlighting.value}
                            mode={props.mode}
                            config={props.config}
                        />
                    </div>
                    <div class="flex-fill flex column" ref={outputPanel}>
                        <TabbedContainer class="flex-fill" externalTabs={outputView} onMousemove={handlePositionHighlight} onMouseleave={handlePositionHighlight}>
                            {props.state.getOutput().map(tab => (
                                <Tab name={tab.name} key={tab.name} label={tab.label}>
                                    <div class="absolute-fill overflow-auto p-2">
                                        {props.state.ready ? (
                                            typeof tab.content == "string" ? (
                                                <div class="monospace pre-wrap" innerHTML={tab.content} />
                                            ) : (
                                                tab.content()
                                            )
                                        ) : (
                                            <div class="muted p-2">Waiting for compilation...</div>
                                        )}
                                    </div>
                                </Tab>
                            ))}

                            {isSmallMode.value && <Tab name="errors" label="Errors">
                                {errorPanel()}
                            </Tab>}
                        </TabbedContainer>
                        {isSmallMode.value == false && props.state.errors.length > 0 && (
                            <div class="flex-basis-300 border-top" onMousemove={handlePositionHighlight} onMouseleave={handlePositionHighlight}>
                                {errorPanel()}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }
}))
