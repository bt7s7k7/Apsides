import { iterableTake } from "../comTypes/util"
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

export class DeepObjectPropertyBinding extends Struct.define("DeepObjectPropertyBinding", {
    path: Type.string.as(Type.array)
}, Binding) {
    public getValue(base: any) {
        let result = base
        for (const key of this.path) result = result[key]
        return result
    }

    public getKey() {
        return this.path.join(".")
    }

    public setValue(base: any, value: any) {
        let receiver = base

        for (const key of iterableTake(this.path, this.path.length - 1)) {
            receiver = receiver[key]
        }

        receiver[this.path[this.path.length - 1]] = value
    }
}
Binding_t.register(DeepObjectPropertyBinding)

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
