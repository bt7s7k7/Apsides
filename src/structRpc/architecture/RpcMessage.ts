import { unreachable } from "../../comTypes/util"
import { DeferredSerializationValue } from "../../struct/DeferredSerializationValue"
import { Mutation_t } from "../../struct/Mutation"
import { Struct } from "../../struct/Struct"
import { Type } from "../../struct/Type"

export namespace RpcMessage {
    export namespace ToServer {
        export class Bind extends Struct.define("RpcMessage.ToServer.Bind", {
            kind: Type.enum("bind"),
            type: Type.string,
            id: Type.string.as(Type.nullable)
        }) { }

        export class Get extends Struct.define("RpcMessage.ToServer.Get", {
            kind: Type.enum("get"),
            type: Type.string,
            id: Type.string.as(Type.nullable)
        }) { }

        export class Unbind extends Struct.define("RpcMessage.ToServer.Get", {
            kind: Type.enum("unbind"),
            bindingId: Type.number
        }) { }

        export class Call extends Struct.define("RpcMessage.ToServer.Call", {
            kind: Type.enum("call"),
            id: Type.string.as(Type.nullable),
            type: Type.string,
            action: Type.string,
            argument: DeferredSerializationValue.ref(),
            bindResult: Type.boolean.as(Type.nullable, { skipNullSerialize: true })
        }) { }

        export class CallBound extends Struct.define("RpcMessage.ToServer.CallBound", {
            kind: Type.enum("callBound"),
            bindingId: Type.number,
            action: Type.string,
            argument: DeferredSerializationValue.ref(),
            bindResult: Type.boolean.as(Type.nullable, { skipNullSerialize: true })
        }) { }
    }

    export type ToServer = ToServer.Bind | ToServer.Get | ToServer.Unbind | ToServer.Call | ToServer.CallBound

    export const ToServer_t = Type.byKeyUnion("RpcMessage.ToServer", "kind", {
        bind: ToServer.Bind.ref(),
        get: ToServer.Get.ref(),
        unbind: ToServer.Unbind.ref(),
        call: ToServer.Call.ref(),
        callBound: ToServer.CallBound.ref(),
    }, () => unreachable() as ToServer)

    export namespace ToClient {
        export class Result extends Struct.define("RpcMessage.ToClient.Result", {
            kind: Type.enum("result"),
            value: DeferredSerializationValue.ref(),
            bindingIds: Type.number.as(Type.array).as(Type.nullable, { skipNullSerialize: true })
        }) { }

        export class Binding extends Struct.define("RpcMessage.ToClient.Binding", {
            kind: Type.enum("binding"),
            value: DeferredSerializationValue.ref(),
            bindingId: Type.number
        }) { }

        export class Event extends Struct.define("RpcMessage.ToClient.Event", {
            kind: Type.enum("event"),
            bindings: Type.number.as(Type.array),
            event: Type.string,
            value: DeferredSerializationValue.ref()
        }) { }

        export class Notify extends Struct.define("RpcMessage.ToClient.Notify", {
            kind: Type.enum("notify"),
            bindings: Type.number.as(Type.array),
            mutations: Mutation_t.base.as(Type.array)
        }) { }
    }

    export type ToClient = ToClient.Event | ToClient.Notify

    export const ToClient_t = Type.byKeyUnion("RpcMessage.ToClient", "kind", {
        event: ToClient.Event.ref(),
        notify: ToClient.Notify.ref(),
    }, () => unreachable() as ToClient)
}
