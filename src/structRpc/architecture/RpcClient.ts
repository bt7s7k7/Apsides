import { EventListener } from "../../events/EventListener"
import { MessageTransport } from "../../foundation/messaging/MessageTransport"
import { ServiceFactory, ServiceKind } from "../../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../../serviceProvider/ServiceProvider"
import { DeferredSerializationValue } from "../../struct/DeferredSerializationValue"
import { Api } from "../api/Api"
import { Handle } from "../api/Handle"
import { RpcProtocol } from "../api/RpcProtocol"
import { ApiConsistencyError } from "../errors"
import { RpcMessage } from "./RpcMessage"

export class RpcClient extends EventListener implements RpcProtocol {
    protected readonly _transport = this._services.get(MessageTransport.kind)
    protected readonly _boundHandles = new Map<number, Handle>()

    public getEmptyHandle<T extends new (...args: any[]) => Handle>(type: T, id: string | null = null) {
        const handle = new (type as never as new () => Handle)() as InstanceType<T>
        if (id != null) (handle as { id: string }).id = id
        handle.connect(this)
        return handle
    }

    public async getHandle<T extends new (...args: any[]) => Handle>(type: T, id: string | null = null) {
        const handle = new (type as never as new () => Handle)() as InstanceType<T>
        if (id != null) (handle as { id: string }).id = id
        await handle.connect(this).sync()
        return handle
    }

    public async getBoundHandle<T extends new (...args: any[]) => Handle>(type: T, id: string | null = null) {
        const handle = new (type as never as new () => Handle)() as InstanceType<T>
        if (id != null) (handle as { id: string }).id = id
        await handle.connect(this).bind()
        return handle
    }

    public performCall(type: string, id: string | null, bindingId: number | null, action: string, argument: DeferredSerializationValue, options?: Api.CallOptions) {
        if (bindingId == null) {
            return this._sendRequest(new RpcMessage.ToServer.Call({
                kind: "call",
                action, argument, id, type,
                bindResult: options?.bindResult != null,
            }))
        } else {
            return this._sendRequest(new RpcMessage.ToServer.CallBound({
                kind: "callBound",
                action, argument, bindingId,
                bindResult: options?.bindResult != null,
            }))
        }
    }

    public createHandleDirectly(type: new (...args: any[]) => Handle, result: any, bindingId: number) {
        const instance = new (type as never as new () => Handle)()
        Object.assign(instance, result)

        instance["_bindingId"] = bindingId
        instance["_protocol"] = this

        this._boundHandles.set(bindingId, instance)
        return instance as Handle
    }

    public async initBinding(instance: Handle, type: string, id: string | null) {
        const result = await this._sendRequest(new RpcMessage.ToServer.Bind({
            kind: "bind",
            type, id,
        }))

        this._boundHandles.set(result.bindingId, instance)

        return result
    }

    public async removeBinding(bindingId: number) {
        if (!this._boundHandles.delete(bindingId)) throw new ApiConsistencyError("Call to RpcClient._unbind with an invalid bindingId")

        await this._sendRequest(new RpcMessage.ToServer.Unbind({
            kind: "unbind",
            bindingId,
        }))
    }

    public syncHandle(type: string, id: string | null) {
        return this._sendRequest(new RpcMessage.ToServer.Get({
            kind: "get",
            type, id,
        }))
    }

    protected async _sendRequest<T extends RpcMessage.ToServer>(request: T): Promise<T["kind"] extends "bind" ? RpcMessage.ToClient.Binding : T["kind"] extends "unbind" ? null : RpcMessage.ToClient.Result> {
        const response = await this._transport.sendRequest(request.serialize())
        if (request.kind == "bind") {
            return RpcMessage.ToClient.Binding.deserialize(response) as any
        } else if (request.kind == "unbind") {
            return null as any
        } else {
            return RpcMessage.ToClient.Result.deserialize(response) as any
        }
    }

    protected constructor(
        protected readonly _services: ServiceProvider,
    ) {
        super()
        this._transport.onNotification.add(this, (messageData) => {
            const message = RpcMessage.ToClient_t.deserialize(messageData)
            const affectedHandles: Handle[] = []

            for (const id of message.bindings) {
                const handle = this._boundHandles.get(id)
                if (handle == null) throw new ApiConsistencyError(`Received ${message.kind} message referencing an invalid binding id ${id}`)
                affectedHandles.push(handle)
            }

            if (message.kind == "event") {
                for (const handle of affectedHandles) {
                    handle["_handleEvent"](message)
                }
            } else if (message.kind == "notify") {
                for (const handle of affectedHandles) {
                    handle["_handleNotification"](message)
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
