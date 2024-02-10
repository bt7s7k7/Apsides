import { InjectionKey, PropType, Ref, computed, defineComponent, h, inject, markRaw, provide, reactive, ref } from "vue"
import { ImmutableList } from "../comTypes/ImmutableList"
import { unreachable } from "../comTypes/util"
import { Binding } from "../formML/Binding"
import { CheckField, Form, FormField, NumberField, ObjectField, SelectField, TextField as TextField_1 } from "../formML/Form"
import { Mutation } from "../struct/Mutation"
import { Struct } from "../struct/Struct"
import { ButtonGroup } from "../vue3gui/Button"
import { Icon } from "../vue3gui/Icon"
import { MenuItem } from "../vue3gui/MenuItem"
import { TextField } from "../vue3gui/TextField"
import { grid } from "../vue3gui/grid"
import { numberModel } from "../vue3gui/util"

type _Path = ImmutableList<string>
type _FieldProps<T> = { field: T, base: any, binding: Binding, label: string, path: _Path }
type _FieldDrawer<T> = { new(...args: any): { $props: _FieldProps<T> }, noFieldDecoration?: boolean }
const _FIELD_DRAWERS = new Map<new (...args: any[]) => FormField, _FieldDrawer<FormField>>


markRaw(Binding.prototype)
markRaw(Form.prototype)
markRaw(FormField.prototype)

export function registerFieldDrawer<T extends new (...args: any[]) => FormField>(field: T, drawer: _FieldDrawer<InstanceType<T>>) {
    _FIELD_DRAWERS.set(field, drawer)
}

export function getFieldDrawerProps<T>(type: abstract new (...args: any[]) => T) {
    return {
        field: { type: Object as PropType<T>, required: true },
        binding: { type: Object as PropType<Binding>, required: true },
        base: { type: null, required: true },
        label: { type: String, required: true },
        path: { type: Object as PropType<_Path>, required: true }
    } as const
}

export class FieldChangeEvent {
    protected _cachedPathArray: string[] | null = null

    public getPath() {
        if (this._cachedPathArray == null) {
            this._cachedPathArray = this._path.toArray()
            if (this._basePath) {
                for (let i = 0; i < this._basePath.length; i++) {
                    if (this._basePath[i] == this._cachedPathArray[0]) {
                        this._cachedPathArray.shift()
                    } else {
                        throw new Error(`Form base path is invalid, ${JSON.stringify(this._basePath)} to ${JSON.stringify(this._path.toArray())}`)
                    }
                }
            }
        }
        return this._cachedPathArray as readonly string[]
    }

    public getMutation() {
        const path = this.getPath().slice(0, -1)
        const key = this.getPath().at(-1) ?? unreachable()
        return new Mutation.AssignMutation({ type: "mut_assign", key, path, value: this.value }).setLocal()
    }

    public isPath(test: Mutation.TypedPath) {
        const otherPath = Mutation.getPath(test)
        const currPath = this.getPath()

        if (otherPath.length != currPath.length) return false
        for (let i = 0; i < currPath.length; i++) {
            if (currPath[i] != otherPath[i]) return false
        }

        return true
    }

    constructor(
        protected readonly _path: _Path,
        protected readonly _basePath: string[] | null | undefined,
        public readonly value: any
    ) { }
}

export function useFieldDrawerValue<T = any>(props: Omit<_FieldProps<FormField>, "field">) {
    const value = computed({
        get: () => props.binding.getValue(props.base) as T,
        set: (value: T) => props.binding.setValue(props.base, value)
    })

    const options = useFieldOptions()
    function changed() {
        if (options.onChange) options.onChange(new FieldChangeEvent(props.path, options.basePath, value.value))
    }

    return reactive({ value, changed })
}

export interface FieldOptions {
    prefix?: (props: _FieldProps<FormField>) => any
    suffix?: (props: _FieldProps<FormField>) => any
    disable?: (props: _FieldProps<FormField>) => boolean
    replace?: (props: _FieldProps<FormField>) => any
    onChange?: (event: FieldChangeEvent) => void
    basePath?: string[]
    labelWidth: number | "auto"
}
const _FIELD_OPTIONS_KEY = Symbol.for("apsides.fieldOptions") as InjectionKey<FieldOptions>

export function useFieldOptions() {
    return inject(_FIELD_OPTIONS_KEY)!
}

export const FieldGroup = defineComponent({
    name: "FieldGroup",
    props: {
        merge: { type: Boolean },
        options: { type: Object as PropType<Partial<FieldOptions>>, required: true }
    },
    setup(props, ctx) {
        const options = props.merge ? { ...inject(_FIELD_OPTIONS_KEY), ...props.options } : props.options
        options.labelWidth ??= 100
        provide(_FIELD_OPTIONS_KEY, options as FieldOptions)

        return () => ctx.slots.default?.()
    },
})

