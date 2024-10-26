import { iPairs } from "../../comTypes/util"
import { RpcClient } from "../architecture/RpcClient"
import { ApiConsistencyError } from "../errors"
import { Api } from "./Api"

export class BindResultAttribute { }

export function bindRpcResult(data: any, client: RpcClient, proxyType: typeof Api.Proxy, bindingIDs: number[]) {
    const bindingCount = bindingIDs.length
    if (data == null) {
        if (bindingCount != 0) throw new ApiConsistencyError(`RPC call returned null, but has ${bindingCount} binding IDs (0 expected)`)
        return null
    } else if (proxyType.verifyModel(data)) {
        if (bindingCount != 1) throw new ApiConsistencyError(`RPC call returned an object instance, but has ${bindingCount} binding IDs (1 expected)`)
        return client["_createProxyFromResult"](proxyType, data, bindingIDs[0])
    } else if (data instanceof Array) {
        const expectedLength = data.length
        if (bindingCount != expectedLength) throw new ApiConsistencyError(`RPC call returned an array of length ${expectedLength}, but has ${bindingCount} binding IDs`)

        return data.map((element, index) => proxyType.verifyModel(element) ? client["_createProxyFromResult"](proxyType, element, bindingIDs[index]) : element)
    } else if (data instanceof Map) {
        const expectedLength = data.size
        if (bindingCount != expectedLength) throw new ApiConsistencyError(`RPC call returned a map of size ${expectedLength}, but has ${bindingCount} binding IDs`)

        const resultMap = new Map()

        for (const [[key, element], index] of iPairs(data as Map<string, any>)) {
            resultMap.set(key, proxyType.verifyModel(element) ? client["_createProxyFromResult"](proxyType, element, bindingIDs[index]) : element)
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
