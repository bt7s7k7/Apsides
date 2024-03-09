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
import { EditorState, useEditorState } from "./useEditorState"

export const EditorView = eventDecorator(defineComponent({
    name: "EditorView",
    props: {
        code: { type: String },
        root: { type: Boolean },
        tab: { type: String },
        mode: { type: String },
        localStorageId: { type: String },
        noLoad: { type: Boolean },
        noAST: { type: Boolean },
        customOutput: { type: null as unknown as PropType<() => any> },
        config: { type: Object as PropType<EditorConfiguration> },
        codeRatio: { type: Number }
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

        const code = ref("")
        watch(() => props.code, () => {
            if (props.code != null) {
                code.value = props.code
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
                code.value = queryCode

                router.replace({ query: { code: undefined } })
            } else if (props.localStorageId != null) {
                const savedCode = localStorage.getItem(props.localStorageId + ":editor-code")
                if (savedCode != null) {
                    code.value = savedCode
                }
            }

            if (props.localStorageId) {
                const savedTab = localStorage.getItem(props.localStorageId + ":editor-tab")
                if (savedTab != null) outputView.selected = savedTab as any

                watch(code, code => localStorage.setItem(props.localStorageId + ":editor-code", code))
                watch(() => outputView.selected, tab => localStorage.setItem(props.localStorageId + ":editor-tab", tab!))
            }
        }

        const state = useEditorState((code) => ctx.emit("compile", state, code))
        function runCode() {
            state.compile(code.value)
        }
        watch(code, runCode, { immediate: true })

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
                    {state.errors.map(err => (
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
                    <div class="border-right p-1 px-2 flex-fill flex row" style={{ flexGrow: props.codeRatio }}>
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
                            content={code.value}
                            onChange={v => code.value = v}
                            class="absolute-fill"
                            highlight={highlighting.value}
                            mode={props.mode}
                            config={props.config}
                        />
                    </div>
                    <div class="flex-fill flex column" ref={outputPanel}>
                        <TabbedContainer class="flex-fill" externalTabs={outputView} onMousemove={handlePositionHighlight} onMouseleave={handlePositionHighlight}>
                            <Tab name="output" label="Output">
                                <div class="absolute-fill scroll p-2">
                                    {props.customOutput ? (
                                        props.customOutput()
                                    ) : state.ready ? (
                                        state.result.map(v => <div class="monospace pre-wrap" innerHTML={v} />)
                                    ) : (
                                        <div class="muted p-2">Waiting for compilation...</div>
                                    )}
                                </div>
                            </Tab>

                            {!props.noAST && <Tab name="ast" label="AST">
                                <div class="absolute-fill scroll p-2">
                                    {state.ast ? (
                                        <div class="monospace pre-wrap" innerHTML={state.ast} />
                                    ) : (
                                        <div class="muted p-2">Waiting for compilation...</div>
                                    )}
                                </div>
                            </Tab>}

                            {!props.noLoad && <Tab name="load" label="Load">
                                <div class="absolute-fill scroll p-2">
                                    {state.loaded ? (
                                        <div class="monospace pre-wrap" innerHTML={state.loaded} />
                                    ) : (
                                        <div class="muted p-2">Waiting for compilation...</div>
                                    )}
                                </div>
                            </Tab>}

                            {isSmallMode.value && <Tab name="errors" label="Errors">
                                {errorPanel()}
                            </Tab>}
                        </TabbedContainer>
                        {isSmallMode.value == false && state.errors.length > 0 && (
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
