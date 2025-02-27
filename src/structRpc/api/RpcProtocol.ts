import { DeferredSerializationValue } from "../../struct/DeferredSerializationValue"
import { RpcMessage } from "../architecture/RpcMessage"
import { Api } from "./Api"
import { Handle } from "./Handle"

export interface RpcProtocol {
    initBinding(instance: Handle, type: string, id: string | null): Promise<RpcMessage.ToClient.Binding>
    removeBinding(bindingId: number): Promise<void>
    syncHandle(type: string, id: string | null): Promise<RpcMessage.ToClient.Result>
    performCall(type: string, id: string | null, bindingId: number | null, action: string, argument: DeferredSerializationValue, options?: Api.CallOptions): Promise<RpcMessage.ToClient.Result>
    createHandleDirectly(type: new (...args: any[]) => Handle, result: any, bindingId: number): Handle
}
