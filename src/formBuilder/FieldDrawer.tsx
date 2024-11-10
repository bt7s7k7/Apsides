import { mdiAlert, mdiInformationBox } from "@mdi/js"
import { InjectionKey, PropType, computed, defineComponent, h, inject, markRaw, nextTick, provide, reactive, ref, watch } from "vue"
import { ImmutableList } from "../comTypes/ImmutableList"
import { Optional } from "../comTypes/Optional"
import { range, toString, unreachable } from "../comTypes/util"
import { Binding } from "../formML/Binding"
import { CheckField, Form, FormField, InfoField, NullableField, NumberField, ObjectField, ReadonlyField, SelectField, StringField, TableField } from "../formML/Form"
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
type _FieldDrawer<T> =
    | { new(...args: any): { $props: _FieldProps<T> }, noFieldDecoration?: boolean, fullLine?: boolean }
    | FieldDrawerDecorator<T>
const _FIELD_DRAWERS = new Map<new (...args: any[]) => FormField, _FieldDrawer<FormField>>

export class FieldDrawerDecorator<T> {
    constructor(
        public readonly name: string,
        public readonly setup: (props: _FieldProps<T>) => FieldDrawerDecorator.Result,
    ) { }
}

export namespace FieldDrawerDecorator {
    export interface Result {
        field?: FormField | null
        placeholder?: (() => any) | null
        prefix?: (() => any) | null
    }
}


markRaw(Binding.prototype)
markRaw(Form.prototype)
markRaw(FormField.prototype)

export function registerFieldDrawer<T extends new (...args: any[]) => FormField>(field: T, drawer: _FieldDrawer<InstanceType<T>>) {
    _FIELD_DRAWERS.set(field, drawer as _FieldDrawer<FormField>)
}

export function getFieldDrawerProps<T>(type: abstract new (...args: any[]) => T) {
    return {
        field: { type: Object as PropType<T>, required: true },
        binding: { type: Object as PropType<Binding>, required: true },
        base: { type: null, required: true },
        label: { type: String, required: true },
        path: { type: Object as PropType<_Path>, required: true },
    } as const
}

export abstract class FieldEvent {
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

    public isPath(testPath: string[]) {
        const currPath = this.getPath()

        if (testPath.length != currPath.length) return false
        for (let i = 0; i < currPath.length; i++) {
            if (currPath[i] != testPath[i]) return false
        }

        return true
    }

    constructor(
        protected readonly _path: _Path,
        protected readonly _basePath: string[] | null | undefined,
    ) { }
}

export class FieldChangeEvent extends FieldEvent {
    public getMutation() {
        const path = this.getPath().slice(0, -1)
        const key = this.getPath().at(-1) ?? unreachable()
        return new Mutation.AssignMutation({ key, path, value: this.value })
    }

    constructor(
        path: _Path, basePath: string[] | null | undefined,
        public readonly value: any,
    ) { super(path, basePath) }
}

export class FieldInstantiationEvent extends FieldEvent {
    constructor(
        path: _Path, basePath: string[] | null | undefined,
        public readonly type: string,
    ) { super(path, basePath) }
}

