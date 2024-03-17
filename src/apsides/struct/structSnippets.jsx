import { defineComponent, ref, shallowRef } from "vue"
import { Optional } from "../../comTypes/Optional"
import { asError, cloneWithout } from "../../comTypes/util"
import { Struct } from "../../struct/Struct"
import { Type } from "../../struct/Type"

function example() {
    class Person extends Struct.define("Person", {
        name: Type.string,
        surname: Type.string,
        age: Type.number,
        verified: Type.boolean,
        group: Type.enum("primary", "secondary", "aux")
    }) { }

    return defineComponent({
        setup(props, ctx) {
            const person = shallowRef(null)
            const input = ref(JSON.stringify(cloneWithout(Person.default(), "name").serialize(), null, 4))
            const error = ref("")

            function update(event) {
                if (event) input.value = event.target.value
                person.value = null
                error.value = ""
                person.value = Optional.pcall(
                    () => Person.deserialize(JSON.parse(input.value))
                ).else(
                    err => (error.value = asError(err).message, null)
                ).unwrap()
            }

            update()

            return () => <div>
                <textarea onInput={update} class="no-resize noresize w-fill h-100" value={input.value} />
                {error.value ? (
                    <div class="monospace text-danger pre-wrap">{error.value}</div>
                ) : (
                    <div class="monospace pre-wrap">{JSON.stringify(person.value)}</div>
                )}
            </div>
        }
    })
}
