import _debug from "debug"
import { h, watch } from "vue"
import { createRouter, Router, RouteRecordRaw, RouterOptions } from "vue-router"
import { ShiftTuple } from "../comTypes/types"
import { unreachable } from "../comTypes/util"
import { EventListener } from "../events/EventListener"
import { ServiceFactory, ServiceKind } from "../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../serviceProvider/ServiceProvider"
import { VueApplication } from "./VueApplication"

const debug = _debug("apsides:vue:router-service")

export class RouterService extends EventListener {
    protected _router: Router | null = null
    protected _routes: RouteRecordRaw[] | null = []

    public addRoute(route: RouteRecordRaw) {
        if (this._routes != null) {
            debug("Registering route: %o", route)
            this._routes.push(route)
        } else throw new Error("Cannot add a new route after the Vue application has already been mounted")
    }

    public get router() {
        if (this._router == null) throw new Error("Tried to get router instance before Vue app was mounted")
        return this._router
    }

    constructor(
        protected readonly _services: ServiceProvider,
        options: Omit<RouterOptions, "routes"> & Partial<Pick<RouterOptions, "routes">>
    ) {
        super()

        if (options.routes) {
            this._routes!.push(...options.routes)
        }

        this._services.get(VueApplication.kind).onBeforeMount.add(this, app => {
            if (this._routes == null) unreachable()

            this._router = createRouter({
                routes: [
                    ...this._routes,
                    {
                        name: "404",
                        component: { setup: () => () => h("pre", { class: "m-4" }, "Page not found") },
                        path: "/:page(.*)*"
                    },
                ],
                history: options.history
            })

            if (debug.enabled) {
                watch(this._router.currentRoute, route => {
                    debug("Route: %o", route)
                }, { immediate: true })
            }

            app.use(this._router)
        })
    }

    public static make(...args: ShiftTuple<ConstructorParameters<typeof RouterService>>): ServiceFactory<RouterService> {
        return {
            kind: this.kind,
            init(services) {
                return new RouterService(services, ...args)
            },
        }
    }

    public static readonly kind = new ServiceKind<RouterService>("RouterService")
}
