import { EventEmitter } from "../../events/EventEmitter"
import { EventListener } from "../../events/EventListener"
import { ClientError } from "../../foundation/messaging/errors"
import { DeferredSerializationValue } from "../../struct/DeferredSerializationValue"
import { Mutation } from "../../struct/Mutation"
import { RpcMessage } from "../architecture/RpcMessage"
import { ApiConsistencyError } from "../errors"
import { Api } from "./Api"
import { bindRpcResult } from "./BindResultAttribute"
import { RpcProtocol } from "./RpcProtocol"

const _ACTIONS_READY = Symbol.for("apsides.rpc.actionsReady")

export abstract class Handle extends EventListener {
    public get api() { return (this.constructor as any).api as Api }

    protected _bindingId: number | null = null
    protected _protocol: RpcProtocol | null = null
    public get protocol() { return this._protocol }
    protected get _handleId() { return "id" in this ? this.id as string | null : null }
    protected get _modelType() { return this.api.modelType }
    protected get _typeName() { return this._modelType.name }
    protected get _eventsLookup() { return this.api.eventsLookup }

    /** Connects a handle to the provided protocol. All handle operations will be performed through it. Throws if a protocol is already connected. */
    public connect(protocol: RpcProtocol) {
        if (this._protocol != null) {
            throw new ApiConsistencyError("Cannot use connect on a already connected")
        }
        this._protocol = protocol

        return this
    }

    /** Disconnects a handle from its protocol. Throws if no protocol is connected or if the handle is currently bound. */
    public disconnect() {
        if (this._protocol == null) throw new ApiConsistencyError("No protocol connected")
        if (this._bindingId != null) throw new ApiConsistencyError("Cannot disconnect a bound handle")
        this._protocol = null
    }

    /** Fetches remote state and subscribes to events and updates this instance on mutations */
    public async bind(): Promise<void> {
        if (this._bindingId != null) throw new ApiConsistencyError("Cannot call .bind on an already bound handle")
        if (this._protocol == null) throw new ApiConsistencyError("A protocol is required to bind")
        const result = await this._protocol.initBinding(this, this._typeName, this._handleId)
        const remoteValue = result.value.getValue(this._modelType)
        const bindingId = result.bindingId
        const protocol = this._protocol
        Object.assign(this, remoteValue)
        this._bindingId = bindingId
        this._protocol = protocol
    }

    /** Fetches remote state */
    public async sync(): Promise<void> {
        if (this._protocol == null) throw new ApiConsistencyError("A protocol is required to sync")
        const result = await this._protocol.syncHandle(this._typeName, this._handleId)
        const remoteValue = result.value.getValue(this._modelType)
        const protocol = this._protocol
        const bindingId = this._bindingId
        Object.assign(this, remoteValue)
        this._bindingId = bindingId
        this._protocol = protocol
    }

    /** Unsubscribes from events and notifications of mutations */
    public async unbind(): Promise<void> {
        if (this._bindingId == null) throw new ApiConsistencyError("Cannot call .unbind on an unbound handle")
        if (this._protocol == null) throw new ApiConsistencyError("A protocol is null on a bound handle")
        const bindingId = this._bindingId
        this._bindingId = null
        await this._protocol.removeBinding(bindingId)
    }

    public async unbindAndDisconnect() {
        await this.unbind()
        this.disconnect()
    }

    protected _handleEvent(event: RpcMessage.ToClient.Event) {
        const eventName = event.event
        const eventType = this._eventsLookup.get(eventName)
        if (eventType == null) throw new ClientError(`Called Handle._handleEvent with invalid event ${JSON.stringify(eventName)}`)
        const eventValue = event.value.getValue(eventType);
        ((this as any)[eventName] as EventEmitter<any>).emit(eventValue)
    }

    protected _handleNotification(event: RpcMessage.ToClient.Notify) {
        const mutations = event.mutations
        for (const mutation of mutations) {
            Mutation.apply(this, this._modelType, mutation)
        }
    }

    public override[Symbol.dispose](): void {
        this.unbindAndDisconnect()
        super[Symbol.dispose]()
    }

    constructor() {
        super()

        const ctor = this.constructor as any
        if (!(_ACTIONS_READY in ctor)) {
            ctor[_ACTIONS_READY] = true
            const api = (ctor as any).api as Api
            const proto = Object.getPrototypeOf(ctor.prototype)
            for (const action of api["_actions"]) {
                proto[action.name] = async function (this: Handle, argument: any, options?: Api.CallOptions) {
                    if (this._protocol == null) throw new ApiConsistencyError("Cannot perform a call on an unconnected handle")
                    const argumentData = DeferredSerializationValue.prepareSerialization(argument, action.param)
                    const resultData = await this._protocol.performCall(this._typeName, this._handleId, this._bindingId, action.name, argumentData, options)
                    const result = resultData.value.getValue(action.result)

                    if (options?.bindResult) {
                        if (resultData.bindingIds == null) {
                            throw new ApiConsistencyError(`Call to ${this._typeName}.${action.name} had bindResult enabled but the server did not return bindingIDs`)
                        }

                        return bindRpcResult(result, this._protocol, resultData.bindingIds)
                    }

                    return result
                }
            }
        }

        for (const event of this.api.events) {
            (this as any)[event.name] = new EventEmitter()
        }

        if (Api.handleWrapper) {
            return Api.handleWrapper(this) as this
        }
    }

    declare public static readonly api: Api
}
