import { mdiCircleOutline, mdiCog, mdiDelete, mdiFileOutline, mdiPlus } from "@mdi/js"
import "codemirror/mode/jsx/jsx.js"
import { Ref, computed, defineComponent, h, onMounted, reactive, ref, shallowRef, toRef, watch } from "vue"
import { GenericParser } from "../comTypes/GenericParser"
import { isUpperCase, isWhitespace, isWord, runString, unreachable } from "../comTypes/util"
import { EditorView } from "../editor/EditorView"
import { EditorState } from "../editor/useEditorState"
import * as api from "../index"

const _ENV: any = {
    computed, defineComponent, h, reactive, ref, shallowRef, watch,
    mdiDelete, mdiPlus, mdiCog, mdiFileOutline, mdiCircleOutline,
}
Object.assign<any, any>(_ENV, api)

class _JSXError extends Error { name = "JSXError" }

function _transpileJSX(source: string) {
    const parser = new GenericParser(source)

    function parseExpression(term: string): string {
        let result = ""
        while (!parser.isDone()) {
            const skip = parser.readUntil((v, i) => v[i] == term || v[i] == "<" || v[i] == "{")
            result += skip

            if (parser.isDone()) break
            if (term != "" && parser.consume(term)) break

            if (parser.at(0) == "<") {
                if (isWord(parser.at(1)) || parser.at(1) == ">") {
                    if (!parser.consume("<")) unreachable()
                    result += parseTag()
                } else {
                    result += "<"
                    parser.index++
                }
                continue
            }

            if (parser.at(0) == "{") {
                result += "{"
                parser.index++
                result += parseExpression("}")
                result += "}"
                continue
            }

            unreachable()
        }
        return result
    }

    function parseTag(): string {
        let result = ""

        const properties: { name: string, value: string }[] = []
        const name = parser.readWhile(isWord)
        const isFragment = name == ""
        const isComponent = isUpperCase(name, 0)
        const children: string[] = []

        while (!parser.isDone()) {
            parser.skipWhile(isWhitespace)

            if (parser.matches(">") || parser.matches("/>")) {
                if (!isFragment) {
                    result += `h(`

                    if (isComponent) {
                        result += name
                    } else {
                        result += JSON.stringify(name)
                    }

                    result += ", {"
                    result += properties.map(({ name, value }) => (
                        name == "" ? (
                            `...(${value})`
                        ) : (
                            `${name}: ${value}`
                        )
                    )).join(", ")
                    result += "}"

                    if (parser.consume("/>")) {
                        result += ")"
                        return result
                    }
                } else {
                    result += "["
                }

                if (!parser.consume(">")) unreachable()

                break
            }

            if (isWord(parser.at(0))) {
                const propertyName = parser.readWhile(isWord)

                if (!parser.consume("=")) {
                    properties.push({ name: propertyName, value: "true" })
                    continue
                }

                if (parser.consume("\"")) {
                    const literal = parser.readUntil((v, i) => v[i] == "\"" && v[i - 1] != "\\")
                    properties.push({ name: propertyName, value: `"${literal}"` })
                    if (!parser.consume("\"")) unreachable()
                    continue
                }

                if (parser.consume("{")) {
                    const expr = parseExpression("}")

                    if (propertyName == "vModel") {
                        properties.push({ name: "modelValue", value: expr })
                        properties.push({ name: "\"onUpdate:modelValue\"", value: `v => ${expr} = v` })
                        continue
                    }

                    properties.push({ name: propertyName, value: expr })
                    continue
                }
            }

            throw new _JSXError("Expected property or tag end")
        }

        while (!parser.isDone()) {
            const fragment = parser.readUntil((v, i) => v[i] == "<" || v[i] == "{")
            const fragmentTrimmed = fragment.trim()
            if (fragmentTrimmed.length > 0) {
                children.push(JSON.stringify(fragment))
            }

            if (parser.isDone()) return result

            if (parser.consume("</")) {
                parser.readUntil(">")
                parser.index++

                if (!isFragment) {
                    if (children.length > 0) {
                        if (children.length == 1) {
                            if (isComponent) {
                                result += `, () => (${children[0]})`
                            } else {
                                result += `, ${children[0]}`
                            }
                        } else {
                            if (isComponent) {
                                result += `, () => [${children.join(", ")}]`
                            } else {
                                result += `, [${children.join(", ")}]`
                            }
                        }
                    }

                    result += ")"
                } else {
                    result += children.join(", ")
                    result += "]"
                }
                break
            }

            if (parser.consume("{")) {
                children.push(parseExpression("}"))
                continue
            }

            if (parser.consume("<")) {
                children.push(parseTag())
                continue
            }

            unreachable()
        }

        return result
    }

    return parseExpression(source)
}

class ComponentEditorState extends EditorState {
    protected _component = null as any

    public getOutput(): EditorState.OutputTab[] {
        return [
            {
                name: "output", label: "Output",
                content: () => (
                    this._component && <this._component />
                ),
            },
        ]
    }

    protected _compile(code: string): void {
        this.ready = true
        this._component = null

        const transpiledSource = _transpileJSX(code)

        const result = runString({
            source: transpiledSource, env: _ENV,
            url: "generated:component-editor/" + this._name.value,
        })

        this._component = result
    }

    constructor(
        protected readonly _name: Ref<string>,
    ) { super() }

}

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
