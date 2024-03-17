import { mdiDelete, mdiPlus } from "@mdi/js"
import { defineComponent, reactive, ref } from "vue"
import { FormView } from "../../formBuilder/FormView"
import { useForm } from "../../formBuilder/useForm"
import { CustomFieldAttribute, NumberField, StringField, TableAttribute } from "../../formML/Form"
import { Mutation } from "../../struct/Mutation"
import { Struct } from "../../struct/Struct"
import { Type } from "../../struct/Type"
import { Button } from "../../vue3gui/Button"
import { useDynamicsEmitter } from "../../vue3gui/DynamicsEmitter"

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
        name: "Mutation",
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
        name: "Nested",
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

function table() {
    class Item extends Struct.define("Item", {
        name: Type.string,
        cost: Type.number
    }) { }

    const Items_t = Item.ref().as(Type.array).as(Type.annotate,
        new TableAttribute({ showIndex: true })
    )

    return defineComponent({
        name: "Table",
        setup(props, ctx) {
            const changes = ref([])
            const emitter = useDynamicsEmitter()

            const items = reactive(Items_t.default())
            items.push(new Item({ name: "Wood", cost: 5 }))
            items.push(new Item({ name: "Iron", cost: 20 }))
            items.push(new Item({ name: "Ash", cost: 8 }))

            function deleteElement(/** @type {string[]} */ path) {
                const index = +path[path.length - 1]

                return () => {
                    const [mutation] = Mutation.create(form, null, v => v.value.splice(index, 1))
                    changes.value.push(mutation.serialize())
                }
            }

            const form = useForm({
                value: items,
                type: Items_t,
                fieldOptions: {
                    onChange(event) {
                        changes.value.unshift(
                            event.getMutation().serialize()
                        )
                    },
                    suffix(props) {
                        const path = props.path.toArray()

                        if (path[0] == "value" && path.length == 2) {
                            return <td class="w-0">
                                <Button icon={mdiDelete} onClick={deleteElement(path)} clear />
                            </td>
                        }
                    }
                }
            })

            function addItem(event) {
                const createForm = useForm({
                    value: Item.default(),
                    fieldOptions: { labelWidth: 50 }
                })

                emitter.menu(event.target, FormView, {
                    contentProps: { form: createForm },
                    props: {
                        okButton: true, cancelButton: true,
                        class: "border w-200"
                    }
                }).then(confirm => {
                    if (!confirm) return
                    const [mutation] = Mutation.create(form, null, v => v.value.push(createForm.value))
                    changes.value.push(mutation.serialize())
                })
            }

            return () => (
                <div>
                    <FormView form={form} />
                    <Button
                        class="mt-1" variant="success"
                        label="Add Item" icon={mdiPlus}
                        onClick={addItem}
                    />
                    <pre class="pre-wrap">
                        {JSON.stringify(items)}
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
        }
    })
}

function reference() {
    const Sample_t = Type.object({
        string: Type.string,
        // Using an explicit field, all changes are atomic and cancellable
        explicit: Type.string.as(Type.annotate,
            new CustomFieldAttribute(
                new StringField({ explicit: true })
            )
        ),
        number: Type.number,
        integer: Type.number.as(Type.annotate,
            new CustomFieldAttribute(
                NumberField.INTEGER
            )
        ),
        minMax: Type.number.as(Type.annotate,
            new CustomFieldAttribute(
                new NumberField({ min: 1, max: 2 })
            )
        ),
        boolean: Type.boolean,
        nullable: Type.string.as(Type.nullable)
    })

    return defineComponent({
        name: "Intro",
        setup(props, ctx) {
            const person = ref(Sample_t.default())

            const form = useForm({
                value: person,
                type: Sample_t
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
