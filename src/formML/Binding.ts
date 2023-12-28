import { Struct } from "../struct/Struct"
import { Type } from "../struct/Type"

export abstract class Binding {
    public abstract getValue(base: any): any
    public abstract setValue(base: any, value: any): void
    public abstract getKey(): string
}

export const Binding_t = new Struct.PolymorphicSerializer<Binding>("Binding")

export class ObjectPropertyBinding extends Struct.define("ObjectPropertyBinding", {
    property: Type.string
}, Binding) {
    public getValue(base: any) {
        return base[this.property]
    }

    public getKey() {
        return this.property
    }

    public setValue(base: any, value: any) {
        base[this.property] = value
    }
}
Binding_t.register(ObjectPropertyBinding)

export class RootBinding extends Struct.define("RootBiding", {}, Binding) {
    public getKey(): string {
        return ""
    }

    public getValue(base: any) {
        return base
    }

    public setValue(base: any, value: any): void {
        throw new Error("Root binding is readonly")
    }
}
Binding_t.register(RootBinding)
