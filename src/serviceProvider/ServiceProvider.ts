import { ensureKey, unreachable } from "../comTypes/util"
import { Disposable } from "../events/Disposable"
import { AsyncInitializationQueue } from "./AsyncInitializationQueue"
import { DuplicateServiceError, ServiceNotFoundError } from "./errors"
import { ServiceFactory, ServiceKind } from "./ServiceFactory"
import { ServiceLoader } from "./ServiceLoader"


export class ServiceProvider extends Disposable {
    protected readonly _items = new Map<ServiceKind<any>, ServiceProvider._ServiceHandle>()
    protected readonly _namespaces = new Map<string, ServiceProvider>()

    protected _addItem(kind: ServiceKind<any>, handle: ServiceProvider._ServiceHandle) {
        if (this._items.has(kind)) {
            throw new DuplicateServiceError("Duplicate registration of service " + kind.name)
        }

        this._items.set(kind, handle)
    }

    protected _registerService(item: ServiceFactory<any>) {
        const handle = new ServiceProvider._ServiceHandle(item, this)
        this._addItem(item.kind, handle)
        return handle
    }

    public provideService<T>(kind: ServiceKind<T>, value: T) {
        const handle = new ServiceProvider._ServiceHandle(null, this)
        handle.service = value
        this._addItem(kind, handle)
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
                if (handle.factory == null) unreachable()

                return handle.service = handle.factory.init(this)
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
        public readonly parent: ServiceProvider | null
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
            public readonly factory: ServiceFactory<any> | null,
            public readonly namespace: ServiceProvider
        ) { }
    }
}