export function useFieldDrawerValue<T = any>(props: Omit<_FieldProps<FormField>, "field">, valueFilter?: (value: T) => T) {
    const value = computed({
        get: () => props.binding.getValue(props.base) as T,
        set: (value: T) => {
            if (valueFilter) value = valueFilter(value)
            props.binding.setValue(props.base, value)
        },
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
    instantiate?: (event: FieldInstantiationEvent) => any
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
        options: { type: Object as PropType<Partial<FieldOptions>>, required: true },
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
        ...getFieldDrawerProps(FormField),
        prefix: { type: Function as PropType<() => any> },
        fieldOnly: { type: Boolean },
    },
    setup(props, ctx) {
        const field = _FIELD_DRAWERS.get(props.field.constructor as any)
        const path = props.path
        const key = path.join(".")
        const options = useFieldOptions()

        const drawError = (error: string) => <div class="monospace text-danger" style={grid().colspan(2).$}>{error}</div>
        const drawLabel = (prefix?: () => any) => <div data-field-label={key} key={"label:" + key} class="flex row">{options.prefix?.(props)}{props.prefix?.()}{prefix?.()}{props.label}</div>

        if (field == null) {
            return () => (
                drawError(`No drawer registered for "${Struct.getBaseType(props.field).name}"`)
            )
        }

        if (field instanceof FieldDrawerDecorator) {
            const fieldProps = { field: props.field, binding: props.binding, base: props.base, label: props.label, path: props.path }
            const result = field.setup(fieldProps)

            return () => (
                result.field ? (
                    <FieldDrawer {...fieldProps} field={result.field} prefix={result.prefix ?? undefined} />
                ) : result.placeholder ? <>
                    {drawLabel(result.prefix ?? undefined)}
                    <div data-field={key} key={"field:" + key} class="flex row">{result.placeholder()}{options.suffix?.(props)}</div>
                </> : (
                    drawError(`Form drawer decorator ${field.name} did not return any content`)
                )
            )
        }

        const base = () => {
            const fieldProps = { field: props.field, binding: props.binding, base: props.base, label: props.label, path: props.path }
            let result = h(field, fieldProps)
            if (options.replace) {
                const replace = options.replace(fieldProps)
                if (replace != null) result = replace
            }

            if (options.disable) {
                result = <ButtonGroup disabled={options.disable(fieldProps)}>{result}</ButtonGroup>
            }

            return result
        }

        if (field.noFieldDecoration) {
            return base
        }

        if (field.fullLine) {
            if (props.label != "") {
                return () => <>
                    {drawLabel()}
                    {base()}
                </>
            } else {
                return base
            }
        }

        if (props.fieldOnly) {
            return () => <>
                {options.prefix?.(props)}{props.prefix?.()}{base()}{options.suffix?.(props)}
            </>
        }

        if (props.label != "" && (typeof options.labelWidth != "number" || options.labelWidth > 0)) {
            return () => <>
                {drawLabel()}
                <div data-field={key} key={"field:" + key} class="flex row">{props.prefix?.()}{base()}{options.suffix?.(props)}</div>
            </>
        } else {
            return () => <>
                <div></div>
                <div data-field={key} key={"field:" + key} class="flex row">{options.prefix?.(props)}{props.prefix?.()}{base()}{options.suffix?.(props)}</div>
            </>
        }
    },
}))

export const ReadonlyFieldDrawer = defineComponent({
    name: "ReadonlyFieldDrawer",
    props: {
        ...getFieldDrawerProps(ReadonlyField),
    },
    setup(props, ctx) {
        const value = useFieldDrawerValue(props)

        return () => toString(value.value)
    },
})
registerFieldDrawer(ReadonlyField, ReadonlyFieldDrawer)

export const StringFieldDrawer = defineComponent({
    name: "StringFieldDrawer",
    props: {
        ...getFieldDrawerProps(StringField),
    },
    setup(props, ctx) {
        const value = props.field.nullable ? useFieldDrawerValue(props, v => v == "" ? null : v) : useFieldDrawerValue(props)

        return () => (
            <TextField
                class="flex-fill border rounded" vModel={value.value} onChange={value.changed} clear
                explicit={props.field.explicit ?? undefined} placeholder={value.value == null ? "null" : undefined}
            />
        )
    },
})
registerFieldDrawer(StringField, StringFieldDrawer)

export const NumberFieldDrawer = defineComponent({
    name: "NumberFieldDrawer",
    props: {
        ...getFieldDrawerProps(NumberField),
    },
    setup(props, ctx) {
        const field = props.field
        const error = ref("")

        const fieldValue = useFieldDrawerValue(props)
        const numberValue = numberModel(fieldValue, { integer: !!field.integer, nullable: props.field.nullable ?? false })

        function changed() {
            if (error.value) return
            fieldValue.changed()
        }

        return () => (
            <TextField
                type={field.integer ? "number" : undefined} class="flex-fill border rounded"
                vModel={numberValue.value} onChange={changed} clear
                min={field.min ?? undefined} max={field.max ?? undefined} validate
                onErrorChanged={newError => error.value = newError}
                explicit={props.field.explicit ?? undefined} required={!props.field.nullable}
                placeholder={props.field.nullable ? "null" : undefined}
            />
        )
    },
})
registerFieldDrawer(NumberField, NumberFieldDrawer)

