import { Optional } from "../comTypes/Optional"
import { isPrimitiveValue } from "../comTypes/util"
import { ClientError, ERR_SERVER_ERROR } from "../foundation/messaging/errors"
import { ServiceFactory } from "../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../serviceProvider/ServiceProvider"
import { Type } from "../struct/Type"
import { RpcMessage } from "../structRpc/architecture/RpcMessage"
import { RestTransport } from "./RestTransport"

export const ERR_REST_UNSUPPORTED_REQUEST_KIND = "ERR_REST_UNSUPPORTED_REQUEST_KIND"
export const ERR_REST_CANNOT_ROUTE_REQUEST = "ERR_REST_CANNOT_ROUTE_REQUEST"

const _Error_t = Type.object({
    code: Type.string,
    message: Type.string
})

export class RestTransportClient extends RestTransport {
    protected readonly _routes = new Map<string, Map<string | null, RestTransport.RouteDefinition>>()

    public sendNotification(notification: object): Promise<void> {
        return Promise.resolve()
    }

    public async sendRequest(request: object): Promise<object> {
        const { controller, action, argument, id } = this._parseRequest(request)
        const route = this._routes.get(controller)?.get(action)
        if (route == null) throw new ClientError(`There is not route for "${controller}"::"${action}"`, { code: ERR_REST_CANNOT_ROUTE_REQUEST })

        let path = route.route
        if (id != null) {
            path = path.replace(/:id/, encodeURIComponent(id))
        }

        const baseUrl = "window" in globalThis ? new URL(this._root + "/", globalThis.window.location.href) : new URL(this._root + "/")
        const url = new URL(path, baseUrl)
        const options: RequestInit = {
            method: route.method
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

        const response = await fetch(url, options)
        const responseData = await response.text()
        if (response.status != 200) {
            const error = Optional.pcall(() => _Error_t.deserialize(JSON.parse(responseData))).tryUnwrap()
            if (error == null) {
                throw new ClientError("Server returned malformed error response", { code: ERR_SERVER_ERROR })
            }
            throw new ClientError(error.message, { code: error.code })
        }

        const responseValue = JSON.parse(responseData)
        return responseValue
    }

    protected _parseRequest(request: object): { controller: string, action: string | null, argument: any, id: string | null } {
        if ("kind" in request) {
            if (request.kind == "call") {
                const call = RpcMessage.ToServer.Call.deserialize(request)
                return { controller: call.type, action: call.action, argument: call.argument, id: call.id ?? null }
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
    }
}

export namespace RestTransportClient {
    export interface Options extends RestTransport.Options { }
}
