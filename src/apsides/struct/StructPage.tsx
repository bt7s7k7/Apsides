import { defineComponent } from "vue"
import { useDynamicsEmitter } from "../../vue3gui/DynamicsEmitter"
import { ComponentEditor } from "../ComponentEditor"
import { Header } from "../Header"
import snippets from "./structSnippets?snippets"

export const StructPage = (defineComponent({
    name: "StructPage",
    setup(props, ctx) {
        const emitter = useDynamicsEmitter()

        return () => (
            <div class="smart-page">
                <Header />
                <h1>Struct</h1>
                <p>
                    The <b>Struct</b> package provides functions to define runtime type information. The package supports classes, plain objects, arrays, sets,
                    enum unions and much more. These runtime types can then be used for (de)serialization, deep cloning and type introspection.
                </p>
                <h1>Example</h1>
                <ComponentEditor name="struct_example" code={snippets.example} />
            </div>
        )
    }
}))
