import { iPairs } from "../../comTypes/util"
import { ApiConsistencyError } from "../errors"
import { Api } from "./Api"
import { Handle } from "./Handle"
import { RpcProtocol } from "./RpcProtocol"

export class BindResultAttribute { }

function _verifyModel(value: unknown): boolean {
    return typeof value == "object" && value != null && value instanceof Handle
}

export function bindRpcResult(data: any, protocol: RpcProtocol, bindingIDs: number[]) {
    const bindingCount = bindingIDs.length
    if (data == null) {
        if (bindingCount != 0) throw new ApiConsistencyError(`RPC call returned null, but has ${bindingCount} binding IDs (0 expected)`)
        return null
    } else if (_verifyModel(data)) {
        if (bindingCount != 1) throw new ApiConsistencyError(`RPC call returned an object instance, but has ${bindingCount} binding IDs (1 expected)`)
        return protocol.createHandleDirectly(data.constructor, data, bindingIDs[0])
    } else if (data instanceof Array) {
        const expectedLength = data.length
        if (bindingCount != expectedLength) throw new ApiConsistencyError(`RPC call returned an array of length ${expectedLength}, but has ${bindingCount} binding IDs`)

        return data.map((element, index) => _verifyModel(element) ? protocol.createHandleDirectly(element.constructor, element, bindingIDs[index]) : element)
    } else if (data instanceof Map) {
        const expectedLength = data.size
        if (bindingCount != expectedLength) throw new ApiConsistencyError(`RPC call returned a map of size ${expectedLength}, but has ${bindingCount} binding IDs`)

        const resultMap = new Map()

        for (const [[key, element], index] of iPairs(data as Map<string, any>)) {
            resultMap.set(key, _verifyModel(element) ? protocol.createHandleDirectly(element.constructor, element, bindingIDs[index]) : element)
        }
    } else {
        if (bindingCount != 0) throw new ApiConsistencyError(`RPC call returned an object that does not support bindings, but has ${bindingCount} binding IDs (0 expected)`)
    }
}

export function getRpcResultBindingIDs(result: any, callback: (value: Api.Controller) => number): number[] {
    if (result == null) {
        return []
    } else if (Api.isController(result)) {
        return [callback(result)]
    } else if (result instanceof Array || result instanceof Map) {
        return [...result.values()].map(v => Api.isController(v) ? callback(v) : 0)
    } else {
        return []
    }
}
