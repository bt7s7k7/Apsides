import { mdiCircleOutline, mdiCog, mdiDelete, mdiFileOutline, mdiPlus } from "@mdi/js"
import { defineComponent, ref } from "vue"
import { Button } from "../vue3gui/Button"
import { Circle } from "../vue3gui/Circle"
import { useDynamicsEmitter } from "../vue3gui/DynamicsEmitter"
import { Icon } from "../vue3gui/Icon"
import { LoadingIndicator } from "../vue3gui/LoadingIndicator"
import { MenuItem } from "../vue3gui/MenuItem"
import { ProgressBar } from "../vue3gui/ProgressBar"
import { Slider } from "../vue3gui/Slider"
import { TextField } from "../vue3gui/TextField"
import { UploadOverlay } from "../vue3gui/UploadOverlay"
import { grid } from "../vue3gui/grid"
import { useEventListener } from "../vue3gui/util"
import { Variant } from "../vue3gui/variants"

function buttons() {
    return defineComponent({
        name: "Buttons",
        render: () => <div class="flex column gap-4">
            <div class="flex flex-wrap row gap-2">
                {Variant.LIST.map(v => (
                    <Button variant={v} label={v} />
                ))}
            </div>
            <div class="flex flex-wrap row gap-2">
                <Button clear label="clear" />
                <Button clear class="border" label="border" />
                <Button textual label="textual" />
                <Button disabled label="disabled" />
                <Button plain label="plain" />
                <Button small label="small" />
                <Button icon={mdiCog} label="icon" />
            </div>
        </div>
    })
}

function menu() {
    return defineComponent({
        name: "Menu",
        render: () => <div class="flex row flex-wrap start-cross gap-4">
            <MenuItem label="Default">
                <MenuItem icon={mdiPlus} label="Add" />
                <MenuItem icon={mdiDelete} label="Delete" />
            </MenuItem>
            <MenuItem label="Context Menu" noKebab>
                <MenuItem icon={mdiPlus} label="Add" />
                <MenuItem icon={mdiDelete} label="Delete" />
            </MenuItem>
            <MenuItem label="Elevated" noKebab>
                <MenuItem icon={mdiPlus} label="Add" elevated />
                <MenuItem icon={mdiDelete} label="Delete" />
            </MenuItem>
            <MenuItem label="Nested" defaultAction>
                <MenuItem icon={mdiPlus} label="Add" />
                <MenuItem icon={mdiDelete} label="Delete" />
                <MenuItem defaultAction label="Options">
                    <MenuItem label="Option 1" />
                    <MenuItem label="Option 2" />
                    <MenuItem label="Option 3" />
                </MenuItem>
            </MenuItem>
        </div>
    })
}

function field() {
    return defineComponent({
        name: "Field",
        render: () => <div class="gap-2" style={grid().columns("150px", "1fr").$}>
            <div>Default</div> <TextField />
            <div>Plain</div> <TextField plain />
            <div>Explicit</div> <TextField explicit modelValue="Value" />
            <div>Placeholder</div> <TextField placeholder="Enter text..." />
            <div>Number</div> <TextField type="number" modelValue="0" />
            <div>Password</div> <TextField type="password" modelValue="secret" />
            <div>Native validation</div> <TextField type="email" validate modelValue="user@example.com" />
            <div>Custom validation</div> <TextField validate pattern="^(?!error).*$" placeholder="^(?!error).*$" />
        </div>
    })
}

function progress() {
    return defineComponent({
        name: "Progress",
        setup(props, ctx) {
            const value = ref(0)
            useEventListener("interval", 500, () => (
                value.value = (value.value + 0.2) % 1.2
            ))

            return () => <div>
                <p>
                    <b>With progress value</b>
                </p>
                <div class="flex row gap-2 center-cross large">
                    <ProgressBar progress={value.value} />
                    <Circle inline progress={value.value} />
                </div>
                <div class="flex row gap-2 center-cross large">
                    <ProgressBar filler progress={value.value} />
                    <Circle filler inline progress={value.value} />
                </div>
                <div class="flex row gap-2 center-cross large">
                    <ProgressBar filler transition progress={value.value} />
                    <Circle filler inline transition progress={value.value} />
                </div>
                <p>
                    <b>Indeterminate</b>
                </p>
                <div class="flex row gap-2 center-cross large">
                    <Circle filler inline indeterminate progress={value.value} />
                    <LoadingIndicator inline />
                </div>
            </div>
        },
    })
}

function input() {
    return defineComponent({
        name: "Input",
        setup(props, ctx) {
            const file = ref(null)
            const value = ref(0)

            return () => <div class="flex-fill flex column">
                <p>
                    <b>Slider</b>
                </p>
                <div class="gap-2" style={grid().columns("150px", "1fr").$}>
                    <div>Default</div> <Slider vModel={value.value} />
                    <div>Stepped</div> <Slider stepped vModel={value.value} />
                </div>
                <UploadOverlay
                    class="w-fill h-100 border rounded p-2 mt-2 flex column gap-2"
                    onDrop={v => file.value = v[0]}
                >
                    <b>Upload overlay</b>
                    Drag and drop a file over this element.
                    {file.value && (
                        <div>
                            <Icon icon={mdiFileOutline} /> {file.value.name}
                        </div>
                    )}
                </UploadOverlay>
            </div>
        },
    })
}

