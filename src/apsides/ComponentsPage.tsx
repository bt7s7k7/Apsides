import { defineComponent } from "vue"
import { ComponentEditor } from "./ComponentEditor"
import { Header } from "./Header"
import snippets from "./componentsSnippets?snippets"

export const ComponentsPage = (defineComponent({
    name: "ComponentsPage",
    setup(props, ctx) {
        return () => (
            <div class="smart-page">
                <Header />
                <h1>UI Components</h1>
                <p>
                    The <b>Core</b> components package provides you with the all the building blocks you need to construct your UI and the CSS classes
                    to customize it to your liking. The look and feel is based on Material Design, for a modern flat look. All styles are based on <code>em</code>
                    units, using integer multiples for constant sizing. Native elements are sparely modified, increasing compatibility with foreign UI components.
                </p>
                <p>
                    This is not a UI framework. Only basic building blocks, such as buttons, input fields and progress bars are included. But with the provided CSS classes
                    and variables, it is not hard to design new components to fit the style. The library also provides many hooks, allowing the interop between Vue reactivity
                    and the DOM.
                </p>
                <h2>Buttons</h2>
                <p>
                    Buttons are the main component offered by this library. They can be customized use multiple colors and styles. As an action they emit an <code>onClick</code> event
                    but can also act as:
                    <ul>
                        <li>HTML <code>a</code> tag with the <code>href</code> prop</li>
                        <li>Vue <code>router-link</code>, with the <code>to</code> prop</li>
                        <li>Form submit button using the <code>submit</code> prop</li>
                    </ul>
                </p>
                <ComponentEditor name="components_buttons" code={snippets.buttons} />
                <p>
                    For more complex menus, you can use the <code>MenuItem</code> component. They are like buttons, but can contain additional actions hidden by a kebab
                    button or context menu.
                </p>
                <ComponentEditor name="components_menu" code={snippets.menu} />

                <h2 class="mt-4">Text Field</h2>
                <p>
                    The text field element allows data binding using <code>v-model</code>. It also emits <code>input</code> and <code>changed</code> events. The value is a string
                    but you can edit a number using the <code>numberModel</code> function. The component can also use the <code>type</code> attribute and validate input. You can
                    also use the <code>explicit</code> property to allow atomic and cancellable edits.
                </p>
                <ComponentEditor name="components_field" code={snippets.field} />

                <h2 class="mt-4">Progress Indicator</h2>
                <p>
                    Multiple types of progress indicators are available, to fit your use case and design language. There are also <code>indeterminate</code> types, when you don't know
                    the exact progress. All <b>animations are driven by CSS</b> for maximum performance.
                </p>
                <ComponentEditor name="components_progress" code={snippets.progress} />

                <h2 class="mt-4">Other Input Components</h2>
                <ComponentEditor name="components_input" code={snippets.input} />

                <h1>Utility classes</h1>
                <p>
                    In addition to finished components, this package also provides many CSS classes to style your custom components.
                </p>
                <h2 class="mt-4">Typography</h2>
                <ComponentEditor name="components_typography" code={snippets.typography} />
                <p>
                    Also provided are classes modifying text wrapping.
                </p>
                <ComponentEditor name="components_wrap" code={snippets.wrap} />

                <h2 class="mt-4">Layout</h2>
                <p>
                    All sizing is base on integer multiples of <code>0.25rem</code>. This allows for consistent layout, responsive to the browser font size.
                </p>
                <ComponentEditor name="components_size" code={snippets.size} />
                <p>
                    Many classes are offered for the visual customization of blocks.
                </p>
                <ComponentEditor name="components_blocks" code={snippets.blocks} />

                <div class="h-500"></div>
            </div>
        )
    }
}))
