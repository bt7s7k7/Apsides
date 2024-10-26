import { unreachable } from "../comTypes/util"
import { ClientRequest } from "../foundation/messaging/ClientRequest"
import { ClientError, ERR_SERVER_ERROR } from "../foundation/messaging/errors"
import { MessageTransport } from "../foundation/messaging/MessageTransport"
import { HonoServer } from "../honoService/HonoServer"
import { ServiceFactory } from "../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../serviceProvider/ServiceProvider"
import { DeferredSerializationValue } from "../struct/DeferredSerializationValue"
import { DeserializationError, PlainObjectDeserializer } from "../struct/Type"
import { RpcMessage } from "../structRpc/architecture/RpcMessage"
import { RpcSession } from "../structRpc/architecture/RpcSession"
import { ERR_CONTROLLER_NOT_FOUND, ERR_INVALID_ACTION } from "../structRpc/errors"
import { RestTransport } from "./RestTransport"

export class RestTransportServer extends RestTransport {
    public sendNotification(notification: object): Promise<void> {
        return Promise.resolve()
    }

    public sendRequest(request: object): Promise<object> {
        return Promise.reject(new Error("RestTransportServer cannot send requests"))
    }

    public static make(options: RestTransportServer.Options): ServiceFactory<RestTransport> {
        return {
            kind: RestTransport.kind,
            init(services) {
                return new RestTransportServer(services, options)
            },
        }
    }

    constructor(services: ServiceProvider, options?: RestTransportServer.Options) {
        super(services, options)

        const { app } = services.get(HonoServer.kind)

        services.makeTransientLoader()
            .provide(MessageTransport.kind, this)
            .add(RpcSession)
            .load()

        const routes: { value: string, method: string, desc: string }[] | null = options?.documentationPage ? [] : null

        for (const route of this._buildRoutes()) {
            if (routes) {
                routes.push({ value: route.route, method: route.method, desc: route.action == null ? "Returns resource instance" : route.action.desc ?? "No description provided" })
            }
            const isSingleton = !route.params.includes("id")
            const type = route.controller.api.model.baseType.name

            app[route.method](route.route, async c => {
                let id: string | null = null
                if (!isSingleton) {
                    id = c.req.param("id") ?? unreachable()
                }
                try {
                    if (route.action == null) {
                        const request = new ClientRequest(0, new RpcMessage.ToServer.Get({
                            kind: "get",
                            type, id
                        }).serialize())

                        this.onRequest.emit(request)

                        const responseData = await request
                        const response = RpcMessage.ToClient.Result.deserialize(responseData)
                        const value = response.value.getValue(null)

                        return c.json(value)
                    } else {
                        const argumentData = await c.req.json()
                        const argument = DeferredSerializationValue.prepareDeserialization(argumentData, new PlainObjectDeserializer(argumentData))

                        const request = new ClientRequest(0, new RpcMessage.ToServer.Call({
                            kind: "call",
                            type, id, argument,
                            action: route.action.name,
                        }).serialize())

                        this.onRequest.emit(request)

                        const responseData = await request
                        const response = RpcMessage.ToClient.Result.deserialize(responseData)
                        const value = response.value.getValue(null)

                        return c.json(value)
                    }
                } catch (err) {
                    if (err instanceof ClientError) {
                        return c.json({ code: err.code, message: err.message }, (
                            err.code == ERR_CONTROLLER_NOT_FOUND || err.code == ERR_INVALID_ACTION ? 404
                                : err.code == ERR_SERVER_ERROR ? 500
                                    : 400
                        ))
                    }

                    if (err instanceof DeserializationError) {
                        return c.text(err.message, 400)
                    }

                    throw err
                }
            })
        }

        if (options?.documentationPage) {
            const documentationPage = options.documentationPage.replace("$$config", JSON.stringify(JSON.stringify({
                root: this._root,
                routes
            })).slice(1, -1))

            app.get(this._root, c => {
                return c.html(documentationPage)
            })
        }
    }
}

export namespace RestTransportServer {
    export interface Options extends RestTransport.Options {
        /**
         * Provides a documentation page at root route for listing all endpoints and testing the API. Provide the HTML of the page here.
         * You can use the `page.html` file included with this package.
         * @default null
         * */
        documentationPage?: string
    }
}
