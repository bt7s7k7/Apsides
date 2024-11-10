import { defineComponent } from "vue"
import { RouterLink } from "vue-router"
import logo from "../../logo.png?url"

export const Header = (defineComponent({
    name: "Header",
    setup(props, ctx) {
        return () => (
            <header class="flex row gap-2 mt-2">
                <RouterLink class="as-reset flex row gap-2 mt-2" to={{ name: "Home" }}>
                    <img class="h-50" src={logo} />
                    <h1 class="m-0">Apsides</h1>
                </RouterLink>
            </header>
        )
    },
}))