export const CheckFieldDrawer = defineComponent({
    name: "CheckFieldDrawer",
    props: {
        ...getFieldDrawerProps(CheckField),
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
    },
})
registerFieldDrawer(CheckField, CheckFieldDrawer)

const _NULL_OPTION = Symbol.for("formBuilder.nullOption")
export const SelectFieldDrawer = defineComponent({
    name: "SelectFieldDrawer",
    props: {
        ...getFieldDrawerProps(SelectField),
    },
    setup(props, ctx) {
        const value = useFieldDrawerValue(props, v => v == _NULL_OPTION ? null : v)

        let options = props.field.options as (string | number | typeof _NULL_OPTION)[]
        let optionLabels = props.field.labels ?? options.map(toString)

        if (props.field.nullable) {
            options = [_NULL_OPTION, ...options]
            optionLabels = ["N/A", ...optionLabels]
        }

        const labelLookup = new Map(options.map((v, i) => [v, optionLabels[i]]))

        return () => (
            <MenuItem
                forceWidth defaultAction clear
                class="border rounded flex-fill"
            >
                <div class="flex-fill">{value.value == null ? "N/A" : labelLookup.get(value.value) ?? value.value}</div>
                <Icon icon="M12,18.17L8.83,15L7.42,16.41L12,21L16.59,16.41L15.17,15M12,5.83L15.17,9L16.58,7.59L12,3L7.41,7.59L8.83,9L12,5.83Z" />
                {options.map((option, i) => (
                    <MenuItem label={optionLabels[i]} key={optionLabels[i]} onClick={() => { value.value = option; value.changed() }} />
                ))}
            </MenuItem>
        )
    },
})
registerFieldDrawer(SelectField, SelectFieldDrawer)

export const ObjectFieldDrawer = defineComponent({
    name: "ObjectFieldDrawer",
    props: {
        ...getFieldDrawerProps(ObjectField),
    },
    fullLine: true,
    setup(props, ctx) {
        const value = computed({
            get: () => props.binding.getValue(props.base),
            set: (value) => props.binding.setValue(props.base, value),
        })

        const path = props.path
        const key = path.join(".")
        const options = useFieldOptions()

        return () => <>
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
    },
})
registerFieldDrawer(ObjectField, ObjectFieldDrawer)