function typography() {
    return defineComponent({
        name: "Typo",
        render: () => <div class="flex column gap-4">
            <div>
                <div class="flex flex-wrap row gap-2">
                    {Variant.LIST.map(v => (
                        <div class={`text-${v}`}>{v}</div>
                    ))}
                </div>
            </div>
            <div class="flex flex-wrap row gap-2">
                <div class="small">Small</div>
                <div>Default</div>
                <div class="large">Large</div>
                <div class="largest">Largest</div>
                <div class="muted">Muted</div>
                <div class="monospace">Monospace</div>
            </div>
            <div>
                <div class="text-left">Text Left</div>
                <div class="text-center">Text Center</div>
                <div class="text-right">Text Right</div>
            </div>
        </div>
    })
}

function wrap() {
    return defineComponent({
        name: "Wrap",
        render: () => <div class="flex column gap-2">
            <div class="flex row gap-2">
                <div class="w-100 border rounded p-1">
                    Using default rules
                </div>
                <div class="w-100 border rounded p-1 overflow-ellipsis nowrap">
                    Ellipsis overflow
                </div>
                <div class="w-100 border rounded p-1 overflow-hidden nowrap">
                    Hidden overflow
                </div>
                <div class="w-100 border rounded p-1 overflow-auto nowrap">
                    Auto overflow
                </div>
                <div class="w-100 border rounded p-1 scroll nowrap">
                    Always scroll
                </div>
            </div>
            <div class="w-100 border rounded p-1 nowrap">
                Using nowrap class
            </div>
            <div class="flex row gap-2">
                <div class="w-100 border rounded p-1 pre-wrap">
                    Using pre-wrap Class
                </div>
                <div class="w-100 border rounded p-1 pre-line">
                    Using pre-line Class
                </div>
                <div class="w-100 border rounded p-1 pre">
                    Using   pre Class
                </div>
            </div>
        </div>
    })
}

function size() {
    return defineComponent({
        name: "Size",
        setup(props, ctx) {
            const value = ref(1)

            return () => (
                <div class="flex column gap-4">
                    <div>
                        <div class="gap-2" style={grid().columns("150px", "1fr").$}>
                            <div>Margin</div> <div class={`w-5 h-5 border ml-${value.value}`}></div>
                            <div>Padding</div> <div class={`border pl-${value.value}`}> <Icon icon={mdiCircleOutline} /> </div>
                            <div>Size</div> <div class={`border w-${value.value}`}></div>
                        </div>
                        <Slider vModel={value.value} min={1} max={7} stepped step={1} />
                    </div>
                </div>
            )
        }
    })
}

function blocks() {
    return defineComponent({
        name: "Blocks",
        render: () => <div class="flex column gap-4">
            <div class="flex flex-wrap row gap-2">
                {Variant.LIST.map(v => (
                    <div class={`p-1 text-${v}`}>{v}</div>
                ))}
            </div>
            <div class="flex flex-wrap row gap-2">
                {Variant.LIST.map(v => (
                    <div class={`p-1 bg-${v}`}>{v}</div>
                ))}
            </div>
            <div class="flex flex-wrap row gap-1">
                {Variant.LIST.map(v => (
                    <div class={`p-1 border border-${v}`}>{v}</div>
                ))}
            </div>
            <div class="flex flex-wrap row gap-2">
                <div class="p-1 shadow rounded">Shadow</div>
                <div class="p-1 border rounded">Rounded</div>
                <div class="p-1 border circle">Circle</div>
                <div class="p-1 bg-primary-transparent">Transparent</div>
                <div class="p-1 bg-primary muted">Muted</div>
                <div class="p-1 bg-primary-translucent">Translucent</div>
            </div>
        </div>
    })
}

function emitter() {
    return defineComponent({
        name: "Emitter",
        setup(props, ctx) {
            const emitter = useDynamicsEmitter()

            function modal() {
                emitter.modal(() => "Hello", {
                    props: { cancelButton: true }
                })
            }

            function confirm() {
                emitter.confirm(() => "Confirm?")
            }

            function prompt() {
                emitter.prompt(() => "Enter Text")
            }

            function menu(event) {
                emitter.menu(event.target, () => "Hello", {
                    props: {
                        backdropCancels: true,
                        class: "shadow"
                    }
                })
            }

            return () => <>
                <div class="flex row gap-2">
                    <Button label="Modal" onClick={modal} />
                    <Button label="Confirm" onClick={confirm} />
                    <Button label="Prompt" onClick={prompt} />
                    <Button label="Menu" onClick={menu} />
                </div>
            </>
        }
    })
}