export const FieldDrawer = (defineComponent({
    name: "FieldDrawer",
    props: {
        ...getFieldDrawerProps(FormField)
    },
    setup(props, ctx) {
        const field = _FIELD_DRAWERS.get(props.field.constructor as any)
        const path = props.path.add(props.binding.getKey())
        const key = path.join(".")
        const options = useFieldOptions()

        if (field == null) {
            return () => (
                <div class="monospace text-danger" style={grid().colspan(2).$}>No drawer registered for "{Struct.getBaseType(props.field).name}"</div>
            )
        } else {
            const base = () => {
                let result = h(field, props)
                if (options.replace) {
                    const replace = options.replace(props)
                    if (replace != null) result = replace
                }

                if (options.disable) {
                    result = <ButtonGroup disabled={options.disable(props)}>{result}</ButtonGroup>
                }

                return result
            }

            if (field.noFieldDecoration) {
                return base
            }

            return () => <>
                <div data-field-label={key} key={"label:" + key} class="flex row">{options.prefix?.(props)}{props.label}</div>
                <div data-field={key} key={"field:" + key} class="flex row">{base()}{options.prefix?.(props)}</div>
            </>
        }
    }
}))

export const TextFieldDrawer = defineComponent({
    name: "TextFieldDrawer",
    props: {
        ...getFieldDrawerProps(TextField_1)
    },
    setup(props, ctx) {
        const value = useFieldDrawerValue(props)

        return () => (
            <TextField class="flex-fill border rounded" vModel={value.value} onChange={value.changed} clear />
        )
    },
})
registerFieldDrawer(TextField_1, TextFieldDrawer)

export const NumberFieldDrawer = defineComponent({
    name: "NumberFieldDrawer",
    props: {
        ...getFieldDrawerProps(NumberField)
    },
    setup(props, ctx) {
        const field = props.field

        let value: { value: any }
        let numberValue: Ref<string>
        let changed: () => void
        const error = ref("")

        if (field.min == null && field.max == null) {
            const fieldValue = useFieldDrawerValue(props)
            value = fieldValue
            changed = fieldValue.changed
            numberValue = numberModel(value, { integer: !!field.integer })
        } else {
            const fieldValue = useFieldDrawerValue(props)
            value = fieldValue

            const validator = (newValue: number) => {
                if (field.min != null && newValue < field.min) {
                    return "Value too small"
                }

                if (field.max != null && newValue < field.max) {
                    return "Value too large"
                }

                return null
            }

            changed = () => {
                if (validator(value.value) == null) {
                    fieldValue.changed()
                }
            }

            const watchedValue = computed({
                get() {
                    return value.value
                },
                set(newValue) {
                    value.value = newValue
                    error.value = validator(newValue) || ""
                }
            })

            numberValue = numberModel(watchedValue, { integer: !!field.integer })
        }

        return () => (
            <TextField error={error.value} type={field.integer ? "number" : undefined} class="flex-fill border rounded" vModel={numberValue.value} onChange={changed} clear />
        )
    },
})
registerFieldDrawer(NumberField, NumberFieldDrawer)

export const CheckFieldDrawer = defineComponent({
    name: "CheckFieldDrawer",
    props: {
        ...getFieldDrawerProps(CheckField)
    },
    setup(props, ctx) {
        const value = useFieldDrawerValue(props)

        function change(event: Event) {
            value.value = (event.target as HTMLInputElement).checked
            value.changed()
        }

        return () => (
            <input type="checkbox" checked={value.value} onChange={change} />
        )
    }
})
registerFieldDrawer(CheckField, CheckFieldDrawer)

export const SelectFieldDrawer = defineComponent({
    name: "SelectFieldDrawer",
    props: {
        ...getFieldDrawerProps(SelectField)
    },
    setup(props, ctx) {
        const value = useFieldDrawerValue(props)

        return () => (
            <MenuItem
                forceWidth defaultAction clear
                class="border rounded flex-fill"
            >
                <div class="flex-fill">{value.value}</div>
                <Icon icon="M12,18.17L8.83,15L7.42,16.41L12,21L16.59,16.41L15.17,15M12,5.83L15.17,9L16.58,7.59L12,3L7.41,7.59L8.83,9L12,5.83Z" />
                {props.field.options.map(option => (
                    <MenuItem label={option} key={option} onClick={() => { value.value = option; value.changed() }} />
                ))}
            </MenuItem>
        )
    }
})
registerFieldDrawer(SelectField, SelectFieldDrawer)

export const ObjectFieldDrawer = defineComponent({
    name: "ObjectFieldDrawer",
    props: {
        ...getFieldDrawerProps(ObjectField)
    },
    noFieldDecoration: true,
    setup(props, ctx) {
        const value = computed({
            get: () => props.binding.getValue(props.base),
            set: (value) => props.binding.setValue(props.base, value)
        })

        const path = props.path.add(props.binding.getKey())
        const key = path.join(".")
        const options = useFieldOptions()

        return () => <>
            {props.label != "" && <>
                <div data-field-label={key} class="flex row" key={"label0:" + key} style={grid().colspan(2).$}>{options.prefix?.(props)}{props.label}</div>
            </>}
            <div data-field={key} class={["gap-1", props.label.length > 0 && "pl-2"]} key={"field1:" + key} style={grid().columns(options.labelWidth == "auto" ? "auto" : options.labelWidth + "px", "1fr").colspan(2).$}>
                {props.field.properties.map(property => {
                    const { field, bind, label } = property
                    const fieldPath = props.path.add(bind.getKey())
                    const fieldKey = fieldPath.join(".")

                    return (
                        <FieldDrawer field={field} base={value.value} binding={bind} label={label} path={fieldPath} key={fieldKey} />
                    )
                })}
            </div>
        </>
    }
})
registerFieldDrawer(ObjectField, ObjectFieldDrawer)
