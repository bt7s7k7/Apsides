import { Predicate, convertCase, isClassCtor } from "../comTypes/util"
import { Struct } from "../struct/Struct"
import { Type } from "../struct/Type"
import { Binding_t, ObjectPropertyBinding } from "./Binding"

export abstract class FormField { }
export const FormField_t = new Struct.PolymorphicSerializer<FormField>("FormField")

export class Form extends Struct.define("Form", {
    root: FormField_t.base
}) { }

export namespace Form {
    export function getForm(type: Type<any>) {
        const field = getField(type)
        if (field == null) throw new Error(`Cannot create a form for type ${JSON.stringify(type.name)}, specify a "CustomFieldAttribute"`)
        return new Form({
            root: field
        })
    }

    export function getField(type: Type<any>): FormField | null {
        const fieldAttr = Type.getMetadata(type)?.get(CustomFieldAttribute)
        if (fieldAttr) {
            const field = fieldAttr.getField(type)
            if (isClassCtor(field)) return new field()
            return field
        }

        if (type.name == Type.string.name) return new TextField()
        if (type.name == Type.number.name) return new NumberField()
        if (type.name == Type.boolean.name) return new CheckField()

        if (Type.isEnum(type)) return new SelectField({
            options: type.entries.filter(Predicate.typeOf("string"))
        })

        if (Type.isObject(type)) return new ObjectField({
            properties: type.propList.map(([key, type]) => {
                const field = getField(type)
                if (field == null) return null

                return new PropertyInfo({
                    field,
                    label: Type.getMetadata(type)?.get(LabelAttribute)?.label ?? convertCase(key, "camel", "title"),
                    bind: new ObjectPropertyBinding({ property: key })
                })
            }).filter(Predicate.notNull())
        })

        return null
    }
}

export class PropertyInfo extends Struct.define("PropertyInfo", {
    label: Type.string,
    bind: Binding_t.base,
    field: FormField_t.base
}) { }

export class TextField extends Struct.define("TextField", {}, FormField) { }
FormField_t.register(TextField)

export class NumberField extends Struct.define("NumberField", {}, FormField) { }
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

export class CustomFieldAttribute<T extends Type<any> = Type<any>> {
    public getField(type: Type<any>) {
        if (isClassCtor(this._field)) {
            return this._field as FormField
        } else {
            return (this._field as (type: T) => FormField)(type as T)
        }

    }

    constructor(
        protected readonly _field: FormField | ((type: T) => FormField)
    ) { }
}

export class LabelAttribute {
    constructor(
        public readonly label: string
    ) { }
}
