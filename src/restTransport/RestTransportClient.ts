import _debug from "debug"
import { Optional } from "../comTypes/Optional"
import { ensureKey, isPrimitiveValue } from "../comTypes/util"
import { ClientError, ERR_SERVER_ERROR } from "../foundation/messaging/errors"
import { DeferredSerializationValue } from "../index_struct"
import { ServiceFactory } from "../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../serviceProvider/ServiceProvider"
import { Type } from "../struct/Type"
import { RpcMessage } from "../structRpc/architecture/RpcMessage"
import { RestTransport } from "./RestTransport"

const debug = _debug("apsides:rest")

export const ERR_REST_UNSUPPORTED_REQUEST_KIND = "ERR_REST_UNSUPPORTED_REQUEST_KIND"
export const ERR_REST_CANNOT_ROUTE_REQUEST = "ERR_REST_CANNOT_ROUTE_REQUEST"

const _Error_t = Type.object({
    code: Type.string,
    message: Type.string,
})

export class RestTransportClient extends RestTransport {
    protected readonly _routes = new Map<string, Map<string | null, RestTransport.RouteDefinition>>()
    protected readonly _host

    public sendNotification(notification: object): Promise<void> {
        return Promise.resolve()
    }

    public async sendRequest(request: object): Promise<object> {
        const request_1 = this._parseRequest(request)
        debug("Resolving request %o", request_1)
        const { controller, action, argument, id } = request_1
        const route = this._routes.get(controller)?.get(action)
        if (route == null) {
            debug("  No route found")
            throw new ClientError(`There is not route for "${controller}"::"${action}"`, { code: ERR_REST_CANNOT_ROUTE_REQUEST })
        }

        let path = route.route
        if (id != null) {
            path = path.replace(/:id/, encodeURIComponent(id))
        }

        const baseUrl = new URL(this._root + "/", this._host)
        const url = new URL(path, baseUrl)
        const options: RequestInit = {
            method: route.method,
        }

        if (argument != null) {
            if (route.method == "get") {
                if (isPrimitiveValue(argument)) {
                    url.search = argument!.toString()
                } else if (typeof argument == "object") {
                    for (const [key, value] of Object.entries(argument)) {
                        if (value == null) continue
                        if (isPrimitiveValue(value)) {
                            url.searchParams.set(key, value.toString())
                        } else {
                            url.searchParams.set(key, JSON.stringify(value))
                        }
                    }
                }
            } else {
                options.body = JSON.stringify(argument)
                const headers = new Headers()
                headers.set("content-type", "application/json")
                options.headers = headers
            }
        }

        debug("  Resolved route: %o", url.href)

        const response = await fetch(url, options)

        debug("  Received response: %o", response.status)

        const responseData = await response.text()

        debug("  Received data: %o", responseData)

        if (response.status != 200) {
            const error = Optional.pcall(() => _Error_t.deserialize(JSON.parse(responseData))).tryUnwrap()
            if (error == null) {
                throw new ClientError("Server returned malformed error response", { code: ERR_SERVER_ERROR })
            }
            throw new ClientError(error.message, { code: error.code })
        }

        const responseValue = JSON.parse(responseData)
        const result = new RpcMessage.ToClient.Result({
            kind: "result",
            value: DeferredSerializationValue.prepareSerializationUntyped(responseValue),
        })
        return result.serialize()
    }

    protected _parseRequest(request: object): { controller: string, action: string | null, argument: any, id: string | null } {
        if ("kind" in request) {
            if (request.kind == "call") {
                const call = RpcMessage.ToServer.Call.deserialize(request)
                return { controller: call.type, action: call.action, argument: call.argument.value, id: call.id ?? null }
            } else if (request.kind == "get") {
                const get = RpcMessage.ToServer.Get.deserialize(request)
                return { controller: get.type, action: null, argument: null, id: get.id ?? null }
            }
        }

        throw new ClientError("RestTransportClient does not support this request kind", { code: ERR_REST_UNSUPPORTED_REQUEST_KIND })
    }

    public static make(options: RestTransportClient.Options): ServiceFactory<RestTransport> {
        return {
            kind: RestTransport.kind,
            init(services) {
                return new RestTransportClient(services, options)
            },
        }
    }

    constructor(services: ServiceProvider, options?: RestTransportClient.Options) {
        super(services, options)
        for (const route of this._buildRoutes()) {
            debug("Registering route %o", { ...route, controller: route.controller.api.model.baseType.name, action: route.action?.name ?? null })
            ensureKey(this._routes, route.controller.api.model.baseType.name, () => new Map() as never).set(route.action?.name ?? null, route)
        }

        if (options?.host) {
            this._host = options.host
        } else if (globalThis.window) {
            this._host = globalThis.window.location.host
        } else {
            throw new Error("Running RestTransportClient outside of the browser, setting the 'host' property in the options is required")
        }
    }
}

export namespace RestTransportClient {
    export interface Options extends RestTransport.Options {
        /** Base URL to point API call to. Must be set if a RestTransportClient is used outside of a browser. @default location.host */
        host?: string
    }
}
