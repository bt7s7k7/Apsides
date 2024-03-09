import { defineComponent } from "vue"
import { ComponentEditor } from "./ComponentEditor"
import { Header } from "./Header"
import snippets from "./formSnippets?snippets"

export const FormPage = (defineComponent({
    name: "FormPage",
    setup(props, ctx) {
        return () => (
            <div class="smart-page">
                <Header />
                <h1>Form Builder</h1>
                <ComponentEditor name="form_intro" code={snippets.intro} />
                <p>
                    The <b>Form Builder</b> packages allows for:
                    <ul>
                        <li>Automatic generation of form layouts</li>
                        <li>Serializing form layouts for network transfer</li>
                        <li>Generating precise mutations on field changes</li>
                    </ul>
                </p>
                <p>
                    The system is split into two packages: <code>formML</code> and <code>formBuilder</code>. The former generates forms or allows for custom
                    construction and the latter actually interfaces with Vue.js to build your forms. All intermediate objects are serializable. They can be
                    sent over a network, so clients do not even have to be aware of the shape of your data.
                </p>
                <p>
                    Constructed form objects generate change events, from which <code>Mutation</code> objects can be constructed.
                </p>
                <ComponentEditor name="form_mutation" code={snippets.mutation} />
                <p>
                    Forms also support sub-objects.
                </p>
                <ComponentEditor name="form_nested" code={snippets.nested} />
                <p>
                    For displaying many objects at once a table can be used.
                </p>
                <ComponentEditor name="form_table" code={snippets.table} />
                <div class="h-500"></div>
            </div>
        )
    }
}))
