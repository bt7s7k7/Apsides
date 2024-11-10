import { computed, defineComponent, PropType } from "vue"
import { RouteRecordRaw, useRoute } from "vue-router"
import { ServiceFactory, ServiceKind } from "../serviceProvider/ServiceFactory"
import { RouterService } from "./RouterService"

export function createRoute<T extends RouteRecordRaw & { name: string, parent?: ServiceFactory<RouteRecordRaw & { name: string }> }>(route: T): ServiceFactory<T> & T {
    return {
        ...route,
        kind: new ServiceKind("route:" + route.name),
        init(services) {
            const router = services.get(RouterService.kind)

            if (this.parent) {
                const parent = services.get(this.parent.kind)
                parent.children ??= []
                parent.children.push(this)
            } else {
                router.addRoute(this)
            }

            return this as any
        },
    }
}


export const ComponentWithId = (defineComponent({
    name: "ComponentWithId",
    props: {
        component: { type: Object as PropType<any>, required: true },
        param: { type: String, default: () => "id" },
    },
    setup(props, ctx) {
        const route = useRoute()
        const id = computed(() => route.params[props.param] as string)

        return () => (
            <props.component id={id.value} key={id.value} />
        )
    },
}))

export function wrapComponentWithId(component: any, param = "id") {
    return defineComponent({
        name: "wrapComponentWithId",
        setup() {
            return () => <ComponentWithId component={component} param={param} />
        },
    })
}
