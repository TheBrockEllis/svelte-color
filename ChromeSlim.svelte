<svelte:options accessors={true} />

<style>
    .color-picker {
        display: flex;
        flex-direction: column;
        width: 14.5em;
        box-shadow: 0 0 2px rgba(0, 0, 0, .3), 0 4px 8px rgba(0, 0, 0, .3);
        background: #fff;
        padding: 10px;
        justify-content: center;
        align-items: space-between;
    }

    .color-picker :global(.saturation-value) {
        height: 9em;
        /* 14.5 / 1.618 */
    }

    .square-and-input {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: center;
    }

    .square-wrap {
        width: 2em;
        height: 2em;
        border-radius: 1.5em;
        margin: auto 0.75em auto 0;
        flex: none;
        overflow: hidden;
        cursor: pointer;
    }

    .sliders {
        display: flex;
        flex-direction: column;
        flex: 1;
        margin-top: 15px;
    }

    .alpha-wrap {
        margin-top: 0.75em;
    }

    .inputs-and-changer {
        display: flex;
        flex-direction: row;
        padding: 1em 0.5em;
    }

    .changer-wrap {
        box-sizing: border-box;
        width: 2em;
        flex: none;
        margin: auto;
        padding-left: 0.5em;
    }

    .changer-up,
    .changer-down {
        margin: auto;
        cursor: pointer;
    }

    .changer-up {
        width: 0;
        height: 0;
        border-left: 0.5em solid transparent;
        border-right: 0.5em solid transparent;
        border-bottom: 0.5em solid #666;
    }

    .changer-down {
        width: 0;
        height: 0;
        border-left: 0.5em solid transparent;
        border-right: 0.5em solid transparent;
        border-top: 0.5em solid #666;
        margin-top: 0.5em;
    }

    .inputs-wrap {
        flex: 1;
    }

    input {
        text-align: center;
        outline: 0;
        box-shadow: none;
        font-family: inherit;
        font-size: 0.7em;
        display: block;
        width: auto;
        border: #ddd 1px solid;
        border-radius: 0.1em;
        padding: 0.25em 0;
    }

    .hex {
        width: 100%;
        margin: auto;
    }

    .rgba-wrap,
    .hsla-wrap {
        display: flex;
    }

    .rgba-wrap>div:not(:first-child),
    .hsla-wrap>div:not(:first-child) {
        margin-left: 0.5em;
    }

    .rgba-wrap input,
    .hsla-wrap input {
        width: 100%;
    }

    .percent-input {
        position: relative;
    }

    .percent-input:after {
        content: "%";
        display: block;
        position: absolute;
        top: 50%;
        transform: translate(-50%);
        right: 0.25em;
    }

    label {
        display: block;
        text-transform: uppercase;
        text-align: center;
        margin-top: 0.5em;
        font-size: 0.8em;
        color: #666;
    }

    .extras {
        overflow: hidden;
        height: 0;
        margin-bottom: 0;
        transition: height 500ms, margin 500ms;
    }

    .extras.visible {
        margin-bottom: 10px;
        height: 10.5em;
        transition: height 500ms;
    }
</style>

<script>
  import {createEventDispatcher} from "svelte";
  const dispatch = createEventDispatcher();
  // input

  import tinycolor from "tinycolor2";
  import {getValidColor} from "./utils.js"

  import SaturationValue from "./SaturationValue.svelte";
  import Alpha from "./Alpha.svelte"
  import Hue from "./Hue.svelte";
  import ColorSquare from "./ColorSquare.svelte";

  // RED
  export let h = 0;
  export let s = 1;
  export let v = 1;
  export let l = 0.5;
  export let r = 255;
  export let g = 0;
  export let b = 0;
  export let hex = "#ff0000";
  export let a = 1;

  export let color;
  $: color = {r, g, b, h, s, l, v, a, hex};

  export let startColor = "#ff0000"; // all tinycolor colors
  export let disableAlpha = false;

  let fieldsIndex = 0;

  export let expanded = false;
  const updateExpanded = () => {
    expanded = !expanded;
  }

  $: displayValue = expanded ? 'visible' : '';

  export const setColor = (args) => update(args, false);

  const update = (args, dispatch=true) => {

    if(args.length < 6) {
      // Too small a string to trigger an update
      return;
    }

    // is not enough with color.isValidColor
    const color = getValidColor(args);

    if(!color) return;

    const format = color.getFormat();
    // we dont use hex8
    (format === "hex" || format === "hex8") && color.setAlpha(a);

    const _rgba = color.toRgb();
    const _hsla = color.toHsl();
    const _hsva = color.toHsv();
    const _hex = `#${color.toHex()}`;

    r = args.r != null ? args.r : _rgba.r;
    g = args.g != null ? args.g : _rgba.g;
    b = args.b != null ? args.b : _rgba.b;
    h = args.h != null ? args.h : _hsla.h;
    s = args.s != null ? args.s : _hsla.s;
    l = args.l != null ? args.l : _hsla.l;
    v = args.v != null ? args.v : _hsva.v;
    a = args.a != null ? args.a : _rgba.a;
    hex = format === "hex" ? args : _hex;

    dispatch && dispatchInput(hex);
  }

  const updateAlpha = (alpha) => {
    if(isNaN(alpha) || alpha < 0 || alpha > 1)
      return;

    a = alpha;
    dispatchInput()
  }

  const dispatchInput = (hex = undefined) => {
    dispatch("input", typeof hex === 'string' ? hex : color.hex);
  }

  const onlyChars = (chars) => (event) => chars.indexOf(String.fromCharCode(event.charCode)) === -1 && event.preventDefault();
  const onlyNumbers = onlyChars("0123456789");
  const onlyNumbersAndDot = onlyChars("0123456789.");

  update(startColor, false);
</script>

<div class="color-picker">

    <div class="extras {displayValue}">
        <div class="saturation-value-wrap">
            <SaturationValue {h} {s} {v} on:inputend={(event)=> update({h, s: event.detail.s, v: event.detail.v, a}, true)}
                on:input={(event) => update({h, s: event.detail.s, v: event.detail.v, a}, false)} />
        </div>

        <div class="sliders">
            <div class="hue-wrap">
                <Hue {h} on:input={event=> update({h: event.detail, s, v, a})} />
            </div>
        </div>
    </div>

    <div class="square-and-input">

        <div on:click={() => updateExpanded()} class="square-wrap">
            <ColorSquare color="rgba({r}, {g}, {b}, {a})" />
        </div>

        <div class="inputs-wrap">
            <div class="input-wrap hex-wrap">
                <input id='hex-input' class="hex" type="text" value={hex} maxlength={7}
                    on:keypress={onlyChars("#0123456789abcdefABCFDEF")} on:input={event=> update(event.target.value)}
                />
            </div>
        </div>

    </div>

    <!-- <div class="inputs-and-changer"> -->
        <!-- <div class="changer-wrap" style='display: none;'>
            <div class="changer-up" on:click={()=> fieldsIndex = (fieldsIndex === 0 ? 2 : (fieldsIndex - 1) % 3)}></div>
            <div class="changer-down" on:click={()=> fieldsIndex = (fieldsIndex + 1) % 3}></div>
        </div> -->
    <!-- </div> -->

</div>