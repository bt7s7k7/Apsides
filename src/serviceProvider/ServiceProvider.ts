import { ensureKey, unreachable } from "../comTypes/util"
import { Disposable } from "../events/Disposable"
import { AsyncInitializationQueue } from "./AsyncInitializationQueue"
import { DuplicateServiceError, ServiceNotFoundError } from "./errors"
import { ServiceFactory, ServiceKind } from "./ServiceFactory"
import { ServiceLoader } from "./ServiceLoader"


export class ServiceProvider extends Disposable {
    protected readonly _items = new Map<ServiceKind<any>, ServiceProvider._ServiceHandle>()
    protected readonly _namespaces = new Map<string, ServiceProvider>()

    protected _addItem(handle: ServiceProvider._ServiceHandle) {
        if (this._items.has(handle.kind)) {
            throw new DuplicateServiceError("Duplicate registration of service " + handle.kind.name)
        }

        this._items.set(handle.kind, handle)
    }

    protected _registerService(item: ServiceFactory<any>) {
        const handle = new ServiceProvider._ServiceHandle(item.kind, item, this)
        this._addItem(handle)

        if (item.kind.includes) {
            for (const included of item.kind.includes) {
                // Test if there is an explicit implementation of the included service, it has priority if so
                if (this._items.has(included)) continue
                const innerHandle = new ServiceProvider._ServiceHandle(included, handle, this)
                this._addItem(innerHandle)
            }
        }

        return handle
    }

    public provideService<T>(kind: ServiceKind<T>, value: T) {
        const existingHandle = this._items.get(kind)

        if (existingHandle && existingHandle.source instanceof ServiceProvider._ServiceHandle) {
            // This kind of service was registered to be provided as a part of an another service,
            // it is expected that the including service will call provideService, and we set the impl here
            existingHandle.service = value
            return
        }

        const handle = new ServiceProvider._ServiceHandle(kind, null, this)
        handle.service = value
        this._addItem(handle)
        return value
    }

    public initialize<T>(factory: ServiceFactory<T>) {
        return factory.init(this)
    }

    public getNamespace(name: string) {
        return ensureKey(this._namespaces, name, () => new ServiceProvider(this))
    }

    protected _loadHandle(handle: ServiceProvider._ServiceHandle) {
        if (handle.service != null) {
            return handle.service
        } else if (handle.loading) {
            throw new ServiceNotFoundError("Circular service dependencies")
        } else {
            handle.loading = true
            try {
                // It is not logically possible for the factory to be null if the service is not defined
                // factory is only null if the handle is created with `provideService` where the service 
                // is always set
                if (handle.source == null) unreachable()

                if (handle.source instanceof ServiceProvider._ServiceHandle) {
                    // This service is included in an another
                    this._loadHandle(handle.source)
                    if (handle.service == null) throw new ServiceNotFoundError(`Service "${handle.kind.name}" was set to be included in service "${handle.source.kind.name}", but was not`)
                    return handle.service
                }

                return handle.service = handle.source.init(this)
            } finally {
                handle.loading = false
            }
        }
    }

    public get<T>(type: ServiceKind<T>): T {
        const handle = this._items.get(type)
        if (handle) {
            return this._loadHandle(handle)
        } else if (this.parent != null) {
            return this.parent.get(type)
        } else {
            throw new ServiceNotFoundError("Cannot resolve service " + type.name)
        }
    }

    public tryGet<T>(type: ServiceKind<T>): T | null {
        const handle = this._items.get(type)
        if (handle) {
            return this._loadHandle(handle)
        } else if (this.parent != null) {
            return this.parent.tryGet(type)
        } else {
            return null
        }
    }

    public makeTransientScope() {
        return new ServiceProvider(this)
    }

    public makeTransientLoader() {
        return new ServiceLoader(this.makeTransientScope())
    }

    public override[Symbol.dispose](): void {
        for (const namespace of this._namespaces.values()) {
            namespace[Symbol.dispose]()
        }

        for (const handle of this._items.values()) {
            if (handle.service && Symbol.dispose in handle.service) {
                handle.service[Symbol.dispose]()
            }
        }

        this._items.clear()
        this._namespaces.clear()

        super[Symbol.dispose]()
    }

    constructor(
        public readonly parent: ServiceProvider | null,
    ) {
        super()

        if (this.parent == null) {
            this._registerService(AsyncInitializationQueue)
        }
    }
}

export namespace ServiceProvider {
    export class _ServiceHandle {
        public loading = false
        public service: any = null

        constructor(
            public readonly kind: ServiceKind<any>,
            public readonly source: ServiceFactory<any> | _ServiceHandle | null,
            public readonly namespace: ServiceProvider,
        ) { }
    }
}
