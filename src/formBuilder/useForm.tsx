import { Ref, isRef, reactive, ref } from "vue"
import { ImmutableList } from "../comTypes/ImmutableList"
import { Binding, DeepObjectPropertyBinding, ObjectPropertyBinding, RootBinding } from "../formML/Binding"
import { Form, ObjectField, PropertyInfo, TableField } from "../formML/Form"
import { Struct } from "../struct/Struct"
import { Type } from "../struct/Type"
import { FieldDrawer, FieldGroup, FieldOptions } from "./FieldDrawer"
import { FormDefinition } from "./FormView"

export interface ValueFormOptions<T> {
    /** Value to be edited in the form, if it is not an object, see `valueLabel` */
    value: Ref<T> | T
    /** Type of the value for generating a form. Ignored if `form` property specified. If not specified it will be derived using `Struct.getType` */
    type?: Type<T>
    /** Form to display, if not specified, it will be generated from the type */
    form?: Form
    /** Options passed to `FieldGroup` */
    fieldOptions?: Partial<FieldOptions>
    /**
     * When the type of your value is not an object a wrapper will be generate, this is the label for your value in the wrapper object
     * @default "Value"
     * */
    valueLabel?: string
    /** Binding to use with the value, if not specified it will be the value itself */
    path?: string[]
}

export interface ValueForm<T> extends FormDefinition {
    value: T
}

export function useForm<T>(options: ValueFormOptions<T>) {
    const value = isRef(options.value) ? options.value : ref(options.value)
    let form = options.form ?? Form.getForm(options.type ?? Struct.getType(value.value as any))
    let binding: Binding = options.path == null ? new ObjectPropertyBinding({ property: "value" }) : new DeepObjectPropertyBinding({ path: ["value", ...options.path] })
    let path = ImmutableList.empty<string>()
    if (options.path != null) {
        path = ImmutableList.from(options.path).concat(path)
    }

    if (options.valueLabel != null || !(form.root instanceof ObjectField || form.root instanceof TableField)) {
        const oldRoot = form.root
        const oldBinding = binding

        form = new Form({
            root: new ObjectField({
                properties: [
                    new PropertyInfo({ bind: oldBinding, field: oldRoot, label: options.valueLabel ?? "Value" })
                ]
            })
        })

        binding = new RootBinding()
    }

    const fieldOptions = options.fieldOptions ?? {}

    const formDef = reactive({
        value: value,
        render() {
            return (
                <div>
                    <FieldGroup options={fieldOptions}>
                        <FieldDrawer field={form.root} binding={binding} base={value} label="" path={path} />
                    </FieldGroup>
                </div>
            )
        },
    })

    return formDef as ValueForm<T>
}
