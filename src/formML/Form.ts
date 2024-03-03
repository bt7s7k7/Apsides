import { Predicate, convertCase } from "../comTypes/util"
import { Struct } from "../struct/Struct"
import { Type } from "../struct/Type"
import { Binding_t, ObjectPropertyBinding, RootBinding } from "./Binding"

export abstract class FormField { }
export const FormField_t = new Struct.PolymorphicSerializer<FormField>("FormField")

export class Form extends Struct.define("Form", {
    root: FormField_t.base
}) { }

function _getProperties(type: Type.ObjectType) {
    return type.propList.map(([key, type]) => {
        const field = Form.getField(type)
        if (field == null) return null

        return new PropertyInfo({
            field,
            label: Type.getMetadata(type)?.get(LabelAttribute)?.label ?? convertCase(key, "camel", "title"),
            bind: new ObjectPropertyBinding({ property: key })
        })
    }).filter(Predicate.notNull())
}

export namespace Form {
    export function getForm(type: Type<any>) {
        const field = getField(type)
        if (field == null) throw new Error(`Cannot create a form for type ${JSON.stringify(type.name)}, specify a "CustomFieldAttribute"`)
        return new Form({
            root: field
        })
    }

    export function getField(type: Type<any>): FormField | null {
        const metadata = Type.getMetadata(type)
        const fieldAttr = metadata?.get(CustomFieldAttribute)
        if (fieldAttr) {
            return fieldAttr.getField(type)
        }

        if (type.name == Type.string.name) return new StringField()
        if (type.name == Type.number.name) return new NumberField()
        if (type.name == Type.boolean.name) return new CheckField()

        if (Type.isEnum(type)) return new SelectField({
            options: type.entries.filter(Predicate.typeOf("string"))
        })

        if (Type.isObject(type)) {
            const properties = _getProperties(type)
            return new ObjectField({ properties })
        }

        const tableAttr = metadata?.get(TableAttribute)
        if ((Type.isArray(type) || Type.isMap(type) || Type.isRecord(type)) && tableAttr) {
            const elementType = type.type
            const showIndex = tableAttr.showIndex

            let properties: PropertyInfo[]
            if (Type.isObject(elementType)) {
                properties = _getProperties(elementType)
            } else {
                const elementField = getField(elementType)
                if (elementField == null) return null

                properties = [
                    new PropertyInfo({
                        bind: new RootBinding(),
                        field: elementField,
                        label: "Value"
                    })
                ]
            }

            return new TableField({ properties, showIndex })
        }

        return null
    }
}

export class PropertyInfo extends Struct.define("PropertyInfo", {
    label: Type.string,
    bind: Binding_t.base,
    field: FormField_t.base
}) { }

export class StringField extends Struct.define("TextField", {
    explicit: Type.boolean.as(Type.nullable)
}, FormField) { }
FormField_t.register(StringField)

export class NumberField extends Struct.define("NumberField", {
    integer: Type.boolean.as(Type.nullable, { skipNullSerialize: true }),
    min: Type.number.as(Type.nullable, { skipNullSerialize: true }),
    max: Type.number.as(Type.nullable, { skipNullSerialize: true }),
    explicit: Type.boolean.as(Type.nullable)
}, FormField) {
    public static readonly INTEGER = new NumberField({ integer: true })
    public static readonly POSITIVE_INTEGER = new NumberField({ integer: true, min: 0 })
    public static readonly ONE_INTEGER = new NumberField({ integer: true, min: 1 })
    public static readonly POSITIVE = new NumberField({ min: 0 })
}
FormField_t.register(NumberField)

export class CheckField extends Struct.define("CheckField", {}, FormField) { }
FormField_t.register(CheckField)

export class SelectField extends Struct.define("SelectField", {
    options: Type.string.as(Type.array)
}, FormField) { }
FormField_t.register(SelectField)

export class ObjectField extends Struct.define("ObjectField", {
    properties: PropertyInfo.ref().as(Type.array)
}, FormField) { }
FormField_t.register(ObjectField)

export class TableField extends Struct.define("TableField", {
    showIndex: Type.boolean,
    properties: PropertyInfo.ref().as(Type.array)
}, FormField) { }
FormField_t.register(TableField)

export class InfoField extends Struct.define("InfoField", {
    text: Type.string,
    decoration: Type.enum("border", "info", "warning", "error").as(Type.optional)
}) { }
FormField_t.register(InfoField)

export class CustomFieldAttribute<T extends Type<any> = Type<any>> {
    public getField(type: Type<any>): FormField {
        if (typeof this._field == "function") {
            return this._field(type as T)
        } else {
            return this._field
        }
    }

    constructor(
        protected readonly _field: FormField | ((type: T) => FormField)
    ) { }
}

export class TableAttribute {
    public readonly showIndex

    constructor(
        options?: { showIndex?: boolean }
    ) {
        this.showIndex = options?.showIndex ?? false
    }
}

export class LabelAttribute {
    constructor(
        public readonly label: string
    ) { }
}
