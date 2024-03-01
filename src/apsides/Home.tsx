import { mdiAccessPoint, mdiAlert, mdiButtonPointer, mdiCodeJson, mdiFormTextbox } from "@mdi/js"
import { defineComponent } from "vue"
import { RouteLocationRaw } from "vue-router"
import logo from "../../logo.png?url"
import { Button } from "../vue3gui/Button"
import { Icon } from "../vue3gui/Icon"

interface _Package {
    icon: string
    label: string
    route: RouteLocationRaw
}

export const Home = (defineComponent({
    name: "Home",
    setup(props, ctx) {
        const packages: _Package[] = [
            { label: "UI Components", icon: mdiButtonPointer, route: { name: "Form" } },
            { label: "Form Builder", icon: mdiFormTextbox, route: { name: "Form" } },
            { label: "Struct", icon: mdiCodeJson, route: { name: "Form" } },
            { label: "RPC", icon: mdiAccessPoint, route: { name: "Form" } }
        ]

        return () => (
            <div class="as-page pb-4 pt-4">
                <div class="flex row gap-7">
                    <img src={logo} class="w-300" />
                    <div>
                        <h1 class="mt-7">Apsides</h1>
                        <p>Full&#8209;stack TypeScript framework, including an ORM, UI component library, form builder and a type&#8209;safe RPC system.</p>
                        <div class="border border-danger rounded p-1">
                            <Icon icon={mdiAlert} class="text-danger" /> Work in progress
                        </div>
                    </div>
                </div>

                <h2>Packages:</h2>
                <div class="w-fill">
                    {packages.map(pkg => (
                        <Button clear class="border rounded center inline-flex row m-1 h-50" style="width: calc(100% / 3 - var(--size-int) * 2)" to={pkg.route}>
                            <h2 class="m-0"><Icon icon={pkg.icon} /> {pkg.label}</h2>
                        </Button>
                    ))}
                </div>

            </div>
        )
    }
}))
