import { convertCase } from "../comTypes/util"
import { MessageTransport } from "../foundation/messaging/MessageTransport"
import { ServiceKind } from "../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../serviceProvider/ServiceProvider"
import { Type } from "../struct/Type"
import { Api } from "../structRpc/api/Api"

export class RestResourceNameAttribute {
    constructor(
        public readonly name: string
    ) { }
}

function _getResourceName(type: Type<any>) {
    const controllerName = type.name
    let resource = convertCase(controllerName, "pascal", "kebab")

    const nameAttribute = type.getMetadata().get(RestResourceNameAttribute)
    if (nameAttribute) {
        resource = nameAttribute.name
    }

    if (resource.endsWith("-manager")) {
        resource = resource.slice(0, -8)
    }

    return resource
}

export abstract class RestTransport extends MessageTransport {
    protected readonly _controllers = new Set<RestTransport.EndpointDefinition>()
    protected readonly _root: string

    public registerController(controller: RestTransport.EndpointDefinition) {
        this._controllers.add(controller)
    }

    protected *_buildRoutes(): Generator<RestTransport.RouteDefinition, void, void> {
        for (const controller of this._controllers) {
            const api = controller.api
            const modelType = api.model.baseType as Type.ObjectType
            let resource = _getResourceName(modelType)

            const isSingleton = !("id" in modelType.props)

            yield {
                method: "get", controller, action: null,
                params: isSingleton ? [] : ["id"],
                route: isSingleton ? `${this._root}/${resource}` : `${this._root}/${resource}/:id`
            }

            for (const action of api.actions) {
                let verb = convertCase(action.name, "camel", "kebab")
                let method: "get" | "post" | "delete" | "put" = "post"

                if (verb.startsWith("set-")) {
                    method = "put"
                    verb = verb.slice(4)
                }

                if (verb.startsWith("create-")) {
                    method = "post"
                    if (_getResourceName(action.result) == resource) {
                        verb = ""
                    } else {
                        verb = verb.slice(7)
                    }
                }

                const params: string[] = []

                let route: string
                if (isSingleton) {
                    route = `${this._root}/${resource}/${verb}`
                } else {
                    params.push("id")
                    route = `${this._root}/${resource}/:id/${verb}`
                }

                if (route.endsWith("/")) {
                    route = route.slice(0, -1)
                }

                yield { method, controller, action, params, route }
            }
        }
    }

    constructor(
        public readonly services: ServiceProvider,
        options?: RestTransport.Options
    ) {
        super()

        this._root = options?.root ?? "/api"
        if (!this._root.startsWith("/")) {
            this._root = "/" + this._root
        }
        if (this._root.endsWith("/")) {
            this._root = this._root.slice(0, -1)
        }

        if (options?.controllers) {
            for (const controller of options.controllers) {
                this.registerController(controller)
            }
        }

        services.provideService(MessageTransport.kind, this)
    }

    public static readonly kind = new ServiceKind<RestTransport>("RestTransport", [MessageTransport.kind])
}

export namespace RestTransport {
    export type EndpointDefinition = typeof Api.Controller | typeof Api.Proxy

    export interface RouteDefinition {
        method: "get" | "post" | "delete" | "put"
        controller: EndpointDefinition
        action: Api.ActionType<Type<any>, Type<any>> | null
        params: string[]
        route: string
    }

    export interface Options {
        /** Endpoints where APIs are going to be. @default "/api" */
        root?: string
        /** Controllers to register with the API. */
        controllers?: EndpointDefinition[]
    }
}
