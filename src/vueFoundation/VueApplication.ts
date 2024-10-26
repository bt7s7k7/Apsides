import { App, inject, InjectionKey, ref, Ref } from "vue"
import { Disposable } from "../events/Disposable"
import { EventEmitter } from "../events/EventEmitter"
import { AsyncInitializationQueue } from "../serviceProvider/AsyncInitializationQueue"
import { ServiceFactory, ServiceKind } from "../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../serviceProvider/ServiceProvider"

const SERVICES_KEY = Symbol.for("apsides.vueFoundation.services") as InjectionKey<ServiceProvider>
const READY_KEY = Symbol.for("apsides.vueFoundation.ready") as InjectionKey<Ref<boolean>>

export class VueApplication extends Disposable {
    public readonly onBeforeMount = new EventEmitter<App<Element>>({ sync: true })

    protected readonly _ready = ref(false)

    public mount(...args: Parameters<App<Element>["mount"]>) {
        this.onBeforeMount.emit(this._nativeApp)
        this._nativeApp.mount(...args)
    }

    constructor(
        protected readonly _services: ServiceProvider,
        protected readonly _nativeApp: App<Element>,
    ) {
        super()
        _nativeApp.provide(SERVICES_KEY, _services)
        _nativeApp.provide(READY_KEY, this._ready)

        _services.get(AsyncInitializationQueue.kind).loaded.then(() => this._ready.value = true)
    }

    public static make(callback: (services: ServiceProvider) => App<Element>): ServiceFactory<VueApplication> {
        return {
            kind: this.kind,
            init(services) {
                return new VueApplication(services, callback(services))
            },
        }
    }

    public static readonly kind = new ServiceKind<VueApplication>("VueApplication")
}

export function useApplicationReady() {
    const ready = inject(READY_KEY)
    if (ready == null) throw new Error("Cannot find application ready state, make sure you use useApplicationReady in apps wrapped in an VueApplication service")
    return ready
}

export function useServiceProvider() {
    const services = inject(SERVICES_KEY)
    if (services == null) throw new Error("Cannot find ServiceProvider, make sure you use useServiceProvider in apps wrapped in an VueApplication service")
    return services
}
