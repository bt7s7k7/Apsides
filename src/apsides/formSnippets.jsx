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

function mutation() {
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
            const changes = ref([])

            const person = ref(new Person({
                ...Person.default(),
                name: "John",
                surname: "Smith",
                age: 25
            }))

            const form = useForm({
                value: person,
                fieldOptions: {
                    onChange(event) {
                        changes.value.unshift(
                            event.getMutation().serialize()
                        )
                    },
                }
            })

            return () => (
                <div>
                    <FormView form={form} />
                    <div>
                        {changes.value.map((v, i) => (
                            <pre key={i}>
                                {JSON.stringify(v)}
                            </pre>
                        ))}
                    </div>
                </div>
            )
        },
    })
}

function nested() {
    class Point extends Struct.define("Point", {
        x: Type.number,
        y: Type.number
    }) { }

    class LineSegment extends Struct.define("LineSegment", {
        start: Point.ref(),
        end: Point.ref()
    }) { }

    return defineComponent({
        name: "Intro",
        setup(props, ctx) {
            const changes = ref([])

            const value = ref(new LineSegment({
                start: new Point({ x: 5, y: 10 }),
                end: new Point({ x: 7, y: 15 }),
            }))

            const form = useForm({
                value,
                fieldOptions: {
                    onChange(event) {
                        changes.value.unshift(
                            event.getMutation().serialize()
                        )
                    },
                }
            })

            return () => (
                <div>
                    <FormView form={form} />
                    <pre>
                        {JSON.stringify(value.value)}
                    </pre>
                    <div>
                        {changes.value.map((v, i) => (
                            <pre key={i}>
                                {JSON.stringify(v)}
                            </pre>
                        ))}
                    </div>
                </div>
            )
        },
    })
}
