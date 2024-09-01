import { ServiceFactory, ServiceKind } from "./ServiceFactory"
import { ServiceProvider } from "./ServiceProvider"


export class ServiceLoader {
    public addItem(item: ServiceLoader.ServiceDeclaration, scope = this._root) {
        if (item.namespace) {
            scope = scope.getNamespace(item.namespace)
        }

        if (item.items) {
            this.addItems(item.items, scope)
        }

        if (item.service) {
            const handle = scope["_registerService"](item.service)
            if (!item.optional) {
                this._pending.push(handle)
            }
        }

        return this
    }

    public add<T>(kind: ServiceKind<T>, init: (services: ServiceProvider) => T, options?: ServiceLoader.Options): this
    public add<T>(factory: ServiceFactory<T>, options?: ServiceLoader.Options): this
    public add(...args: [kind: ServiceKind<any>, init: (services: ServiceProvider) => any, options?: ServiceLoader.Options] | [factory: ServiceFactory<any>, options?: ServiceLoader.Options]): this {
        let options: ServiceLoader.Options | undefined, factory: ServiceFactory<any>

        if (args[0] instanceof ServiceKind) {
            const [kind, init, options_1] = args as [kind: ServiceKind<any>, init: (services: ServiceProvider) => any, options?: ServiceLoader.Options]
            options = options_1
            factory = { kind, init }
        } else {
            const [factory_1, options_1] = args as [factory: ServiceFactory<any>, options?: ServiceLoader.Options]
            options = options_1
            factory = factory_1
        }

        const optional = options?.optional ?? false
        if (!optional) {
            const handle = this._root["_registerService"](factory)
            this._pending.push(handle)
        }

        return this

    }

    public namespace(name: string, thunk: (loader: ServiceLoader) => void) {
        const scope = this._root.getNamespace(name)
        thunk(new ServiceLoader(scope, this._pending))
        return this
    }

    public provide<T>(kind: ServiceKind<T>, service: T) {
        this._root.provideService(kind, service)
        return this
    }

    public addItems(items: ServiceLoader.ServiceDeclaration[], scope = this._root) {
        for (const childItem of items) {
            this.addItem(childItem, scope)
        }

        return this
    }

    public load() {
        for (const handle of this._pending) {
            handle.namespace["_loadHandle"](handle)
        }

        return this._root
    }

    constructor(
        protected readonly _root = new ServiceProvider(null),
        protected readonly _pending: ServiceProvider._ServiceHandle[] = []
    ) { }
}

export namespace ServiceLoader {
    export interface ServiceDeclaration {
        service?: ServiceFactory<any> | null
        namespace?: string | null
        items?: ServiceDeclaration[] | null
        optional?: boolean
    }

    export interface Options {
        optional?: boolean
    }
}
