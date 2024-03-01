import { defineComponent } from "vue"
import { ComponentEditor } from "./ComponentEditor"
import { Header } from "./Header"
import snippets from "./formSnippets?snippets"

export const FormPage = (defineComponent({
    name: "FormPage",
    setup(props, ctx) {
        return () => (
            <div class="as-page">
                <Header />
                <h1>Form Builder</h1>
                <ComponentEditor name="form/intro" code={snippets.intro} />
            </div>
        )
    }
}))
