import { App, inject, InjectionKey } from "vue"
import { Disposable } from "../events/Disposable"
import { EventEmitter } from "../events/EventEmitter"
import { ServiceFactory, ServiceKind } from "../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../serviceProvider/ServiceProvider"

const SERVICES_KEY = Symbol.for("apsides.vueFoundation.services") as InjectionKey<ServiceProvider>

export class VueApplication extends Disposable {
    public readonly onBeforeMount = new EventEmitter<App<Element>>({ sync: true })

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

export function useServiceProvider() {
    const services = inject(SERVICES_KEY)
    if (services == null) throw new Error("Cannot find ServiceProvider, make sure you use useServiceProvider in apps wrapped in an VueApplication service")
}
