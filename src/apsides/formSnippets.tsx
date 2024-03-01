import { defineComponent, ref } from "vue"
import { FormView } from "../formBuilder/FormView"
import { useForm } from "../formBuilder/useForm"
import { CustomFieldAttribute, NumberField } from "../formML/Form"
import { Struct } from "../struct/Struct"
import { Type } from "../struct/Type"

function intro() {
    class Person extends Struct.define("Person", {
        name: Type.string,
        surname: Type.string,
        age: Type.number.as(Type.annotate,
            new CustomFieldAttribute(
                new NumberField({ integer: true })
            )
        ),
        verified: Type.boolean,
        group: Type.enum("primary", "secondary", "aux")
    }) { }

    return defineComponent({
        name: "Intro",
        setup(props, ctx) {
            const person = ref(new Person({
                ...Person.default(),
                name: "John",
                surname: "Smith",
                age: 25
            }))

            const form = useForm({
                value: person
            })

            return () => (
                <div>
                    <FormView form={form} />
                    <pre>
                        {JSON.stringify(person.value, null, 4)}
                    </pre>
                </div>
            )
        },
    })
}
