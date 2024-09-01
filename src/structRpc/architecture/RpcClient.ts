import { EventListener } from "../../events/EventListener"
import { MessageTransport } from "../../foundation/messaging/MessageTransport"
import { ServiceFactory, ServiceKind } from "../../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../../serviceProvider/ServiceProvider"
import { DeferredSerializationValue } from "../../struct/DeferredSerializationValue"
import { Api } from "../api/Api"
import { ApiConsistencyError } from "../errors"
import { RpcMessage } from "./RpcMessage"

export class RpcClient extends EventListener {
    protected readonly _transport = this._services.get(MessageTransport.kind)
    protected readonly _boundProxies = new Map<number, Api.Proxy>()

    public getEmptyProxy<T extends typeof Api.Proxy>(type: T, id: string | null = null) {
        return new type(this, id) as InstanceType<T>
    }

    public async getProxy<T extends typeof Api.Proxy>(type: T, id: string | null = null) {
        const instance = new type(this, id) as InstanceType<T>
        await instance.sync()
        return instance
    }

    public async getBoundProxy<T extends typeof Api.Proxy>(type: T, id: string | null = null) {
        const instance = new type(this, id) as InstanceType<T>
        await instance.bind()
        return instance
    }

    protected _call(type: string, id: string | null, bindingId: number | null, action: string, argument: DeferredSerializationValue) {
        if (bindingId == null) {
            return this._sendRequest(new RpcMessage.ToServer.Call({
                kind: "call",
                action, argument, id, type
            }))
        } else {
            return this._sendRequest(new RpcMessage.ToServer.CallBound({
                kind: "callBound",
                action, argument, bindingId
            }))
        }
    }

    protected async _bind(instance: Api.Proxy, type: string, id: string | null) {
        const result = await this._sendRequest(new RpcMessage.ToServer.Bind({
            kind: "bind",
            type, id
        }))

        this._boundProxies.set(result.bindingId, instance)

        return result
    }

    protected _unbind(bindingId: number) {
        if (!this._boundProxies.delete(bindingId)) throw new ApiConsistencyError("Call to RpcClient._unbind with an invalid bindingId")

        return this._sendRequest(new RpcMessage.ToServer.Unbind({
            kind: "unbind",
            bindingId
        }))
    }

    protected _sync(type: string, id: string | null) {
        return this._sendRequest(new RpcMessage.ToServer.Get({
            kind: "get",
            type, id
        }))
    }

    protected async _sendRequest<T extends RpcMessage.ToServer>(request: T): Promise<T["kind"] extends "bind" ? RpcMessage.ToClient.Binding : RpcMessage.ToClient.Result> {
        const response = await this._transport.sendRequest(request.serialize())
        if (request.kind == "bind") {
            return RpcMessage.ToClient.Binding.deserialize(response) as any
        } else {
            return RpcMessage.ToClient.Result.deserialize(response) as any
        }
    }

    protected constructor(
        protected readonly _services: ServiceProvider
    ) {
        super()
        this._transport.onNotification.add(this, (messageData) => {
            const message = RpcMessage.ToClient_t.deserialize(messageData)
            const affectedProxies: Api.Proxy[] = []

            for (const id of message.bindings) {
                const proxy = this._boundProxies.get(id)
                if (proxy == null) throw new ApiConsistencyError(`Received ${message.kind} message referencing an invalid binding id ${id}`)
                affectedProxies.push(proxy)
            }

            if (message.kind == "event") {
                for (const proxy of affectedProxies) {
                    proxy["_handleEvent"](message)
                }
            } else if (message.kind == "notify") {
                for (const proxy of affectedProxies) {
                    proxy["_handleNotification"](message)
                }
            }
        })
    }

    public static readonly kind = new ServiceKind<RpcClient>("RpcClient")

    public static init(services: ServiceProvider) {
        return new RpcClient(services)
    }
}

RpcClient satisfies ServiceFactory<RpcClient> 