export const TableFieldDrawer = defineComponent({
    name: "TableFieldDrawer",
    props: {
        ...getFieldDrawerProps(TableField),
    },
    fullLine: true,
    setup(props, ctx) {
        const value = useFieldDrawerValue(props)
        const path = props.path
        const key = path.join(".")
        const options = useFieldOptions()

        function getElements() {
            if (value.value instanceof Array) return value.value
            if (value.value instanceof Map) return [...value.value.values()]
            if (typeof value.value == "object" && value.value != null) return Object.values(value.value)
            return []
        }

        function getKeys() {
            if (value.value instanceof Array) return [...range(value.value.length, v => v.toString())]
            if (value.value instanceof Map) return [...value.value.keys()]
            if (typeof value.value == "object" && value.value != null) return Object.keys(value.value)
            return []
        }

        function renderTable() {
            const elements = getElements()
            const keys = getKeys()
            const showIndex = props.field.showIndex
            const properties = props.field.properties

            return elements.map((elem, i) => {
                const key = keys[i]
                const basePath = path.add(key)
                const baseKey = path.join(".")
                const suffixProps: _FieldProps<FormField> = {
                    ...props,
                    path: basePath,
                }

                return (
                    <tr data-field-table-row={baseKey}>
                        {showIndex && <td>{keys[i]}</td>}
                        {properties.map(prop => {
                            const { field, bind } = prop
                            const fieldPath = basePath.add(bind.getKey())
                            const fieldKey = fieldPath.join(".")

                            return <td>
                                <FieldDrawer field={field} base={elem} binding={bind} label={""} path={fieldPath} key={fieldKey} />
                            </td>
                        })}
                        {Optional.value(options.suffix).notNull().do(v => v(suffixProps)).notNull().tryUnwrap()}
                    </tr>
                )
            })
        }

        return () => <>
            <table class="as-table w-fill" data-field={key} style={grid().colspan(2).$}>
                <thead>
                    <tr>
                        {props.field.showIndex && (
                            <td></td>
                        )}
                        {props.field.properties.map(prop => (
                            <td>{prop.label}</td>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {renderTable()}
                </tbody>
            </table>
        </>
    },
})
registerFieldDrawer(TableField, TableFieldDrawer)

export const InfoFieldDrawer = defineComponent({
    name: "InfoFieldDrawer",
    props: {
        ...getFieldDrawerProps(InfoField),
    },
    noFieldDecoration: true,
    setup(props, ctx) {
        const styles: Record<InfoField["decoration"], string> = {
            border: "border",
            error: "border border-danger",
            info: "border border-primary",
            warning: "border border-warning",
        }

        const colors: Record<InfoField["decoration"], string> = {
            border: "default",
            error: "danger",
            info: "primary",
            warning: "warning",
        }

        const icons: Record<InfoField["decoration"], string | null> = {
            border: null,
            error: mdiAlert,
            info: mdiInformationBox,
            warning: mdiAlert,
        }

        const path = props.path
        const key = path.join(".")

        return () => (
            <div data-field={key} class={["gap-1", props.label.length > 0 && "pl-2"]} key={"field1:" + key} style={grid().colspan(2).$}>
                {props.field.decoration == null ? (
                    <div>{props.field.text}</div>
                ) : (
                    <div class={["flex row gap-2 p-2 rounded", styles[props.field.decoration]]}>
                        {icons[props.field.decoration] != null && <Icon scale={1.25} class={`pt-1 text-${colors[props.field.decoration]}`} icon={icons[props.field.decoration]!} />}
                        {props.field.text}
                    </div>
                )}
            </div>
        )
    },
})
registerFieldDrawer(InfoField, InfoFieldDrawer)

export const _NullableFieldDrawer = defineComponent({
    name: "NullableFieldDrawer",
    props: {
        ...getFieldDrawerProps(NullableField),
    },
    setup(props, ctx) {
        const value = useFieldDrawerValue(props)
        const options = useFieldOptions()
        const checked = ref(value.value != null)

        watch(checked, () => {
            if (checked.value) {
                const instance = options.instantiate?.(new FieldInstantiationEvent(props.path, options.basePath, props.field.typeName))

                if (instance == undefined) {
                    nextTick(() => checked.value = false)
                    // eslint-disable-next-line no-console
                    console.warn("Nullable field " + JSON.stringify(props.path.toArray()) + " instantiation event was not resolved")
                } else {
                    value.value = instance
                }
            } else {
                value.value = null
            }
        })

        const checkbox = () => <input type="checkbox" checked={checked.value} onChange={e => checked.value = (e.target as HTMLInputElement).checked} />

        return () => (
            value.value == null ? (
                checkbox()
            ) : (
                <FieldDrawer {...props} field={props.field.base} fieldOnly prefix={checkbox} />
            )
        )
    },
})
export const NullableFieldDrawer = new FieldDrawerDecorator<NullableField>("Nullable", (props) => {
    const value = useFieldDrawerValue(props)
    const options = useFieldOptions()
    const checked = ref(value.value != null)
    const baseField = props.field.base

    const result: FieldDrawerDecorator.Result = reactive({
        prefix: () => <input type="checkbox" checked={checked.value} onChange={e => checked.value = (e.target as HTMLInputElement).checked} />,
        field: null,
        placeholder: () => [""],
    })

    watch(checked, () => {
        if (checked.value) {
            const instance = options.instantiate?.(new FieldInstantiationEvent(props.path, options.basePath, props.field.typeName))

            if (instance == undefined) {
                nextTick(() => checked.value = false)
                // eslint-disable-next-line no-console
                console.warn("Nullable field " + JSON.stringify(props.path.toArray()) + " instantiation event was not resolved")
                return
            }
            value.value = instance
            result.field = baseField
        } else {
            value.value = null
            result.field = null
        }
    }, { immediate: true })

    return result
})
registerFieldDrawer(NullableField, NullableFieldDrawer)
