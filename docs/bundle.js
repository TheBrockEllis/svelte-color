
(function(l, i, v, e) { v = l.createElement(i); v.async = 1; v.src = '//' + (location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; e = l.getElementsByTagName(i)[0]; e.parentNode.insertBefore(v, e)})(document, 'script');
(function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function prevent_default(fn) {
        return function (event) {
            event.preventDefault();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function stop_propagation(fn) {
        return function (event) {
            event.stopPropagation();
            // @ts-ignore
            return fn.call(this, event);
        };
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function createEventDispatcher() {
        const component = current_component;
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            callbacks.slice().forEach(fn => fn(event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    function flush() {
        const seen_callbacks = new Set();
        do {
            // first, call beforeUpdate functions
            // and update components
            while (dirty_components.length) {
                const component = dirty_components.shift();
                set_current_component(component);
                update(component.$$);
            }
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    callback();
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
    }
    function update($$) {
        if ($$.fragment) {
            $$.update($$.dirty);
            run_all($$.before_update);
            $$.fragment.p($$.dirty, $$.ctx);
            $$.dirty = null;
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    function bind(component, name, callback) {
        if (component.$$.props.indexOf(name) === -1)
            return;
        component.$$.bound[name] = callback;
        callback(component.$$.ctx[name]);
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        if (component.$$.fragment) {
            run_all(component.$$.on_destroy);
            component.$$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            component.$$.on_destroy = component.$$.fragment = null;
            component.$$.ctx = {};
        }
    }
    function make_dirty(component, key) {
        if (!component.$$.dirty) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty = blank_object();
        }
        component.$$.dirty[key] = true;
    }
    function init(component, options, instance, create_fragment, not_equal, prop_names) {
        const parent_component = current_component;
        set_current_component(component);
        const props = options.props || {};
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props: prop_names,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty: null
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, props, (key, ret, value = ret) => {
                if ($$.ctx && not_equal($$.ctx[key], $$.ctx[key] = value)) {
                    if ($$.bound[key])
                        $$.bound[key](value);
                    if (ready)
                        make_dirty(component, key);
                }
                return ret;
            })
            : props;
        $$.update();
        ready = true;
        run_all($$.before_update);
        $$.fragment = create_fragment($$.ctx);
        if (options.target) {
            if (options.hydrate) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.l(children(options.target));
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    let SvelteElement;
    if (typeof HTMLElement !== 'undefined') {
        SvelteElement = class extends HTMLElement {
            constructor() {
                super();
                this.attachShadow({ mode: 'open' });
            }
            connectedCallback() {
                // @ts-ignore todo: improve typings
                for (const key in this.$$.slotted) {
                    // @ts-ignore todo: improve typings
                    this.appendChild(this.$$.slotted[key]);
                }
            }
            attributeChangedCallback(attr, _oldValue, newValue) {
                this[attr] = newValue;
            }
            $destroy() {
                destroy_component(this, 1);
                this.$destroy = noop;
            }
            $on(type, callback) {
                // TODO should this delegate to addEventListener?
                const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
                callbacks.push(callback);
                return () => {
                    const index = callbacks.indexOf(callback);
                    if (index !== -1)
                        callbacks.splice(index, 1);
                };
            }
            $set() {
                // overridden by instance, if it has props
            }
        };
    }
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set() {
            // overridden by instance, if it has props
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, detail));
    }
    function append_dev(target, node) {
        dispatch_dev("SvelteDOMInsert", { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev("SvelteDOMInsert", { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev("SvelteDOMRemove", { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ["capture"] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev("SvelteDOMAddEventListener", { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev("SvelteDOMRemoveEventListener", { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
        else
            dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev("SvelteDOMSetProperty", { node, property, value });
    }
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error(`'target' is a required option`);
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn(`Component was already destroyed`); // eslint-disable-line no-console
            };
        }
    }

    function createCommonjsModule(fn, module) {
    	return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var tinycolor = createCommonjsModule(function (module) {
    // TinyColor v1.4.1
    // https://github.com/bgrins/TinyColor
    // Brian Grinstead, MIT License

    (function(Math) {

    var trimLeft = /^\s+/,
        trimRight = /\s+$/,
        tinyCounter = 0,
        mathRound = Math.round,
        mathMin = Math.min,
        mathMax = Math.max,
        mathRandom = Math.random;

    function tinycolor (color, opts) {

        color = (color) ? color : '';
        opts = opts || { };

        // If input is already a tinycolor, return itself
        if (color instanceof tinycolor) {
           return color;
        }
        // If we are called as a function, call using new instead
        if (!(this instanceof tinycolor)) {
            return new tinycolor(color, opts);
        }

        var rgb = inputToRGB(color);
        this._originalInput = color,
        this._r = rgb.r,
        this._g = rgb.g,
        this._b = rgb.b,
        this._a = rgb.a,
        this._roundA = mathRound(100*this._a) / 100,
        this._format = opts.format || rgb.format;
        this._gradientType = opts.gradientType;

        // Don't let the range of [0,255] come back in [0,1].
        // Potentially lose a little bit of precision here, but will fix issues where
        // .5 gets interpreted as half of the total, instead of half of 1
        // If it was supposed to be 128, this was already taken care of by `inputToRgb`
        if (this._r < 1) { this._r = mathRound(this._r); }
        if (this._g < 1) { this._g = mathRound(this._g); }
        if (this._b < 1) { this._b = mathRound(this._b); }

        this._ok = rgb.ok;
        this._tc_id = tinyCounter++;
    }

    tinycolor.prototype = {
        isDark: function() {
            return this.getBrightness() < 128;
        },
        isLight: function() {
            return !this.isDark();
        },
        isValid: function() {
            return this._ok;
        },
        getOriginalInput: function() {
          return this._originalInput;
        },
        getFormat: function() {
            return this._format;
        },
        getAlpha: function() {
            return this._a;
        },
        getBrightness: function() {
            //http://www.w3.org/TR/AERT#color-contrast
            var rgb = this.toRgb();
            return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        },
        getLuminance: function() {
            //http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
            var rgb = this.toRgb();
            var RsRGB, GsRGB, BsRGB, R, G, B;
            RsRGB = rgb.r/255;
            GsRGB = rgb.g/255;
            BsRGB = rgb.b/255;

            if (RsRGB <= 0.03928) {R = RsRGB / 12.92;} else {R = Math.pow(((RsRGB + 0.055) / 1.055), 2.4);}
            if (GsRGB <= 0.03928) {G = GsRGB / 12.92;} else {G = Math.pow(((GsRGB + 0.055) / 1.055), 2.4);}
            if (BsRGB <= 0.03928) {B = BsRGB / 12.92;} else {B = Math.pow(((BsRGB + 0.055) / 1.055), 2.4);}
            return (0.2126 * R) + (0.7152 * G) + (0.0722 * B);
        },
        setAlpha: function(value) {
            this._a = boundAlpha(value);
            this._roundA = mathRound(100*this._a) / 100;
            return this;
        },
        toHsv: function() {
            var hsv = rgbToHsv(this._r, this._g, this._b);
            return { h: hsv.h * 360, s: hsv.s, v: hsv.v, a: this._a };
        },
        toHsvString: function() {
            var hsv = rgbToHsv(this._r, this._g, this._b);
            var h = mathRound(hsv.h * 360), s = mathRound(hsv.s * 100), v = mathRound(hsv.v * 100);
            return (this._a == 1) ?
              "hsv("  + h + ", " + s + "%, " + v + "%)" :
              "hsva(" + h + ", " + s + "%, " + v + "%, "+ this._roundA + ")";
        },
        toHsl: function() {
            var hsl = rgbToHsl(this._r, this._g, this._b);
            return { h: hsl.h * 360, s: hsl.s, l: hsl.l, a: this._a };
        },
        toHslString: function() {
            var hsl = rgbToHsl(this._r, this._g, this._b);
            var h = mathRound(hsl.h * 360), s = mathRound(hsl.s * 100), l = mathRound(hsl.l * 100);
            return (this._a == 1) ?
              "hsl("  + h + ", " + s + "%, " + l + "%)" :
              "hsla(" + h + ", " + s + "%, " + l + "%, "+ this._roundA + ")";
        },
        toHex: function(allow3Char) {
            return rgbToHex(this._r, this._g, this._b, allow3Char);
        },
        toHexString: function(allow3Char) {
            return '#' + this.toHex(allow3Char);
        },
        toHex8: function(allow4Char) {
            return rgbaToHex(this._r, this._g, this._b, this._a, allow4Char);
        },
        toHex8String: function(allow4Char) {
            return '#' + this.toHex8(allow4Char);
        },
        toRgb: function() {
            return { r: mathRound(this._r), g: mathRound(this._g), b: mathRound(this._b), a: this._a };
        },
        toRgbString: function() {
            return (this._a == 1) ?
              "rgb("  + mathRound(this._r) + ", " + mathRound(this._g) + ", " + mathRound(this._b) + ")" :
              "rgba(" + mathRound(this._r) + ", " + mathRound(this._g) + ", " + mathRound(this._b) + ", " + this._roundA + ")";
        },
        toPercentageRgb: function() {
            return { r: mathRound(bound01(this._r, 255) * 100) + "%", g: mathRound(bound01(this._g, 255) * 100) + "%", b: mathRound(bound01(this._b, 255) * 100) + "%", a: this._a };
        },
        toPercentageRgbString: function() {
            return (this._a == 1) ?
              "rgb("  + mathRound(bound01(this._r, 255) * 100) + "%, " + mathRound(bound01(this._g, 255) * 100) + "%, " + mathRound(bound01(this._b, 255) * 100) + "%)" :
              "rgba(" + mathRound(bound01(this._r, 255) * 100) + "%, " + mathRound(bound01(this._g, 255) * 100) + "%, " + mathRound(bound01(this._b, 255) * 100) + "%, " + this._roundA + ")";
        },
        toName: function() {
            if (this._a === 0) {
                return "transparent";
            }

            if (this._a < 1) {
                return false;
            }

            return hexNames[rgbToHex(this._r, this._g, this._b, true)] || false;
        },
        toFilter: function(secondColor) {
            var hex8String = '#' + rgbaToArgbHex(this._r, this._g, this._b, this._a);
            var secondHex8String = hex8String;
            var gradientType = this._gradientType ? "GradientType = 1, " : "";

            if (secondColor) {
                var s = tinycolor(secondColor);
                secondHex8String = '#' + rgbaToArgbHex(s._r, s._g, s._b, s._a);
            }

            return "progid:DXImageTransform.Microsoft.gradient("+gradientType+"startColorstr="+hex8String+",endColorstr="+secondHex8String+")";
        },
        toString: function(format) {
            var formatSet = !!format;
            format = format || this._format;

            var formattedString = false;
            var hasAlpha = this._a < 1 && this._a >= 0;
            var needsAlphaFormat = !formatSet && hasAlpha && (format === "hex" || format === "hex6" || format === "hex3" || format === "hex4" || format === "hex8" || format === "name");

            if (needsAlphaFormat) {
                // Special case for "transparent", all other non-alpha formats
                // will return rgba when there is transparency.
                if (format === "name" && this._a === 0) {
                    return this.toName();
                }
                return this.toRgbString();
            }
            if (format === "rgb") {
                formattedString = this.toRgbString();
            }
            if (format === "prgb") {
                formattedString = this.toPercentageRgbString();
            }
            if (format === "hex" || format === "hex6") {
                formattedString = this.toHexString();
            }
            if (format === "hex3") {
                formattedString = this.toHexString(true);
            }
            if (format === "hex4") {
                formattedString = this.toHex8String(true);
            }
            if (format === "hex8") {
                formattedString = this.toHex8String();
            }
            if (format === "name") {
                formattedString = this.toName();
            }
            if (format === "hsl") {
                formattedString = this.toHslString();
            }
            if (format === "hsv") {
                formattedString = this.toHsvString();
            }

            return formattedString || this.toHexString();
        },
        clone: function() {
            return tinycolor(this.toString());
        },

        _applyModification: function(fn, args) {
            var color = fn.apply(null, [this].concat([].slice.call(args)));
            this._r = color._r;
            this._g = color._g;
            this._b = color._b;
            this.setAlpha(color._a);
            return this;
        },
        lighten: function() {
            return this._applyModification(lighten, arguments);
        },
        brighten: function() {
            return this._applyModification(brighten, arguments);
        },
        darken: function() {
            return this._applyModification(darken, arguments);
        },
        desaturate: function() {
            return this._applyModification(desaturate, arguments);
        },
        saturate: function() {
            return this._applyModification(saturate, arguments);
        },
        greyscale: function() {
            return this._applyModification(greyscale, arguments);
        },
        spin: function() {
            return this._applyModification(spin, arguments);
        },

        _applyCombination: function(fn, args) {
            return fn.apply(null, [this].concat([].slice.call(args)));
        },
        analogous: function() {
            return this._applyCombination(analogous, arguments);
        },
        complement: function() {
            return this._applyCombination(complement, arguments);
        },
        monochromatic: function() {
            return this._applyCombination(monochromatic, arguments);
        },
        splitcomplement: function() {
            return this._applyCombination(splitcomplement, arguments);
        },
        triad: function() {
            return this._applyCombination(triad, arguments);
        },
        tetrad: function() {
            return this._applyCombination(tetrad, arguments);
        }
    };

    // If input is an object, force 1 into "1.0" to handle ratios properly
    // String input requires "1.0" as input, so 1 will be treated as 1
    tinycolor.fromRatio = function(color, opts) {
        if (typeof color == "object") {
            var newColor = {};
            for (var i in color) {
                if (color.hasOwnProperty(i)) {
                    if (i === "a") {
                        newColor[i] = color[i];
                    }
                    else {
                        newColor[i] = convertToPercentage(color[i]);
                    }
                }
            }
            color = newColor;
        }

        return tinycolor(color, opts);
    };

    // Given a string or object, convert that input to RGB
    // Possible string inputs:
    //
    //     "red"
    //     "#f00" or "f00"
    //     "#ff0000" or "ff0000"
    //     "#ff000000" or "ff000000"
    //     "rgb 255 0 0" or "rgb (255, 0, 0)"
    //     "rgb 1.0 0 0" or "rgb (1, 0, 0)"
    //     "rgba (255, 0, 0, 1)" or "rgba 255, 0, 0, 1"
    //     "rgba (1.0, 0, 0, 1)" or "rgba 1.0, 0, 0, 1"
    //     "hsl(0, 100%, 50%)" or "hsl 0 100% 50%"
    //     "hsla(0, 100%, 50%, 1)" or "hsla 0 100% 50%, 1"
    //     "hsv(0, 100%, 100%)" or "hsv 0 100% 100%"
    //
    function inputToRGB(color) {

        var rgb = { r: 0, g: 0, b: 0 };
        var a = 1;
        var s = null;
        var v = null;
        var l = null;
        var ok = false;
        var format = false;

        if (typeof color == "string") {
            color = stringInputToObject(color);
        }

        if (typeof color == "object") {
            if (isValidCSSUnit(color.r) && isValidCSSUnit(color.g) && isValidCSSUnit(color.b)) {
                rgb = rgbToRgb(color.r, color.g, color.b);
                ok = true;
                format = String(color.r).substr(-1) === "%" ? "prgb" : "rgb";
            }
            else if (isValidCSSUnit(color.h) && isValidCSSUnit(color.s) && isValidCSSUnit(color.v)) {
                s = convertToPercentage(color.s);
                v = convertToPercentage(color.v);
                rgb = hsvToRgb(color.h, s, v);
                ok = true;
                format = "hsv";
            }
            else if (isValidCSSUnit(color.h) && isValidCSSUnit(color.s) && isValidCSSUnit(color.l)) {
                s = convertToPercentage(color.s);
                l = convertToPercentage(color.l);
                rgb = hslToRgb(color.h, s, l);
                ok = true;
                format = "hsl";
            }

            if (color.hasOwnProperty("a")) {
                a = color.a;
            }
        }

        a = boundAlpha(a);

        return {
            ok: ok,
            format: color.format || format,
            r: mathMin(255, mathMax(rgb.r, 0)),
            g: mathMin(255, mathMax(rgb.g, 0)),
            b: mathMin(255, mathMax(rgb.b, 0)),
            a: a
        };
    }


    // Conversion Functions
    // --------------------

    // `rgbToHsl`, `rgbToHsv`, `hslToRgb`, `hsvToRgb` modified from:
    // <http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript>

    // `rgbToRgb`
    // Handle bounds / percentage checking to conform to CSS color spec
    // <http://www.w3.org/TR/css3-color/>
    // *Assumes:* r, g, b in [0, 255] or [0, 1]
    // *Returns:* { r, g, b } in [0, 255]
    function rgbToRgb(r, g, b){
        return {
            r: bound01(r, 255) * 255,
            g: bound01(g, 255) * 255,
            b: bound01(b, 255) * 255
        };
    }

    // `rgbToHsl`
    // Converts an RGB color value to HSL.
    // *Assumes:* r, g, and b are contained in [0, 255] or [0, 1]
    // *Returns:* { h, s, l } in [0,1]
    function rgbToHsl(r, g, b) {

        r = bound01(r, 255);
        g = bound01(g, 255);
        b = bound01(b, 255);

        var max = mathMax(r, g, b), min = mathMin(r, g, b);
        var h, s, l = (max + min) / 2;

        if(max == min) {
            h = s = 0; // achromatic
        }
        else {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch(max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }

            h /= 6;
        }

        return { h: h, s: s, l: l };
    }

    // `hslToRgb`
    // Converts an HSL color value to RGB.
    // *Assumes:* h is contained in [0, 1] or [0, 360] and s and l are contained [0, 1] or [0, 100]
    // *Returns:* { r, g, b } in the set [0, 255]
    function hslToRgb(h, s, l) {
        var r, g, b;

        h = bound01(h, 360);
        s = bound01(s, 100);
        l = bound01(l, 100);

        function hue2rgb(p, q, t) {
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        if(s === 0) {
            r = g = b = l; // achromatic
        }
        else {
            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }

        return { r: r * 255, g: g * 255, b: b * 255 };
    }

    // `rgbToHsv`
    // Converts an RGB color value to HSV
    // *Assumes:* r, g, and b are contained in the set [0, 255] or [0, 1]
    // *Returns:* { h, s, v } in [0,1]
    function rgbToHsv(r, g, b) {

        r = bound01(r, 255);
        g = bound01(g, 255);
        b = bound01(b, 255);

        var max = mathMax(r, g, b), min = mathMin(r, g, b);
        var h, s, v = max;

        var d = max - min;
        s = max === 0 ? 0 : d / max;

        if(max == min) {
            h = 0; // achromatic
        }
        else {
            switch(max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h, s: s, v: v };
    }

    // `hsvToRgb`
    // Converts an HSV color value to RGB.
    // *Assumes:* h is contained in [0, 1] or [0, 360] and s and v are contained in [0, 1] or [0, 100]
    // *Returns:* { r, g, b } in the set [0, 255]
     function hsvToRgb(h, s, v) {

        h = bound01(h, 360) * 6;
        s = bound01(s, 100);
        v = bound01(v, 100);

        var i = Math.floor(h),
            f = h - i,
            p = v * (1 - s),
            q = v * (1 - f * s),
            t = v * (1 - (1 - f) * s),
            mod = i % 6,
            r = [v, q, p, p, t, v][mod],
            g = [t, v, v, q, p, p][mod],
            b = [p, p, t, v, v, q][mod];

        return { r: r * 255, g: g * 255, b: b * 255 };
    }

    // `rgbToHex`
    // Converts an RGB color to hex
    // Assumes r, g, and b are contained in the set [0, 255]
    // Returns a 3 or 6 character hex
    function rgbToHex(r, g, b, allow3Char) {

        var hex = [
            pad2(mathRound(r).toString(16)),
            pad2(mathRound(g).toString(16)),
            pad2(mathRound(b).toString(16))
        ];

        // Return a 3 character hex if possible
        if (allow3Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1)) {
            return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0);
        }

        return hex.join("");
    }

    // `rgbaToHex`
    // Converts an RGBA color plus alpha transparency to hex
    // Assumes r, g, b are contained in the set [0, 255] and
    // a in [0, 1]. Returns a 4 or 8 character rgba hex
    function rgbaToHex(r, g, b, a, allow4Char) {

        var hex = [
            pad2(mathRound(r).toString(16)),
            pad2(mathRound(g).toString(16)),
            pad2(mathRound(b).toString(16)),
            pad2(convertDecimalToHex(a))
        ];

        // Return a 4 character hex if possible
        if (allow4Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1) && hex[3].charAt(0) == hex[3].charAt(1)) {
            return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0) + hex[3].charAt(0);
        }

        return hex.join("");
    }

    // `rgbaToArgbHex`
    // Converts an RGBA color to an ARGB Hex8 string
    // Rarely used, but required for "toFilter()"
    function rgbaToArgbHex(r, g, b, a) {

        var hex = [
            pad2(convertDecimalToHex(a)),
            pad2(mathRound(r).toString(16)),
            pad2(mathRound(g).toString(16)),
            pad2(mathRound(b).toString(16))
        ];

        return hex.join("");
    }

    // `equals`
    // Can be called with any tinycolor input
    tinycolor.equals = function (color1, color2) {
        if (!color1 || !color2) { return false; }
        return tinycolor(color1).toRgbString() == tinycolor(color2).toRgbString();
    };

    tinycolor.random = function() {
        return tinycolor.fromRatio({
            r: mathRandom(),
            g: mathRandom(),
            b: mathRandom()
        });
    };


    // Modification Functions
    // ----------------------
    // Thanks to less.js for some of the basics here
    // <https://github.com/cloudhead/less.js/blob/master/lib/less/functions.js>

    function desaturate(color, amount) {
        amount = (amount === 0) ? 0 : (amount || 10);
        var hsl = tinycolor(color).toHsl();
        hsl.s -= amount / 100;
        hsl.s = clamp01(hsl.s);
        return tinycolor(hsl);
    }

    function saturate(color, amount) {
        amount = (amount === 0) ? 0 : (amount || 10);
        var hsl = tinycolor(color).toHsl();
        hsl.s += amount / 100;
        hsl.s = clamp01(hsl.s);
        return tinycolor(hsl);
    }

    function greyscale(color) {
        return tinycolor(color).desaturate(100);
    }

    function lighten (color, amount) {
        amount = (amount === 0) ? 0 : (amount || 10);
        var hsl = tinycolor(color).toHsl();
        hsl.l += amount / 100;
        hsl.l = clamp01(hsl.l);
        return tinycolor(hsl);
    }

    function brighten(color, amount) {
        amount = (amount === 0) ? 0 : (amount || 10);
        var rgb = tinycolor(color).toRgb();
        rgb.r = mathMax(0, mathMin(255, rgb.r - mathRound(255 * - (amount / 100))));
        rgb.g = mathMax(0, mathMin(255, rgb.g - mathRound(255 * - (amount / 100))));
        rgb.b = mathMax(0, mathMin(255, rgb.b - mathRound(255 * - (amount / 100))));
        return tinycolor(rgb);
    }

    function darken (color, amount) {
        amount = (amount === 0) ? 0 : (amount || 10);
        var hsl = tinycolor(color).toHsl();
        hsl.l -= amount / 100;
        hsl.l = clamp01(hsl.l);
        return tinycolor(hsl);
    }

    // Spin takes a positive or negative amount within [-360, 360] indicating the change of hue.
    // Values outside of this range will be wrapped into this range.
    function spin(color, amount) {
        var hsl = tinycolor(color).toHsl();
        var hue = (hsl.h + amount) % 360;
        hsl.h = hue < 0 ? 360 + hue : hue;
        return tinycolor(hsl);
    }

    // Combination Functions
    // ---------------------
    // Thanks to jQuery xColor for some of the ideas behind these
    // <https://github.com/infusion/jQuery-xcolor/blob/master/jquery.xcolor.js>

    function complement(color) {
        var hsl = tinycolor(color).toHsl();
        hsl.h = (hsl.h + 180) % 360;
        return tinycolor(hsl);
    }

    function triad(color) {
        var hsl = tinycolor(color).toHsl();
        var h = hsl.h;
        return [
            tinycolor(color),
            tinycolor({ h: (h + 120) % 360, s: hsl.s, l: hsl.l }),
            tinycolor({ h: (h + 240) % 360, s: hsl.s, l: hsl.l })
        ];
    }

    function tetrad(color) {
        var hsl = tinycolor(color).toHsl();
        var h = hsl.h;
        return [
            tinycolor(color),
            tinycolor({ h: (h + 90) % 360, s: hsl.s, l: hsl.l }),
            tinycolor({ h: (h + 180) % 360, s: hsl.s, l: hsl.l }),
            tinycolor({ h: (h + 270) % 360, s: hsl.s, l: hsl.l })
        ];
    }

    function splitcomplement(color) {
        var hsl = tinycolor(color).toHsl();
        var h = hsl.h;
        return [
            tinycolor(color),
            tinycolor({ h: (h + 72) % 360, s: hsl.s, l: hsl.l}),
            tinycolor({ h: (h + 216) % 360, s: hsl.s, l: hsl.l})
        ];
    }

    function analogous(color, results, slices) {
        results = results || 6;
        slices = slices || 30;

        var hsl = tinycolor(color).toHsl();
        var part = 360 / slices;
        var ret = [tinycolor(color)];

        for (hsl.h = ((hsl.h - (part * results >> 1)) + 720) % 360; --results; ) {
            hsl.h = (hsl.h + part) % 360;
            ret.push(tinycolor(hsl));
        }
        return ret;
    }

    function monochromatic(color, results) {
        results = results || 6;
        var hsv = tinycolor(color).toHsv();
        var h = hsv.h, s = hsv.s, v = hsv.v;
        var ret = [];
        var modification = 1 / results;

        while (results--) {
            ret.push(tinycolor({ h: h, s: s, v: v}));
            v = (v + modification) % 1;
        }

        return ret;
    }

    // Utility Functions
    // ---------------------

    tinycolor.mix = function(color1, color2, amount) {
        amount = (amount === 0) ? 0 : (amount || 50);

        var rgb1 = tinycolor(color1).toRgb();
        var rgb2 = tinycolor(color2).toRgb();

        var p = amount / 100;

        var rgba = {
            r: ((rgb2.r - rgb1.r) * p) + rgb1.r,
            g: ((rgb2.g - rgb1.g) * p) + rgb1.g,
            b: ((rgb2.b - rgb1.b) * p) + rgb1.b,
            a: ((rgb2.a - rgb1.a) * p) + rgb1.a
        };

        return tinycolor(rgba);
    };


    // Readability Functions
    // ---------------------
    // <http://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef (WCAG Version 2)

    // `contrast`
    // Analyze the 2 colors and returns the color contrast defined by (WCAG Version 2)
    tinycolor.readability = function(color1, color2) {
        var c1 = tinycolor(color1);
        var c2 = tinycolor(color2);
        return (Math.max(c1.getLuminance(),c2.getLuminance())+0.05) / (Math.min(c1.getLuminance(),c2.getLuminance())+0.05);
    };

    // `isReadable`
    // Ensure that foreground and background color combinations meet WCAG2 guidelines.
    // The third argument is an optional Object.
    //      the 'level' property states 'AA' or 'AAA' - if missing or invalid, it defaults to 'AA';
    //      the 'size' property states 'large' or 'small' - if missing or invalid, it defaults to 'small'.
    // If the entire object is absent, isReadable defaults to {level:"AA",size:"small"}.

    // *Example*
    //    tinycolor.isReadable("#000", "#111") => false
    //    tinycolor.isReadable("#000", "#111",{level:"AA",size:"large"}) => false
    tinycolor.isReadable = function(color1, color2, wcag2) {
        var readability = tinycolor.readability(color1, color2);
        var wcag2Parms, out;

        out = false;

        wcag2Parms = validateWCAG2Parms(wcag2);
        switch (wcag2Parms.level + wcag2Parms.size) {
            case "AAsmall":
            case "AAAlarge":
                out = readability >= 4.5;
                break;
            case "AAlarge":
                out = readability >= 3;
                break;
            case "AAAsmall":
                out = readability >= 7;
                break;
        }
        return out;

    };

    // `mostReadable`
    // Given a base color and a list of possible foreground or background
    // colors for that base, returns the most readable color.
    // Optionally returns Black or White if the most readable color is unreadable.
    // *Example*
    //    tinycolor.mostReadable(tinycolor.mostReadable("#123", ["#124", "#125"],{includeFallbackColors:false}).toHexString(); // "#112255"
    //    tinycolor.mostReadable(tinycolor.mostReadable("#123", ["#124", "#125"],{includeFallbackColors:true}).toHexString();  // "#ffffff"
    //    tinycolor.mostReadable("#a8015a", ["#faf3f3"],{includeFallbackColors:true,level:"AAA",size:"large"}).toHexString(); // "#faf3f3"
    //    tinycolor.mostReadable("#a8015a", ["#faf3f3"],{includeFallbackColors:true,level:"AAA",size:"small"}).toHexString(); // "#ffffff"
    tinycolor.mostReadable = function(baseColor, colorList, args) {
        var bestColor = null;
        var bestScore = 0;
        var readability;
        var includeFallbackColors, level, size ;
        args = args || {};
        includeFallbackColors = args.includeFallbackColors ;
        level = args.level;
        size = args.size;

        for (var i= 0; i < colorList.length ; i++) {
            readability = tinycolor.readability(baseColor, colorList[i]);
            if (readability > bestScore) {
                bestScore = readability;
                bestColor = tinycolor(colorList[i]);
            }
        }

        if (tinycolor.isReadable(baseColor, bestColor, {"level":level,"size":size}) || !includeFallbackColors) {
            return bestColor;
        }
        else {
            args.includeFallbackColors=false;
            return tinycolor.mostReadable(baseColor,["#fff", "#000"],args);
        }
    };


    // Big List of Colors
    // ------------------
    // <http://www.w3.org/TR/css3-color/#svg-color>
    var names = tinycolor.names = {
        aliceblue: "f0f8ff",
        antiquewhite: "faebd7",
        aqua: "0ff",
        aquamarine: "7fffd4",
        azure: "f0ffff",
        beige: "f5f5dc",
        bisque: "ffe4c4",
        black: "000",
        blanchedalmond: "ffebcd",
        blue: "00f",
        blueviolet: "8a2be2",
        brown: "a52a2a",
        burlywood: "deb887",
        burntsienna: "ea7e5d",
        cadetblue: "5f9ea0",
        chartreuse: "7fff00",
        chocolate: "d2691e",
        coral: "ff7f50",
        cornflowerblue: "6495ed",
        cornsilk: "fff8dc",
        crimson: "dc143c",
        cyan: "0ff",
        darkblue: "00008b",
        darkcyan: "008b8b",
        darkgoldenrod: "b8860b",
        darkgray: "a9a9a9",
        darkgreen: "006400",
        darkgrey: "a9a9a9",
        darkkhaki: "bdb76b",
        darkmagenta: "8b008b",
        darkolivegreen: "556b2f",
        darkorange: "ff8c00",
        darkorchid: "9932cc",
        darkred: "8b0000",
        darksalmon: "e9967a",
        darkseagreen: "8fbc8f",
        darkslateblue: "483d8b",
        darkslategray: "2f4f4f",
        darkslategrey: "2f4f4f",
        darkturquoise: "00ced1",
        darkviolet: "9400d3",
        deeppink: "ff1493",
        deepskyblue: "00bfff",
        dimgray: "696969",
        dimgrey: "696969",
        dodgerblue: "1e90ff",
        firebrick: "b22222",
        floralwhite: "fffaf0",
        forestgreen: "228b22",
        fuchsia: "f0f",
        gainsboro: "dcdcdc",
        ghostwhite: "f8f8ff",
        gold: "ffd700",
        goldenrod: "daa520",
        gray: "808080",
        green: "008000",
        greenyellow: "adff2f",
        grey: "808080",
        honeydew: "f0fff0",
        hotpink: "ff69b4",
        indianred: "cd5c5c",
        indigo: "4b0082",
        ivory: "fffff0",
        khaki: "f0e68c",
        lavender: "e6e6fa",
        lavenderblush: "fff0f5",
        lawngreen: "7cfc00",
        lemonchiffon: "fffacd",
        lightblue: "add8e6",
        lightcoral: "f08080",
        lightcyan: "e0ffff",
        lightgoldenrodyellow: "fafad2",
        lightgray: "d3d3d3",
        lightgreen: "90ee90",
        lightgrey: "d3d3d3",
        lightpink: "ffb6c1",
        lightsalmon: "ffa07a",
        lightseagreen: "20b2aa",
        lightskyblue: "87cefa",
        lightslategray: "789",
        lightslategrey: "789",
        lightsteelblue: "b0c4de",
        lightyellow: "ffffe0",
        lime: "0f0",
        limegreen: "32cd32",
        linen: "faf0e6",
        magenta: "f0f",
        maroon: "800000",
        mediumaquamarine: "66cdaa",
        mediumblue: "0000cd",
        mediumorchid: "ba55d3",
        mediumpurple: "9370db",
        mediumseagreen: "3cb371",
        mediumslateblue: "7b68ee",
        mediumspringgreen: "00fa9a",
        mediumturquoise: "48d1cc",
        mediumvioletred: "c71585",
        midnightblue: "191970",
        mintcream: "f5fffa",
        mistyrose: "ffe4e1",
        moccasin: "ffe4b5",
        navajowhite: "ffdead",
        navy: "000080",
        oldlace: "fdf5e6",
        olive: "808000",
        olivedrab: "6b8e23",
        orange: "ffa500",
        orangered: "ff4500",
        orchid: "da70d6",
        palegoldenrod: "eee8aa",
        palegreen: "98fb98",
        paleturquoise: "afeeee",
        palevioletred: "db7093",
        papayawhip: "ffefd5",
        peachpuff: "ffdab9",
        peru: "cd853f",
        pink: "ffc0cb",
        plum: "dda0dd",
        powderblue: "b0e0e6",
        purple: "800080",
        rebeccapurple: "663399",
        red: "f00",
        rosybrown: "bc8f8f",
        royalblue: "4169e1",
        saddlebrown: "8b4513",
        salmon: "fa8072",
        sandybrown: "f4a460",
        seagreen: "2e8b57",
        seashell: "fff5ee",
        sienna: "a0522d",
        silver: "c0c0c0",
        skyblue: "87ceeb",
        slateblue: "6a5acd",
        slategray: "708090",
        slategrey: "708090",
        snow: "fffafa",
        springgreen: "00ff7f",
        steelblue: "4682b4",
        tan: "d2b48c",
        teal: "008080",
        thistle: "d8bfd8",
        tomato: "ff6347",
        turquoise: "40e0d0",
        violet: "ee82ee",
        wheat: "f5deb3",
        white: "fff",
        whitesmoke: "f5f5f5",
        yellow: "ff0",
        yellowgreen: "9acd32"
    };

    // Make it easy to access colors via `hexNames[hex]`
    var hexNames = tinycolor.hexNames = flip(names);


    // Utilities
    // ---------

    // `{ 'name1': 'val1' }` becomes `{ 'val1': 'name1' }`
    function flip(o) {
        var flipped = { };
        for (var i in o) {
            if (o.hasOwnProperty(i)) {
                flipped[o[i]] = i;
            }
        }
        return flipped;
    }

    // Return a valid alpha value [0,1] with all invalid values being set to 1
    function boundAlpha(a) {
        a = parseFloat(a);

        if (isNaN(a) || a < 0 || a > 1) {
            a = 1;
        }

        return a;
    }

    // Take input from [0, n] and return it as [0, 1]
    function bound01(n, max) {
        if (isOnePointZero(n)) { n = "100%"; }

        var processPercent = isPercentage(n);
        n = mathMin(max, mathMax(0, parseFloat(n)));

        // Automatically convert percentage into number
        if (processPercent) {
            n = parseInt(n * max, 10) / 100;
        }

        // Handle floating point rounding errors
        if ((Math.abs(n - max) < 0.000001)) {
            return 1;
        }

        // Convert into [0, 1] range if it isn't already
        return (n % max) / parseFloat(max);
    }

    // Force a number between 0 and 1
    function clamp01(val) {
        return mathMin(1, mathMax(0, val));
    }

    // Parse a base-16 hex value into a base-10 integer
    function parseIntFromHex(val) {
        return parseInt(val, 16);
    }

    // Need to handle 1.0 as 100%, since once it is a number, there is no difference between it and 1
    // <http://stackoverflow.com/questions/7422072/javascript-how-to-detect-number-as-a-decimal-including-1-0>
    function isOnePointZero(n) {
        return typeof n == "string" && n.indexOf('.') != -1 && parseFloat(n) === 1;
    }

    // Check to see if string passed in is a percentage
    function isPercentage(n) {
        return typeof n === "string" && n.indexOf('%') != -1;
    }

    // Force a hex value to have 2 characters
    function pad2(c) {
        return c.length == 1 ? '0' + c : '' + c;
    }

    // Replace a decimal with it's percentage value
    function convertToPercentage(n) {
        if (n <= 1) {
            n = (n * 100) + "%";
        }

        return n;
    }

    // Converts a decimal to a hex value
    function convertDecimalToHex(d) {
        return Math.round(parseFloat(d) * 255).toString(16);
    }
    // Converts a hex value to a decimal
    function convertHexToDecimal(h) {
        return (parseIntFromHex(h) / 255);
    }

    var matchers = (function() {

        // <http://www.w3.org/TR/css3-values/#integers>
        var CSS_INTEGER = "[-\\+]?\\d+%?";

        // <http://www.w3.org/TR/css3-values/#number-value>
        var CSS_NUMBER = "[-\\+]?\\d*\\.\\d+%?";

        // Allow positive/negative integer/number.  Don't capture the either/or, just the entire outcome.
        var CSS_UNIT = "(?:" + CSS_NUMBER + ")|(?:" + CSS_INTEGER + ")";

        // Actual matching.
        // Parentheses and commas are optional, but not required.
        // Whitespace can take the place of commas or opening paren
        var PERMISSIVE_MATCH3 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
        var PERMISSIVE_MATCH4 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";

        return {
            CSS_UNIT: new RegExp(CSS_UNIT),
            rgb: new RegExp("rgb" + PERMISSIVE_MATCH3),
            rgba: new RegExp("rgba" + PERMISSIVE_MATCH4),
            hsl: new RegExp("hsl" + PERMISSIVE_MATCH3),
            hsla: new RegExp("hsla" + PERMISSIVE_MATCH4),
            hsv: new RegExp("hsv" + PERMISSIVE_MATCH3),
            hsva: new RegExp("hsva" + PERMISSIVE_MATCH4),
            hex3: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
            hex6: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
            hex4: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
            hex8: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/
        };
    })();

    // `isValidCSSUnit`
    // Take in a single string / number and check to see if it looks like a CSS unit
    // (see `matchers` above for definition).
    function isValidCSSUnit(color) {
        return !!matchers.CSS_UNIT.exec(color);
    }

    // `stringInputToObject`
    // Permissive string parsing.  Take in a number of formats, and output an object
    // based on detected format.  Returns `{ r, g, b }` or `{ h, s, l }` or `{ h, s, v}`
    function stringInputToObject(color) {

        color = color.replace(trimLeft,'').replace(trimRight, '').toLowerCase();
        var named = false;
        if (names[color]) {
            color = names[color];
            named = true;
        }
        else if (color == 'transparent') {
            return { r: 0, g: 0, b: 0, a: 0, format: "name" };
        }

        // Try to match string input using regular expressions.
        // Keep most of the number bounding out of this function - don't worry about [0,1] or [0,100] or [0,360]
        // Just return an object and let the conversion functions handle that.
        // This way the result will be the same whether the tinycolor is initialized with string or object.
        var match;
        if ((match = matchers.rgb.exec(color))) {
            return { r: match[1], g: match[2], b: match[3] };
        }
        if ((match = matchers.rgba.exec(color))) {
            return { r: match[1], g: match[2], b: match[3], a: match[4] };
        }
        if ((match = matchers.hsl.exec(color))) {
            return { h: match[1], s: match[2], l: match[3] };
        }
        if ((match = matchers.hsla.exec(color))) {
            return { h: match[1], s: match[2], l: match[3], a: match[4] };
        }
        if ((match = matchers.hsv.exec(color))) {
            return { h: match[1], s: match[2], v: match[3] };
        }
        if ((match = matchers.hsva.exec(color))) {
            return { h: match[1], s: match[2], v: match[3], a: match[4] };
        }
        if ((match = matchers.hex8.exec(color))) {
            return {
                r: parseIntFromHex(match[1]),
                g: parseIntFromHex(match[2]),
                b: parseIntFromHex(match[3]),
                a: convertHexToDecimal(match[4]),
                format: named ? "name" : "hex8"
            };
        }
        if ((match = matchers.hex6.exec(color))) {
            return {
                r: parseIntFromHex(match[1]),
                g: parseIntFromHex(match[2]),
                b: parseIntFromHex(match[3]),
                format: named ? "name" : "hex"
            };
        }
        if ((match = matchers.hex4.exec(color))) {
            return {
                r: parseIntFromHex(match[1] + '' + match[1]),
                g: parseIntFromHex(match[2] + '' + match[2]),
                b: parseIntFromHex(match[3] + '' + match[3]),
                a: convertHexToDecimal(match[4] + '' + match[4]),
                format: named ? "name" : "hex8"
            };
        }
        if ((match = matchers.hex3.exec(color))) {
            return {
                r: parseIntFromHex(match[1] + '' + match[1]),
                g: parseIntFromHex(match[2] + '' + match[2]),
                b: parseIntFromHex(match[3] + '' + match[3]),
                format: named ? "name" : "hex"
            };
        }

        return false;
    }

    function validateWCAG2Parms(parms) {
        // return valid WCAG2 parms for isReadable.
        // If input parms are invalid, return {"level":"AA", "size":"small"}
        var level, size;
        parms = parms || {"level":"AA", "size":"small"};
        level = (parms.level || "AA").toUpperCase();
        size = (parms.size || "small").toLowerCase();
        if (level !== "AA" && level !== "AAA") {
            level = "AA";
        }
        if (size !== "small" && size !== "large") {
            size = "small";
        }
        return {"level":level, "size":size};
    }

    // Node: Export function
    if ( module.exports) {
        module.exports = tinycolor;
    }
    // AMD/requirejs: Define the module
    else {
        window.tinycolor = tinycolor;
    }

    })(Math);
    });

    const limitatePercent = (num) => Math.max(0, Math.min(1, num));

    const getValidColor = (input) => {
      
      if(typeof input !== "string"){
        
        for(const key in input){
          if(isNaN(input[key])){
            return false;
          }
        }

        const {h, s, l, v, r, g, b, a} = input;

        if(
          (h !== null && (h < 0 || h > 360)) ||
          (a !== null && (a < 0 || a > 1)) ||
          (s !== null && (s < 0 || s > 1)) ||
          (v !== null && (v < 0 || v > 1)) ||
          (l !== null && (l < 0 || l > 1)) ||
          (r !== null && (r < 0 || r > 255)) ||
          (g !== null && (g < 0 || g > 255)) ||
          (b !== null && (b < 0 || b > 255))
        ) return false;
      }
      
      const color = tinycolor(input);
      return color.isValid() && color;
    };

    /* SaturationValue.svelte generated by Svelte v3.12.1 */

    const file = "SaturationValue.svelte";

    function create_fragment(ctx) {
    	var div3, div0, t0, div1, t1, div2, div3_class_value, dispose;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			t1 = space();
    			div2 = element("div");
    			attr_dev(div0, "class", "saturation svelte-hk0xhy");
    			add_location(div0, file, 102, 2, 2443);
    			attr_dev(div1, "class", "value svelte-hk0xhy");
    			add_location(div1, file, 103, 2, 2476);
    			attr_dev(div2, "class", "pointer svelte-hk0xhy");
    			set_style(div2, "left", "" + ctx.pointerX * 100 + "%");
    			set_style(div2, "top", "" + ctx.pointerY * 100 + "%");
    			add_location(div2, file, 104, 2, 2504);
    			attr_dev(div3, "class", div3_class_value = "saturation-value " + ctx.className + " svelte-hk0xhy");
    			set_style(div3, "background-color", ctx.pureColor);
    			add_location(div3, file, 96, 0, 2278);

    			dispose = [
    				listen_dev(div2, "mousedown", stop_propagation(prevent_default(ctx.handlePointerMousedown)), false, true, true),
    				listen_dev(div3, "mousedown", prevent_default(ctx.handleSquareMousedown), false, true)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div3, t0);
    			append_dev(div3, div1);
    			append_dev(div3, t1);
    			append_dev(div3, div2);
    			ctx.div2_binding(div2);
    			ctx.div3_binding(div3);
    		},

    		p: function update(changed, ctx) {
    			if (changed.pointerX) {
    				set_style(div2, "left", "" + ctx.pointerX * 100 + "%");
    			}

    			if (changed.pointerY) {
    				set_style(div2, "top", "" + ctx.pointerY * 100 + "%");
    			}

    			if ((changed.className) && div3_class_value !== (div3_class_value = "saturation-value " + ctx.className + " svelte-hk0xhy")) {
    				attr_dev(div3, "class", div3_class_value);
    			}

    			if (changed.pureColor) {
    				set_style(div3, "background-color", ctx.pureColor);
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div3);
    			}

    			ctx.div2_binding(null);
    			ctx.div3_binding(null);
    			run_all(dispose);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();

      let { class: className = "", h = 180, s = 0, v = 0 } = $$props; 
      
      // DOM
      let square;
      let pointer;  // v = 1 - x // x = -(v - 1)

      let pointerOffsetX = 0;
      let pointerOffsetY = 0;

      const handleMousemove = (event) => {
        const {x, y, width, height} = square.getBoundingClientRect();
        $$invalidate('s', s = limitatePercent((event.x - x + pointerOffsetX) / width));
        $$invalidate('v', v = 1 - limitatePercent((event.y - y + pointerOffsetY) / height));
        dispatch("input", {s, v});
      };

      const startMove = () => {
        //dispatch("inputstart", {s, v})
        handleMousemove(event);
        self.addEventListener("mousemove", handleMousemove);
        self.addEventListener("mouseup", handleMouseup);
      };

      const handleMouseup = () => {
        self.removeEventListener("mousemove", handleMousemove);
        self.removeEventListener("mouseup", handleMouseup);
        dispatch("inputend", {s, v});
      };

      const handlePointerMousedown = (event) => {
        const {x, y, width, height} = pointer.getBoundingClientRect();
        pointerOffsetX = (width / 2) - (event.x - x);
        pointerOffsetY = (height / 2) - (event.y - y);
        startMove();
      };

      const handleSquareMousedown = (event) => {
        pointerOffsetX = pointerOffsetY = 0;
        startMove();
      };

    	const writable_props = ['class', 'h', 's', 'v'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<SaturationValue> was created with unknown prop '${key}'`);
    	});

    	function div2_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			$$invalidate('pointer', pointer = $$value);
    		});
    	}

    	function div3_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			$$invalidate('square', square = $$value);
    		});
    	}

    	$$self.$set = $$props => {
    		if ('class' in $$props) $$invalidate('className', className = $$props.class);
    		if ('h' in $$props) $$invalidate('h', h = $$props.h);
    		if ('s' in $$props) $$invalidate('s', s = $$props.s);
    		if ('v' in $$props) $$invalidate('v', v = $$props.v);
    	};

    	$$self.$capture_state = () => {
    		return { className, h, s, v, square, pointer, pointerOffsetX, pointerOffsetY, pureColor, pointerX, pointerY };
    	};

    	$$self.$inject_state = $$props => {
    		if ('className' in $$props) $$invalidate('className', className = $$props.className);
    		if ('h' in $$props) $$invalidate('h', h = $$props.h);
    		if ('s' in $$props) $$invalidate('s', s = $$props.s);
    		if ('v' in $$props) $$invalidate('v', v = $$props.v);
    		if ('square' in $$props) $$invalidate('square', square = $$props.square);
    		if ('pointer' in $$props) $$invalidate('pointer', pointer = $$props.pointer);
    		if ('pointerOffsetX' in $$props) pointerOffsetX = $$props.pointerOffsetX;
    		if ('pointerOffsetY' in $$props) pointerOffsetY = $$props.pointerOffsetY;
    		if ('pureColor' in $$props) $$invalidate('pureColor', pureColor = $$props.pureColor);
    		if ('pointerX' in $$props) $$invalidate('pointerX', pointerX = $$props.pointerX);
    		if ('pointerY' in $$props) $$invalidate('pointerY', pointerY = $$props.pointerY);
    	};

    	let pureColor, pointerX, pointerY;

    	$$self.$$.update = ($$dirty = { h: 1, s: 1, v: 1 }) => {
    		if ($$dirty.h) { $$invalidate('pureColor', pureColor = `hsl(${h}, 100%, 50%)`); }
    		if ($$dirty.s) { $$invalidate('pointerX', pointerX = s); }
    		if ($$dirty.v) { $$invalidate('pointerY', pointerY = -(v - 1)); }
    	};

    	return {
    		className,
    		h,
    		s,
    		v,
    		square,
    		pointer,
    		handlePointerMousedown,
    		handleSquareMousedown,
    		pureColor,
    		pointerX,
    		pointerY,
    		div2_binding,
    		div3_binding
    	};
    }

    class SaturationValue extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, ["class", "h", "s", "v"]);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "SaturationValue", options, id: create_fragment.name });
    	}

    	get class() {
    		throw new Error("<SaturationValue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<SaturationValue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get h() {
    		throw new Error("<SaturationValue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set h(value) {
    		throw new Error("<SaturationValue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get s() {
    		throw new Error("<SaturationValue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set s(value) {
    		throw new Error("<SaturationValue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get v() {
    		throw new Error("<SaturationValue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set v(value) {
    		throw new Error("<SaturationValue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* Slider.svelte generated by Svelte v3.12.1 */

    const file$1 = "Slider.svelte";

    function create_fragment$1(ctx) {
    	var div1, div0, div1_class_value, dispose;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			attr_dev(div0, "class", "pointer svelte-1prfj86");
    			set_style(div0, "--value", "" + ctx.value * 100 + "%");
    			add_location(div0, file$1, 108, 2, 2450);
    			attr_dev(div1, "class", div1_class_value = "slider " + ctx.className + " svelte-1prfj86");
    			toggle_class(div1, "vertical", ctx.vertical);
    			toggle_class(div1, "horizontal", !ctx.vertical);
    			add_location(div1, file$1, 101, 0, 2289);

    			dispose = [
    				listen_dev(div0, "mousedown", stop_propagation(prevent_default(ctx.handlePointerMousedown)), false, true, true),
    				listen_dev(div1, "mousedown", prevent_default(ctx.handleSliderMousemove), false, true)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			ctx.div0_binding(div0);
    			ctx.div1_binding(div1);
    		},

    		p: function update(changed, ctx) {
    			if (changed.value) {
    				set_style(div0, "--value", "" + ctx.value * 100 + "%");
    			}

    			if ((changed.className) && div1_class_value !== (div1_class_value = "slider " + ctx.className + " svelte-1prfj86")) {
    				attr_dev(div1, "class", div1_class_value);
    			}

    			if ((changed.className || changed.vertical)) {
    				toggle_class(div1, "vertical", ctx.vertical);
    				toggle_class(div1, "horizontal", !ctx.vertical);
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div1);
    			}

    			ctx.div0_binding(null);
    			ctx.div1_binding(null);
    			run_all(dispose);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$1.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();

      let { class: className = "", value = 0, vertical = false } = $$props;

      const set = (newValue) => $$invalidate('value', value = newValue);

      let pointerOffsetX = 0;
      let pointerOffsetY = 0;

      let prevValue = value;

      let slider;
      let pointer;

      const handleMousemove = (event) => {
        const {x, y, width, height} = slider.getBoundingClientRect();
        if(vertical){
          $$invalidate('value', value = limitatePercent((event.y - y + pointerOffsetY) / height));
        } else {
          $$invalidate('value', value = limitatePercent((event.x - x + pointerOffsetX) / width));
        }

        if(value !== prevValue){
          prevValue = value;
          dispatch("input", value);    
        }
      };

      const startMove = (event) => {
        handleMousemove(event);
        self.addEventListener("mousemove", handleMousemove);    
        self.addEventListener("mouseup", handleMouseup);
      };

      const handleMouseup = () => {
        self.removeEventListener("mousemove", handleMousemove);
        self.removeEventListener("mousedown", handleMouseup);
      };

      const handleSliderMousemove = (event) => {
        pointerOffsetX = pointerOffsetY = 0;
        startMove(event);
      };

      const handlePointerMousedown = (event) => {
        const {x, y, width, height} = pointer.getBoundingClientRect();
        pointerOffsetX = (width / 2) - (event.x - x);
        pointerOffsetY = (height / 2) - (event.y - y);
        startMove(event);
      };

    	const writable_props = ['class', 'value', 'vertical'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Slider> was created with unknown prop '${key}'`);
    	});

    	function div0_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			$$invalidate('pointer', pointer = $$value);
    		});
    	}

    	function div1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			$$invalidate('slider', slider = $$value);
    		});
    	}

    	$$self.$set = $$props => {
    		if ('class' in $$props) $$invalidate('className', className = $$props.class);
    		if ('value' in $$props) $$invalidate('value', value = $$props.value);
    		if ('vertical' in $$props) $$invalidate('vertical', vertical = $$props.vertical);
    	};

    	$$self.$capture_state = () => {
    		return { className, value, vertical, pointerOffsetX, pointerOffsetY, prevValue, slider, pointer };
    	};

    	$$self.$inject_state = $$props => {
    		if ('className' in $$props) $$invalidate('className', className = $$props.className);
    		if ('value' in $$props) $$invalidate('value', value = $$props.value);
    		if ('vertical' in $$props) $$invalidate('vertical', vertical = $$props.vertical);
    		if ('pointerOffsetX' in $$props) pointerOffsetX = $$props.pointerOffsetX;
    		if ('pointerOffsetY' in $$props) pointerOffsetY = $$props.pointerOffsetY;
    		if ('prevValue' in $$props) prevValue = $$props.prevValue;
    		if ('slider' in $$props) $$invalidate('slider', slider = $$props.slider);
    		if ('pointer' in $$props) $$invalidate('pointer', pointer = $$props.pointer);
    	};

    	return {
    		className,
    		value,
    		vertical,
    		set,
    		slider,
    		pointer,
    		handleSliderMousemove,
    		handlePointerMousedown,
    		div0_binding,
    		div1_binding
    	};
    }

    class Slider extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, ["class", "value", "vertical", "set"]);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Slider", options, id: create_fragment$1.name });
    	}

    	get class() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get vertical() {
    		throw new Error("<Slider>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set vertical(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get set() {
    		return this.$$.ctx.set;
    	}

    	set set(value) {
    		throw new Error("<Slider>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* Alpha.svelte generated by Svelte v3.12.1 */

    const file$2 = "Alpha.svelte";

    function create_fragment$2(ctx) {
    	var div1, div0, updating_value, div1_class_value, current;

    	function slider_value_binding(value) {
    		ctx.slider_value_binding.call(null, value);
    		updating_value = true;
    		add_flush_callback(() => updating_value = false);
    	}

    	let slider_props = { vertical: ctx.vertical };
    	if (ctx.a !== void 0) {
    		slider_props.value = ctx.a;
    	}
    	var slider = new Slider({ props: slider_props, $$inline: true });

    	binding_callbacks.push(() => bind(slider, 'value', slider_value_binding));
    	slider.$on("input", ctx.input_handler);
    	slider.$on("input", input_handler_1);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			slider.$$.fragment.c();
    			attr_dev(div0, "class", "alpha-in svelte-ekrr8n");
    			set_style(div0, "background", "linear-gradient(to " + ctx.toGradient + ", transparent 0%, " + ctx.color + " 100%)");
    			add_location(div0, file$2, 37, 2, 853);
    			attr_dev(div1, "class", div1_class_value = "alpha " + ctx.className + " svelte-ekrr8n");
    			toggle_class(div1, "vertical", ctx.vertical);
    			toggle_class(div1, "horizontal", !ctx.vertical);
    			add_location(div1, file$2, 36, 0, 775);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			mount_component(slider, div0, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var slider_changes = {};
    			if (changed.vertical) slider_changes.vertical = ctx.vertical;
    			if (!updating_value && changed.a) {
    				slider_changes.value = ctx.a;
    			}
    			slider.$set(slider_changes);

    			if (!current || changed.toGradient || changed.color) {
    				set_style(div0, "background", "linear-gradient(to " + ctx.toGradient + ", transparent 0%, " + ctx.color + " 100%)");
    			}

    			if ((!current || changed.className) && div1_class_value !== (div1_class_value = "alpha " + ctx.className + " svelte-ekrr8n")) {
    				attr_dev(div1, "class", div1_class_value);
    			}

    			if ((changed.className || changed.vertical)) {
    				toggle_class(div1, "vertical", ctx.vertical);
    				toggle_class(div1, "horizontal", !ctx.vertical);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(slider.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(slider.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div1);
    			}

    			destroy_component(slider);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$2.name, type: "component", source: "", ctx });
    	return block;
    }

    const input_handler_1 = (event) => console.log(event.detail);

    function instance$2($$self, $$props, $$invalidate) {
    	let { class: className = "", a = 1, vertical = false, color = "#fff" } = $$props;
      //$: style = `background: linear-gradient(to ${vertical ? "bottom" : "right"}, transparent 0%, ${color} 100%)`;

    	const writable_props = ['class', 'a', 'vertical', 'color'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Alpha> was created with unknown prop '${key}'`);
    	});

    	function input_handler(event) {
    		bubble($$self, event);
    	}

    	function slider_value_binding(value) {
    		a = value;
    		$$invalidate('a', a);
    	}

    	$$self.$set = $$props => {
    		if ('class' in $$props) $$invalidate('className', className = $$props.class);
    		if ('a' in $$props) $$invalidate('a', a = $$props.a);
    		if ('vertical' in $$props) $$invalidate('vertical', vertical = $$props.vertical);
    		if ('color' in $$props) $$invalidate('color', color = $$props.color);
    	};

    	$$self.$capture_state = () => {
    		return { className, a, vertical, color, toGradient };
    	};

    	$$self.$inject_state = $$props => {
    		if ('className' in $$props) $$invalidate('className', className = $$props.className);
    		if ('a' in $$props) $$invalidate('a', a = $$props.a);
    		if ('vertical' in $$props) $$invalidate('vertical', vertical = $$props.vertical);
    		if ('color' in $$props) $$invalidate('color', color = $$props.color);
    		if ('toGradient' in $$props) $$invalidate('toGradient', toGradient = $$props.toGradient);
    	};

    	let toGradient;

    	$$self.$$.update = ($$dirty = { vertical: 1 }) => {
    		if ($$dirty.vertical) { $$invalidate('toGradient', toGradient = vertical ? "bottom" : "right"); }
    	};

    	return {
    		className,
    		a,
    		vertical,
    		color,
    		toGradient,
    		input_handler,
    		slider_value_binding
    	};
    }

    class Alpha extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, ["class", "a", "vertical", "color"]);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Alpha", options, id: create_fragment$2.name });
    	}

    	get class() {
    		throw new Error("<Alpha>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Alpha>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get a() {
    		throw new Error("<Alpha>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set a(value) {
    		throw new Error("<Alpha>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get vertical() {
    		throw new Error("<Alpha>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set vertical(value) {
    		throw new Error("<Alpha>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get color() {
    		throw new Error("<Alpha>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<Alpha>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* Hue.svelte generated by Svelte v3.12.1 */

    const file$3 = "Hue.svelte";

    function create_fragment$3(ctx) {
    	var div, updating_value, div_class_value, current;

    	function slider_1_value_binding(value) {
    		ctx.slider_1_value_binding.call(null, value);
    		updating_value = true;
    		add_flush_callback(() => updating_value = false);
    	}

    	let slider_1_props = { vertical: ctx.vertical };
    	if (ctx.sliderValue !== void 0) {
    		slider_1_props.value = ctx.sliderValue;
    	}
    	var slider_1 = new Slider({ props: slider_1_props, $$inline: true });

    	binding_callbacks.push(() => bind(slider_1, 'value', slider_1_value_binding));
    	slider_1.$on("input", ctx.handle);

    	const block = {
    		c: function create() {
    			div = element("div");
    			slider_1.$$.fragment.c();
    			attr_dev(div, "class", div_class_value = "hue " + ctx.className + " svelte-1fgqm9o");
    			toggle_class(div, "vertical", ctx.vertical);
    			toggle_class(div, "horizontal", !ctx.vertical);
    			add_location(div, file$3, 37, 0, 812);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(slider_1, div, null);
    			current = true;
    		},

    		p: function update(changed, ctx) {
    			var slider_1_changes = {};
    			if (changed.vertical) slider_1_changes.vertical = ctx.vertical;
    			if (!updating_value && changed.sliderValue) {
    				slider_1_changes.value = ctx.sliderValue;
    			}
    			slider_1.$set(slider_1_changes);

    			if ((!current || changed.className) && div_class_value !== (div_class_value = "hue " + ctx.className + " svelte-1fgqm9o")) {
    				attr_dev(div, "class", div_class_value);
    			}

    			if ((changed.className || changed.vertical)) {
    				toggle_class(div, "vertical", ctx.vertical);
    				toggle_class(div, "horizontal", !ctx.vertical);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(slider_1.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(slider_1.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}

    			destroy_component(slider_1);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$3.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();
      
      let { class: className = "", h = 0, vertical = false } = $$props;

      const set = (newValue) => {
        $$invalidate('h', h = newValue);
        $$invalidate('sliderValue', sliderValue = newValue / 360); 
      };

      let slider;

      const handle = (event) => {
        $$invalidate('h', h = Math.floor(sliderValue * 360));
        dispatch("input", h);
      };

    	const writable_props = ['class', 'h', 'vertical'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Hue> was created with unknown prop '${key}'`);
    	});

    	function slider_1_value_binding(value) {
    		sliderValue = value;
    		$$invalidate('sliderValue', sliderValue), $$invalidate('h', h);
    	}

    	$$self.$set = $$props => {
    		if ('class' in $$props) $$invalidate('className', className = $$props.class);
    		if ('h' in $$props) $$invalidate('h', h = $$props.h);
    		if ('vertical' in $$props) $$invalidate('vertical', vertical = $$props.vertical);
    	};

    	$$self.$capture_state = () => {
    		return { className, h, vertical, slider, sliderValue };
    	};

    	$$self.$inject_state = $$props => {
    		if ('className' in $$props) $$invalidate('className', className = $$props.className);
    		if ('h' in $$props) $$invalidate('h', h = $$props.h);
    		if ('vertical' in $$props) $$invalidate('vertical', vertical = $$props.vertical);
    		if ('slider' in $$props) slider = $$props.slider;
    		if ('sliderValue' in $$props) $$invalidate('sliderValue', sliderValue = $$props.sliderValue);
    	};

    	let sliderValue;

    	$$self.$$.update = ($$dirty = { h: 1 }) => {
    		if ($$dirty.h) { $$invalidate('sliderValue', sliderValue = h / 360); }
    	};

    	return {
    		className,
    		h,
    		vertical,
    		set,
    		handle,
    		sliderValue,
    		slider_1_value_binding
    	};
    }

    class Hue extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, ["class", "h", "vertical", "set"]);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Hue", options, id: create_fragment$3.name });
    	}

    	get class() {
    		throw new Error("<Hue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Hue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get h() {
    		throw new Error("<Hue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set h(value) {
    		throw new Error("<Hue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get vertical() {
    		throw new Error("<Hue>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set vertical(value) {
    		throw new Error("<Hue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get set() {
    		return this.$$.ctx.set;
    	}

    	set set(value) {
    		throw new Error("<Hue>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* ColorSquare.svelte generated by Svelte v3.12.1 */

    const file$4 = "ColorSquare.svelte";

    function create_fragment$4(ctx) {
    	var div1, div0;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			attr_dev(div0, "class", "color-square-in svelte-v4tr2x");
    			set_style(div0, "background", ctx.color);
    			add_location(div0, file$4, 20, 2, 444);
    			attr_dev(div1, "class", "color-square svelte-v4tr2x");
    			add_location(div1, file$4, 19, 0, 415);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    		},

    		p: function update(changed, ctx) {
    			if (changed.color) {
    				set_style(div0, "background", ctx.color);
    			}
    		},

    		i: noop,
    		o: noop,

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div1);
    			}
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$4.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { color } = $$props;

    	const writable_props = ['color'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<ColorSquare> was created with unknown prop '${key}'`);
    	});

    	$$self.$set = $$props => {
    		if ('color' in $$props) $$invalidate('color', color = $$props.color);
    	};

    	$$self.$capture_state = () => {
    		return { color };
    	};

    	$$self.$inject_state = $$props => {
    		if ('color' in $$props) $$invalidate('color', color = $$props.color);
    	};

    	return { color };
    }

    class ColorSquare extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, ["color"]);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "ColorSquare", options, id: create_fragment$4.name });

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.color === undefined && !('color' in props)) {
    			console.warn("<ColorSquare> was created without expected prop 'color'");
    		}
    	}

    	get color() {
    		throw new Error("<ColorSquare>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set color(value) {
    		throw new Error("<ColorSquare>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* Chrome.svelte generated by Svelte v3.12.1 */

    const file$5 = "Chrome.svelte";

    // (241:6) {#if !disableAlpha}
    function create_if_block_5(ctx) {
    	var div, updating_a, current;

    	function alpha_a_binding(value) {
    		ctx.alpha_a_binding.call(null, value);
    		updating_a = true;
    		add_flush_callback(() => updating_a = false);
    	}

    	let alpha_props = { color: ctx.hex };
    	if (ctx.a !== void 0) {
    		alpha_props.a = ctx.a;
    	}
    	var alpha = new Alpha({ props: alpha_props, $$inline: true });

    	binding_callbacks.push(() => bind(alpha, 'a', alpha_a_binding));
    	alpha.$on("input", ctx.dispatchInput);

    	const block = {
    		c: function create() {
    			div = element("div");
    			alpha.$$.fragment.c();
    			attr_dev(div, "class", "alpha-wrap svelte-1h9seex");
    			add_location(div, file$5, 241, 8, 5145);
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			mount_component(alpha, div, null);
    			current = true;
    		},

    		p: function update_1(changed, ctx) {
    			var alpha_changes = {};
    			if (changed.hex) alpha_changes.color = ctx.hex;
    			if (!updating_a && changed.a) {
    				alpha_changes.a = ctx.a;
    			}
    			alpha.$set(alpha_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(alpha.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(alpha.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}

    			destroy_component(alpha);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block_5.name, type: "if", source: "(241:6) {#if !disableAlpha}", ctx });
    	return block;
    }

    // (317:34) 
    function create_if_block_3(ctx) {
    	var div3, div0, input0, input0_value_value, t0, label0, t2, div1, input1, input1_value_value, t3, label1, t5, div2, input2, input2_value_value, t6, label2, t8, dispose;

    	var if_block = (!ctx.disableAlpha) && create_if_block_4(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			input0 = element("input");
    			t0 = space();
    			label0 = element("label");
    			label0.textContent = "h";
    			t2 = space();
    			div1 = element("div");
    			input1 = element("input");
    			t3 = space();
    			label1 = element("label");
    			label1.textContent = "s";
    			t5 = space();
    			div2 = element("div");
    			input2 = element("input");
    			t6 = space();
    			label2 = element("label");
    			label2.textContent = "l";
    			t8 = space();
    			if (if_block) if_block.c();
    			attr_dev(input0, "class", "hsla svelte-1h9seex");
    			attr_dev(input0, "id", "h-input");
    			input0.value = input0_value_value = Math.round(ctx.h) % 360;
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "maxlength", 3);
    			add_location(input0, file$5, 319, 12, 7602);
    			attr_dev(label0, "for", "h-input");
    			attr_dev(label0, "class", "svelte-1h9seex");
    			add_location(label0, file$5, 327, 12, 7897);
    			attr_dev(div0, "class", "input-wrap svelte-1h9seex");
    			add_location(div0, file$5, 318, 10, 7565);
    			attr_dev(input1, "id", "s-input");
    			attr_dev(input1, "class", "hsla percent-input svelte-1h9seex");
    			input1.value = input1_value_value = "" + Math.round(ctx.s * 100) + "%";
    			attr_dev(input1, "type", "text");
    			attr_dev(input1, "maxlength", 4);
    			add_location(input1, file$5, 330, 12, 7992);
    			attr_dev(label1, "for", "s-input");
    			attr_dev(label1, "class", "svelte-1h9seex");
    			add_location(label1, file$5, 339, 12, 8326);
    			attr_dev(div1, "class", "input-wrap svelte-1h9seex");
    			add_location(div1, file$5, 329, 10, 7955);
    			attr_dev(input2, "id", "l-input");
    			attr_dev(input2, "class", "hsla percent-input svelte-1h9seex");
    			input2.value = input2_value_value = "" + Math.round(ctx.l * 100) + "%";
    			attr_dev(input2, "type", "text");
    			attr_dev(input2, "maxlength", 4);
    			add_location(input2, file$5, 342, 12, 8421);
    			attr_dev(label2, "for", "l-input");
    			attr_dev(label2, "class", "svelte-1h9seex");
    			add_location(label2, file$5, 351, 12, 8755);
    			attr_dev(div2, "class", "input-wrap svelte-1h9seex");
    			add_location(div2, file$5, 341, 10, 8384);
    			attr_dev(div3, "class", "hsla-wrap svelte-1h9seex");
    			add_location(div3, file$5, 317, 8, 7531);

    			dispose = [
    				listen_dev(input0, "keypress", ctx.onlyNumbers),
    				listen_dev(input0, "input", ctx.input_handler_7),
    				listen_dev(input1, "keypress", ctx.onlyNumbers),
    				listen_dev(input1, "input", ctx.input_handler_8),
    				listen_dev(input2, "keypress", ctx.onlyNumbers),
    				listen_dev(input2, "input", ctx.input_handler_9)
    			];
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div0, input0);
    			append_dev(div0, t0);
    			append_dev(div0, label0);
    			append_dev(div3, t2);
    			append_dev(div3, div1);
    			append_dev(div1, input1);
    			append_dev(div1, t3);
    			append_dev(div1, label1);
    			append_dev(div3, t5);
    			append_dev(div3, div2);
    			append_dev(div2, input2);
    			append_dev(div2, t6);
    			append_dev(div2, label2);
    			append_dev(div3, t8);
    			if (if_block) if_block.m(div3, null);
    		},

    		p: function update_1(changed, ctx) {
    			if ((changed.h) && input0_value_value !== (input0_value_value = Math.round(ctx.h) % 360)) {
    				prop_dev(input0, "value", input0_value_value);
    			}

    			if ((changed.s) && input1_value_value !== (input1_value_value = "" + Math.round(ctx.s * 100) + "%")) {
    				prop_dev(input1, "value", input1_value_value);
    			}

    			if ((changed.l) && input2_value_value !== (input2_value_value = "" + Math.round(ctx.l * 100) + "%")) {
    				prop_dev(input2, "value", input2_value_value);
    			}

    			if (!ctx.disableAlpha) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    				} else {
    					if_block = create_if_block_4(ctx);
    					if_block.c();
    					if_block.m(div3, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div3);
    			}

    			if (if_block) if_block.d();
    			run_all(dispose);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block_3.name, type: "if", source: "(317:34) ", ctx });
    	return block;
    }

    // (265:34) 
    function create_if_block_1(ctx) {
    	var div3, div0, input0, t0, label0, t2, div1, input1, t3, label1, t5, div2, input2, t6, label2, t8, dispose;

    	var if_block = (!ctx.disableAlpha) && create_if_block_2(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			input0 = element("input");
    			t0 = space();
    			label0 = element("label");
    			label0.textContent = "r";
    			t2 = space();
    			div1 = element("div");
    			input1 = element("input");
    			t3 = space();
    			label1 = element("label");
    			label1.textContent = "g";
    			t5 = space();
    			div2 = element("div");
    			input2 = element("input");
    			t6 = space();
    			label2 = element("label");
    			label2.textContent = "b";
    			t8 = space();
    			if (if_block) if_block.c();
    			attr_dev(input0, "id", "red-input");
    			attr_dev(input0, "class", "rgba svelte-1h9seex");
    			attr_dev(input0, "type", "text");
    			input0.value = ctx.r;
    			attr_dev(input0, "maxlength", 3);
    			add_location(input0, file$5, 267, 12, 5871);
    			attr_dev(label0, "for", "red-input");
    			attr_dev(label0, "class", "svelte-1h9seex");
    			add_location(label0, file$5, 276, 12, 6164);
    			attr_dev(div0, "class", "input-wrap svelte-1h9seex");
    			add_location(div0, file$5, 266, 10, 5834);
    			attr_dev(input1, "id", "green-input");
    			attr_dev(input1, "class", "rgba svelte-1h9seex");
    			attr_dev(input1, "type", "text");
    			input1.value = ctx.g;
    			attr_dev(input1, "maxlength", 3);
    			add_location(input1, file$5, 279, 12, 6261);
    			attr_dev(label1, "for", "green-input");
    			attr_dev(label1, "class", "svelte-1h9seex");
    			add_location(label1, file$5, 288, 12, 6556);
    			attr_dev(div1, "class", "input-wrap svelte-1h9seex");
    			add_location(div1, file$5, 278, 10, 6224);
    			attr_dev(input2, "class", "rgba svelte-1h9seex");
    			attr_dev(input2, "id", "blue-input");
    			attr_dev(input2, "type", "text");
    			input2.value = ctx.b;
    			attr_dev(input2, "maxlength", 3);
    			add_location(input2, file$5, 291, 12, 6655);
    			attr_dev(label2, "for", "blue-input");
    			attr_dev(label2, "class", "svelte-1h9seex");
    			add_location(label2, file$5, 299, 12, 6935);
    			attr_dev(div2, "class", "input-wrap svelte-1h9seex");
    			add_location(div2, file$5, 290, 10, 6618);
    			attr_dev(div3, "class", "rgba-wrap svelte-1h9seex");
    			add_location(div3, file$5, 265, 8, 5800);

    			dispose = [
    				listen_dev(input0, "keypress", ctx.onlyNumbers),
    				listen_dev(input0, "input", ctx.input_handler_3),
    				listen_dev(input1, "keypress", ctx.onlyNumbers),
    				listen_dev(input1, "input", ctx.input_handler_4),
    				listen_dev(input2, "keypress", ctx.onlyNumbers),
    				listen_dev(input2, "input", ctx.input_handler_5)
    			];
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div0);
    			append_dev(div0, input0);
    			append_dev(div0, t0);
    			append_dev(div0, label0);
    			append_dev(div3, t2);
    			append_dev(div3, div1);
    			append_dev(div1, input1);
    			append_dev(div1, t3);
    			append_dev(div1, label1);
    			append_dev(div3, t5);
    			append_dev(div3, div2);
    			append_dev(div2, input2);
    			append_dev(div2, t6);
    			append_dev(div2, label2);
    			append_dev(div3, t8);
    			if (if_block) if_block.m(div3, null);
    		},

    		p: function update_1(changed, ctx) {
    			if (changed.r) {
    				prop_dev(input0, "value", ctx.r);
    			}

    			if (changed.g) {
    				prop_dev(input1, "value", ctx.g);
    			}

    			if (changed.b) {
    				prop_dev(input2, "value", ctx.b);
    			}

    			if (!ctx.disableAlpha) {
    				if (if_block) {
    					if_block.p(changed, ctx);
    				} else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					if_block.m(div3, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div3);
    			}

    			if (if_block) if_block.d();
    			run_all(dispose);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block_1.name, type: "if", source: "(265:34) ", ctx });
    	return block;
    }

    // (252:6) {#if fieldsIndex === 0}
    function create_if_block(ctx) {
    	var div, input, t, label, dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			input = element("input");
    			t = space();
    			label = element("label");
    			label.textContent = "hex";
    			attr_dev(input, "id", "hex-input");
    			attr_dev(input, "class", "hex svelte-1h9seex");
    			attr_dev(input, "type", "text");
    			input.value = ctx.hex;
    			attr_dev(input, "maxlength", 7);
    			add_location(input, file$5, 253, 10, 5429);
    			attr_dev(label, "for", "hex-input");
    			attr_dev(label, "class", "svelte-1h9seex");
    			add_location(label, file$5, 262, 10, 5707);
    			attr_dev(div, "class", "input-wrap hex-wrap svelte-1h9seex");
    			add_location(div, file$5, 252, 8, 5385);

    			dispose = [
    				listen_dev(input, "keypress", ctx.onlyChars("#0123456789abcdefABCFDEF")),
    				listen_dev(input, "input", ctx.input_handler_2)
    			];
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input);
    			append_dev(div, t);
    			append_dev(div, label);
    		},

    		p: function update_1(changed, ctx) {
    			if (changed.hex) {
    				prop_dev(input, "value", ctx.hex);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}

    			run_all(dispose);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block.name, type: "if", source: "(252:6) {#if fieldsIndex === 0}", ctx });
    	return block;
    }

    // (354:10) {#if !disableAlpha}
    function create_if_block_4(ctx) {
    	var div, input, input_value_value, t, label, dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			input = element("input");
    			t = space();
    			label = element("label");
    			label.textContent = "a";
    			attr_dev(input, "id", "hsla-a-input");
    			attr_dev(input, "class", "hsla svelte-1h9seex");
    			input.value = input_value_value = Math.round(ctx.a * 100) / 100;
    			attr_dev(input, "type", "text");
    			attr_dev(input, "maxlength", 4);
    			add_location(input, file$5, 355, 14, 8884);
    			attr_dev(label, "for", "hsla-a-input");
    			attr_dev(label, "class", "svelte-1h9seex");
    			add_location(label, file$5, 364, 14, 9221);
    			attr_dev(div, "class", "input-wrap svelte-1h9seex");
    			add_location(div, file$5, 354, 12, 8845);

    			dispose = [
    				listen_dev(input, "keypress", ctx.onlyNumbersAndDot),
    				listen_dev(input, "input", ctx.input_handler_10)
    			];
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input);
    			append_dev(div, t);
    			append_dev(div, label);
    		},

    		p: function update_1(changed, ctx) {
    			if ((changed.a) && input_value_value !== (input_value_value = Math.round(ctx.a * 100) / 100)) {
    				prop_dev(input, "value", input_value_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}

    			run_all(dispose);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block_4.name, type: "if", source: "(354:10) {#if !disableAlpha}", ctx });
    	return block;
    }

    // (302:10) {#if !disableAlpha}
    function create_if_block_2(ctx) {
    	var div, input, input_value_value, t, label, dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			input = element("input");
    			t = space();
    			label = element("label");
    			label.textContent = "a";
    			attr_dev(input, "id", "alpha-input");
    			attr_dev(input, "class", "rgba svelte-1h9seex");
    			attr_dev(input, "type", "text");
    			input.value = input_value_value = Math.round(ctx.a * 100) / 100;
    			attr_dev(input, "maxlength", 4);
    			add_location(input, file$5, 303, 14, 7067);
    			attr_dev(label, "for", "alpha-input");
    			attr_dev(label, "class", "svelte-1h9seex");
    			add_location(label, file$5, 312, 14, 7403);
    			attr_dev(div, "class", "input-wrap svelte-1h9seex");
    			add_location(div, file$5, 302, 12, 7028);

    			dispose = [
    				listen_dev(input, "keypress", ctx.onlyNumbersAndDot),
    				listen_dev(input, "input", ctx.input_handler_6)
    			];
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, input);
    			append_dev(div, t);
    			append_dev(div, label);
    		},

    		p: function update_1(changed, ctx) {
    			if ((changed.a) && input_value_value !== (input_value_value = Math.round(ctx.a * 100) / 100)) {
    				prop_dev(input, "value", input_value_value);
    			}
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div);
    			}

    			run_all(dispose);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_if_block_2.name, type: "if", source: "(302:10) {#if !disableAlpha}", ctx });
    	return block;
    }

    function create_fragment$5(ctx) {
    	var div10, div0, t0, div4, div1, t1, div3, div2, t2, t3, div9, div5, t4, div8, div6, t5, div7, current, dispose;

    	var saturationvalue = new SaturationValue({
    		props: {
    		h: ctx.h,
    		s: ctx.s,
    		v: ctx.v
    	},
    		$$inline: true
    	});
    	saturationvalue.$on("inputend", ctx.inputend_handler);
    	saturationvalue.$on("input", ctx.input_handler);

    	var colorsquare = new ColorSquare({
    		props: {
    		color: "rgba(" + ctx.r + ", " + ctx.g + ", " + ctx.b + ", " + ctx.a + ")"
    	},
    		$$inline: true
    	});

    	var hue = new Hue({
    		props: { h: ctx.h },
    		$$inline: true
    	});
    	hue.$on("input", ctx.input_handler_1);

    	var if_block0 = (!ctx.disableAlpha) && create_if_block_5(ctx);

    	function select_block_type(changed, ctx) {
    		if (ctx.fieldsIndex === 0) return create_if_block;
    		if (ctx.fieldsIndex === 1) return create_if_block_1;
    		if (ctx.fieldsIndex === 2) return create_if_block_3;
    	}

    	var current_block_type = select_block_type(null, ctx);
    	var if_block1 = current_block_type && current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div10 = element("div");
    			div0 = element("div");
    			saturationvalue.$$.fragment.c();
    			t0 = space();
    			div4 = element("div");
    			div1 = element("div");
    			colorsquare.$$.fragment.c();
    			t1 = space();
    			div3 = element("div");
    			div2 = element("div");
    			hue.$$.fragment.c();
    			t2 = space();
    			if (if_block0) if_block0.c();
    			t3 = space();
    			div9 = element("div");
    			div5 = element("div");
    			if (if_block1) if_block1.c();
    			t4 = space();
    			div8 = element("div");
    			div6 = element("div");
    			t5 = space();
    			div7 = element("div");
    			attr_dev(div0, "class", "saturation-value-wrap");
    			add_location(div0, file$5, 225, 2, 4587);
    			attr_dev(div1, "class", "square-wrap svelte-1h9seex");
    			add_location(div1, file$5, 231, 4, 4875);
    			attr_dev(div2, "class", "hue-wrap");
    			add_location(div2, file$5, 236, 6, 4999);
    			attr_dev(div3, "class", "sliders svelte-1h9seex");
    			add_location(div3, file$5, 235, 4, 4971);
    			attr_dev(div4, "class", "sliders-and-square svelte-1h9seex");
    			add_location(div4, file$5, 229, 2, 4837);
    			attr_dev(div5, "class", "inputs-wrap svelte-1h9seex");
    			add_location(div5, file$5, 250, 4, 5321);
    			attr_dev(div6, "class", "changer-up svelte-1h9seex");
    			add_location(div6, file$5, 372, 6, 9391);
    			attr_dev(div7, "class", "changer-down svelte-1h9seex");
    			add_location(div7, file$5, 373, 6, 9507);
    			attr_dev(div8, "class", "changer-wrap svelte-1h9seex");
    			set_style(div8, "display", "none");
    			add_location(div8, file$5, 371, 4, 9335);
    			attr_dev(div9, "class", "inputs-and-changer svelte-1h9seex");
    			add_location(div9, file$5, 248, 2, 5283);
    			attr_dev(div10, "class", "color-picker svelte-1h9seex");
    			add_location(div10, file$5, 223, 0, 4557);

    			dispose = [
    				listen_dev(div6, "click", ctx.click_handler),
    				listen_dev(div7, "click", ctx.click_handler_1)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div10, anchor);
    			append_dev(div10, div0);
    			mount_component(saturationvalue, div0, null);
    			append_dev(div10, t0);
    			append_dev(div10, div4);
    			append_dev(div4, div1);
    			mount_component(colorsquare, div1, null);
    			append_dev(div4, t1);
    			append_dev(div4, div3);
    			append_dev(div3, div2);
    			mount_component(hue, div2, null);
    			append_dev(div3, t2);
    			if (if_block0) if_block0.m(div3, null);
    			append_dev(div10, t3);
    			append_dev(div10, div9);
    			append_dev(div9, div5);
    			if (if_block1) if_block1.m(div5, null);
    			append_dev(div9, t4);
    			append_dev(div9, div8);
    			append_dev(div8, div6);
    			append_dev(div8, t5);
    			append_dev(div8, div7);
    			current = true;
    		},

    		p: function update_1(changed, ctx) {
    			var saturationvalue_changes = {};
    			if (changed.h) saturationvalue_changes.h = ctx.h;
    			if (changed.s) saturationvalue_changes.s = ctx.s;
    			if (changed.v) saturationvalue_changes.v = ctx.v;
    			saturationvalue.$set(saturationvalue_changes);

    			var colorsquare_changes = {};
    			if (changed.r || changed.g || changed.b || changed.a) colorsquare_changes.color = "rgba(" + ctx.r + ", " + ctx.g + ", " + ctx.b + ", " + ctx.a + ")";
    			colorsquare.$set(colorsquare_changes);

    			var hue_changes = {};
    			if (changed.h) hue_changes.h = ctx.h;
    			hue.$set(hue_changes);

    			if (!ctx.disableAlpha) {
    				if (if_block0) {
    					if_block0.p(changed, ctx);
    					transition_in(if_block0, 1);
    				} else {
    					if_block0 = create_if_block_5(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(div3, null);
    				}
    			} else if (if_block0) {
    				group_outros();
    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});
    				check_outros();
    			}

    			if (current_block_type === (current_block_type = select_block_type(changed, ctx)) && if_block1) {
    				if_block1.p(changed, ctx);
    			} else {
    				if (if_block1) if_block1.d(1);
    				if_block1 = current_block_type && current_block_type(ctx);
    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div5, null);
    				}
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(saturationvalue.$$.fragment, local);

    			transition_in(colorsquare.$$.fragment, local);

    			transition_in(hue.$$.fragment, local);

    			transition_in(if_block0);
    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(saturationvalue.$$.fragment, local);
    			transition_out(colorsquare.$$.fragment, local);
    			transition_out(hue.$$.fragment, local);
    			transition_out(if_block0);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div10);
    			}

    			destroy_component(saturationvalue);

    			destroy_component(colorsquare);

    			destroy_component(hue);

    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			run_all(dispose);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$5.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();

      // RED
      let { h = 0, s = 1, v = 1, l = 0.5, r = 255, g = 0, b = 0, hex = "#ff0000", a = 1, color } = $$props;

      let { startColor = "#ff0000", disableAlpha = false } = $$props;

      let fieldsIndex = 0;

      const setColor = (args) => update(args, false);

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

        $$invalidate('r', r = args.r != null ? args.r : _rgba.r);
        $$invalidate('g', g = args.g != null ? args.g : _rgba.g);
        $$invalidate('b', b = args.b != null ? args.b : _rgba.b);
        $$invalidate('h', h = args.h != null ? args.h : _hsla.h);
        $$invalidate('s', s = args.s != null ? args.s : _hsla.s);
        $$invalidate('l', l = args.l != null ? args.l : _hsla.l);
        $$invalidate('v', v = args.v != null ? args.v : _hsva.v);
        $$invalidate('a', a = args.a != null ? args.a : _rgba.a);
        $$invalidate('hex', hex = format === "hex" ? args : _hex);

        dispatch && dispatchInput(hex);
      };

      const updateAlpha = (alpha) => {
        if(isNaN(alpha) || alpha < 0 || alpha > 1)
          return;

        $$invalidate('a', a = alpha);
        dispatchInput();
      };

      const dispatchInput = (hex = undefined) => {
        dispatch("input", typeof hex === 'string' ? hex : color.hex);
      };

      const onlyChars = (chars) => (event) => chars.indexOf(String.fromCharCode(event.charCode)) === -1 && event.preventDefault();
      const onlyNumbers = onlyChars("0123456789");
      const onlyNumbersAndDot = onlyChars("0123456789.");

      update(startColor, false);

    	const writable_props = ['h', 's', 'v', 'l', 'r', 'g', 'b', 'hex', 'a', 'color', 'startColor', 'disableAlpha'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<Chrome> was created with unknown prop '${key}'`);
    	});

    	const inputend_handler = (event) => update({h, s: event.detail.s, v: event.detail.v, a}, true);

    	const input_handler = (event) => update({h, s: event.detail.s, v: event.detail.v, a}, false);

    	const input_handler_1 = (event) => update({h: event.detail, s, v, a});

    	function alpha_a_binding(value) {
    		a = value;
    		$$invalidate('a', a);
    	}

    	const input_handler_2 = (event) => update(event.target.value);

    	const input_handler_3 = (event) => update({r: parseInt(event.target.value), g, b, a});

    	const input_handler_4 = (event) => update({r, g: parseInt(event.target.value), b, a});

    	const input_handler_5 = (event) => update({r, g, b: parseInt(event.target.value), a});

    	const input_handler_6 = (event) => updateAlpha(parseFloat(event.target.value));

    	const input_handler_7 = (event) => update({h: parseInt(event.target.value), s, l, a});

    	const input_handler_8 = (event) => update({h, s: parseFloat(event.target.value) / 100, l, a});

    	const input_handler_9 = (event) => update({h, s, l: parseFloat(event.target.value) / 100, a});

    	const input_handler_10 = (event) => updateAlpha(parseFloat(event.target.value));

    	const click_handler = () => $$invalidate('fieldsIndex', fieldsIndex = (fieldsIndex === 0 ? 2 : (fieldsIndex - 1) % 3));

    	const click_handler_1 = () => $$invalidate('fieldsIndex', fieldsIndex = (fieldsIndex + 1) % 3);

    	$$self.$set = $$props => {
    		if ('h' in $$props) $$invalidate('h', h = $$props.h);
    		if ('s' in $$props) $$invalidate('s', s = $$props.s);
    		if ('v' in $$props) $$invalidate('v', v = $$props.v);
    		if ('l' in $$props) $$invalidate('l', l = $$props.l);
    		if ('r' in $$props) $$invalidate('r', r = $$props.r);
    		if ('g' in $$props) $$invalidate('g', g = $$props.g);
    		if ('b' in $$props) $$invalidate('b', b = $$props.b);
    		if ('hex' in $$props) $$invalidate('hex', hex = $$props.hex);
    		if ('a' in $$props) $$invalidate('a', a = $$props.a);
    		if ('color' in $$props) $$invalidate('color', color = $$props.color);
    		if ('startColor' in $$props) $$invalidate('startColor', startColor = $$props.startColor);
    		if ('disableAlpha' in $$props) $$invalidate('disableAlpha', disableAlpha = $$props.disableAlpha);
    	};

    	$$self.$capture_state = () => {
    		return { h, s, v, l, r, g, b, hex, a, color, startColor, disableAlpha, fieldsIndex };
    	};

    	$$self.$inject_state = $$props => {
    		if ('h' in $$props) $$invalidate('h', h = $$props.h);
    		if ('s' in $$props) $$invalidate('s', s = $$props.s);
    		if ('v' in $$props) $$invalidate('v', v = $$props.v);
    		if ('l' in $$props) $$invalidate('l', l = $$props.l);
    		if ('r' in $$props) $$invalidate('r', r = $$props.r);
    		if ('g' in $$props) $$invalidate('g', g = $$props.g);
    		if ('b' in $$props) $$invalidate('b', b = $$props.b);
    		if ('hex' in $$props) $$invalidate('hex', hex = $$props.hex);
    		if ('a' in $$props) $$invalidate('a', a = $$props.a);
    		if ('color' in $$props) $$invalidate('color', color = $$props.color);
    		if ('startColor' in $$props) $$invalidate('startColor', startColor = $$props.startColor);
    		if ('disableAlpha' in $$props) $$invalidate('disableAlpha', disableAlpha = $$props.disableAlpha);
    		if ('fieldsIndex' in $$props) $$invalidate('fieldsIndex', fieldsIndex = $$props.fieldsIndex);
    	};

    	$$self.$$.update = ($$dirty = { r: 1, g: 1, b: 1, h: 1, s: 1, l: 1, v: 1, a: 1, hex: 1 }) => {
    		if ($$dirty.r || $$dirty.g || $$dirty.b || $$dirty.h || $$dirty.s || $$dirty.l || $$dirty.v || $$dirty.a || $$dirty.hex) { $$invalidate('color', color = {r, g, b, h, s, l, v, a, hex}); }
    	};

    	return {
    		h,
    		s,
    		v,
    		l,
    		r,
    		g,
    		b,
    		hex,
    		a,
    		color,
    		startColor,
    		disableAlpha,
    		fieldsIndex,
    		setColor,
    		update,
    		updateAlpha,
    		dispatchInput,
    		onlyChars,
    		onlyNumbers,
    		onlyNumbersAndDot,
    		inputend_handler,
    		input_handler,
    		input_handler_1,
    		alpha_a_binding,
    		input_handler_2,
    		input_handler_3,
    		input_handler_4,
    		input_handler_5,
    		input_handler_6,
    		input_handler_7,
    		input_handler_8,
    		input_handler_9,
    		input_handler_10,
    		click_handler,
    		click_handler_1
    	};
    }

    class Chrome extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, ["h", "s", "v", "l", "r", "g", "b", "hex", "a", "color", "startColor", "disableAlpha", "setColor"]);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Chrome", options, id: create_fragment$5.name });

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.color === undefined && !('color' in props)) {
    			console.warn("<Chrome> was created without expected prop 'color'");
    		}
    	}

    	get h() {
    		return this.$$.ctx.h;
    	}

    	set h(h) {
    		this.$set({ h });
    		flush();
    	}

    	get s() {
    		return this.$$.ctx.s;
    	}

    	set s(s) {
    		this.$set({ s });
    		flush();
    	}

    	get v() {
    		return this.$$.ctx.v;
    	}

    	set v(v) {
    		this.$set({ v });
    		flush();
    	}

    	get l() {
    		return this.$$.ctx.l;
    	}

    	set l(l) {
    		this.$set({ l });
    		flush();
    	}

    	get r() {
    		return this.$$.ctx.r;
    	}

    	set r(r) {
    		this.$set({ r });
    		flush();
    	}

    	get g() {
    		return this.$$.ctx.g;
    	}

    	set g(g) {
    		this.$set({ g });
    		flush();
    	}

    	get b() {
    		return this.$$.ctx.b;
    	}

    	set b(b) {
    		this.$set({ b });
    		flush();
    	}

    	get hex() {
    		return this.$$.ctx.hex;
    	}

    	set hex(hex) {
    		this.$set({ hex });
    		flush();
    	}

    	get a() {
    		return this.$$.ctx.a;
    	}

    	set a(a) {
    		this.$set({ a });
    		flush();
    	}

    	get color() {
    		return this.$$.ctx.color;
    	}

    	set color(color) {
    		this.$set({ color });
    		flush();
    	}

    	get startColor() {
    		return this.$$.ctx.startColor;
    	}

    	set startColor(startColor) {
    		this.$set({ startColor });
    		flush();
    	}

    	get disableAlpha() {
    		return this.$$.ctx.disableAlpha;
    	}

    	set disableAlpha(disableAlpha) {
    		this.$set({ disableAlpha });
    		flush();
    	}

    	get setColor() {
    		return this.$$.ctx.setColor;
    	}

    	set setColor(value) {
    		throw new Error("<Chrome>: Cannot set read-only property 'setColor'");
    	}
    }

    /* ChromeSlim.svelte generated by Svelte v3.12.1 */

    const file$6 = "ChromeSlim.svelte";

    function create_fragment$6(ctx) {
    	var div8, div3, div0, t0, div2, div1, div3_class_value, t1, div7, div4, t2, div6, div5, input, current, dispose;

    	var saturationvalue = new SaturationValue({
    		props: {
    		h: ctx.h,
    		s: ctx.s,
    		v: ctx.v
    	},
    		$$inline: true
    	});
    	saturationvalue.$on("inputend", ctx.inputend_handler);
    	saturationvalue.$on("input", ctx.input_handler);

    	var hue = new Hue({
    		props: { h: ctx.h },
    		$$inline: true
    	});
    	hue.$on("input", ctx.input_handler_1);

    	var colorsquare = new ColorSquare({
    		props: {
    		color: "rgba(" + ctx.r + ", " + ctx.g + ", " + ctx.b + ", " + ctx.a + ")"
    	},
    		$$inline: true
    	});

    	const block = {
    		c: function create() {
    			div8 = element("div");
    			div3 = element("div");
    			div0 = element("div");
    			saturationvalue.$$.fragment.c();
    			t0 = space();
    			div2 = element("div");
    			div1 = element("div");
    			hue.$$.fragment.c();
    			t1 = space();
    			div7 = element("div");
    			div4 = element("div");
    			colorsquare.$$.fragment.c();
    			t2 = space();
    			div6 = element("div");
    			div5 = element("div");
    			input = element("input");
    			attr_dev(div0, "class", "saturation-value-wrap svelte-1a0e07e");
    			add_location(div0, file$6, 254, 8, 5572);
    			attr_dev(div1, "class", "hue-wrap");
    			add_location(div1, file$6, 260, 12, 5891);
    			attr_dev(div2, "class", "sliders svelte-1a0e07e");
    			add_location(div2, file$6, 259, 8, 5857);
    			attr_dev(div3, "class", div3_class_value = "extras " + ctx.displayValue + " svelte-1a0e07e");
    			add_location(div3, file$6, 253, 4, 5528);
    			attr_dev(div4, "class", "square-wrap svelte-1a0e07e");
    			add_location(div4, file$6, 268, 8, 6086);
    			attr_dev(input, "id", "hex-input");
    			attr_dev(input, "class", "hex svelte-1a0e07e");
    			attr_dev(input, "type", "text");
    			input.value = ctx.hex;
    			attr_dev(input, "maxlength", 7);
    			add_location(input, file$6, 274, 16, 6319);
    			attr_dev(div5, "class", "input-wrap hex-wrap svelte-1a0e07e");
    			add_location(div5, file$6, 273, 12, 6269);
    			attr_dev(div6, "class", "inputs-wrap svelte-1a0e07e");
    			add_location(div6, file$6, 272, 8, 6231);
    			attr_dev(div7, "class", "square-and-input svelte-1a0e07e");
    			add_location(div7, file$6, 266, 4, 6046);
    			attr_dev(div8, "class", "color-picker svelte-1a0e07e");
    			add_location(div8, file$6, 251, 0, 5496);

    			dispose = [
    				listen_dev(div4, "click", ctx.click_handler),
    				listen_dev(input, "keypress", ctx.onlyChars("#0123456789abcdefABCFDEF")),
    				listen_dev(input, "input", ctx.input_handler_2)
    			];
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			insert_dev(target, div8, anchor);
    			append_dev(div8, div3);
    			append_dev(div3, div0);
    			mount_component(saturationvalue, div0, null);
    			append_dev(div3, t0);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			mount_component(hue, div1, null);
    			append_dev(div8, t1);
    			append_dev(div8, div7);
    			append_dev(div7, div4);
    			mount_component(colorsquare, div4, null);
    			append_dev(div7, t2);
    			append_dev(div7, div6);
    			append_dev(div6, div5);
    			append_dev(div5, input);
    			current = true;
    		},

    		p: function update_1(changed, ctx) {
    			var saturationvalue_changes = {};
    			if (changed.h) saturationvalue_changes.h = ctx.h;
    			if (changed.s) saturationvalue_changes.s = ctx.s;
    			if (changed.v) saturationvalue_changes.v = ctx.v;
    			saturationvalue.$set(saturationvalue_changes);

    			var hue_changes = {};
    			if (changed.h) hue_changes.h = ctx.h;
    			hue.$set(hue_changes);

    			if ((!current || changed.displayValue) && div3_class_value !== (div3_class_value = "extras " + ctx.displayValue + " svelte-1a0e07e")) {
    				attr_dev(div3, "class", div3_class_value);
    			}

    			var colorsquare_changes = {};
    			if (changed.r || changed.g || changed.b || changed.a) colorsquare_changes.color = "rgba(" + ctx.r + ", " + ctx.g + ", " + ctx.b + ", " + ctx.a + ")";
    			colorsquare.$set(colorsquare_changes);

    			if (!current || changed.hex) {
    				prop_dev(input, "value", ctx.hex);
    			}
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(saturationvalue.$$.fragment, local);

    			transition_in(hue.$$.fragment, local);

    			transition_in(colorsquare.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(saturationvalue.$$.fragment, local);
    			transition_out(hue.$$.fragment, local);
    			transition_out(colorsquare.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			if (detaching) {
    				detach_dev(div8);
    			}

    			destroy_component(saturationvalue);

    			destroy_component(hue);

    			destroy_component(colorsquare);

    			run_all(dispose);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$6.name, type: "component", source: "", ctx });
    	return block;
    }

    let fieldsIndex = 0;

    function instance$6($$self, $$props, $$invalidate) {
    	const dispatch = createEventDispatcher();

      // RED
      let { h = 0, s = 1, v = 1, l = 0.5, r = 255, g = 0, b = 0, hex = "#ff0000", a = 1, color } = $$props;

      let { startColor = "#ff0000", disableAlpha = false } = $$props;

      let { expanded = false } = $$props;
      const updateExpanded = () => {
        $$invalidate('expanded', expanded = !expanded);
      };

      const setColor = (args) => update(args, false);

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

        $$invalidate('r', r = args.r != null ? args.r : _rgba.r);
        $$invalidate('g', g = args.g != null ? args.g : _rgba.g);
        $$invalidate('b', b = args.b != null ? args.b : _rgba.b);
        $$invalidate('h', h = args.h != null ? args.h : _hsla.h);
        $$invalidate('s', s = args.s != null ? args.s : _hsla.s);
        $$invalidate('l', l = args.l != null ? args.l : _hsla.l);
        $$invalidate('v', v = args.v != null ? args.v : _hsva.v);
        $$invalidate('a', a = args.a != null ? args.a : _rgba.a);
        $$invalidate('hex', hex = format === "hex" ? args : _hex);

        dispatch && dispatchInput(hex);
      };

      const dispatchInput = (hex = undefined) => {
        dispatch("input", typeof hex === 'string' ? hex : color.hex);
      };

      const onlyChars = (chars) => (event) => chars.indexOf(String.fromCharCode(event.charCode)) === -1 && event.preventDefault();

      update(startColor, false);

    	const writable_props = ['h', 's', 'v', 'l', 'r', 'g', 'b', 'hex', 'a', 'color', 'startColor', 'disableAlpha', 'expanded'];
    	Object.keys($$props).forEach(key => {
    		if (!writable_props.includes(key) && !key.startsWith('$$')) console.warn(`<ChromeSlim> was created with unknown prop '${key}'`);
    	});

    	const inputend_handler = (event) => update({h, s: event.detail.s, v: event.detail.v, a}, true);

    	const input_handler = (event) => update({h, s: event.detail.s, v: event.detail.v, a}, false);

    	const input_handler_1 = (event) => update({h: event.detail, s, v, a});

    	const click_handler = () => updateExpanded();

    	const input_handler_2 = (event) => update(event.target.value);

    	$$self.$set = $$props => {
    		if ('h' in $$props) $$invalidate('h', h = $$props.h);
    		if ('s' in $$props) $$invalidate('s', s = $$props.s);
    		if ('v' in $$props) $$invalidate('v', v = $$props.v);
    		if ('l' in $$props) $$invalidate('l', l = $$props.l);
    		if ('r' in $$props) $$invalidate('r', r = $$props.r);
    		if ('g' in $$props) $$invalidate('g', g = $$props.g);
    		if ('b' in $$props) $$invalidate('b', b = $$props.b);
    		if ('hex' in $$props) $$invalidate('hex', hex = $$props.hex);
    		if ('a' in $$props) $$invalidate('a', a = $$props.a);
    		if ('color' in $$props) $$invalidate('color', color = $$props.color);
    		if ('startColor' in $$props) $$invalidate('startColor', startColor = $$props.startColor);
    		if ('disableAlpha' in $$props) $$invalidate('disableAlpha', disableAlpha = $$props.disableAlpha);
    		if ('expanded' in $$props) $$invalidate('expanded', expanded = $$props.expanded);
    	};

    	$$self.$capture_state = () => {
    		return { h, s, v, l, r, g, b, hex, a, color, startColor, disableAlpha, fieldsIndex, expanded, displayValue };
    	};

    	$$self.$inject_state = $$props => {
    		if ('h' in $$props) $$invalidate('h', h = $$props.h);
    		if ('s' in $$props) $$invalidate('s', s = $$props.s);
    		if ('v' in $$props) $$invalidate('v', v = $$props.v);
    		if ('l' in $$props) $$invalidate('l', l = $$props.l);
    		if ('r' in $$props) $$invalidate('r', r = $$props.r);
    		if ('g' in $$props) $$invalidate('g', g = $$props.g);
    		if ('b' in $$props) $$invalidate('b', b = $$props.b);
    		if ('hex' in $$props) $$invalidate('hex', hex = $$props.hex);
    		if ('a' in $$props) $$invalidate('a', a = $$props.a);
    		if ('color' in $$props) $$invalidate('color', color = $$props.color);
    		if ('startColor' in $$props) $$invalidate('startColor', startColor = $$props.startColor);
    		if ('disableAlpha' in $$props) $$invalidate('disableAlpha', disableAlpha = $$props.disableAlpha);
    		if ('fieldsIndex' in $$props) fieldsIndex = $$props.fieldsIndex;
    		if ('expanded' in $$props) $$invalidate('expanded', expanded = $$props.expanded);
    		if ('displayValue' in $$props) $$invalidate('displayValue', displayValue = $$props.displayValue);
    	};

    	let displayValue;

    	$$self.$$.update = ($$dirty = { r: 1, g: 1, b: 1, h: 1, s: 1, l: 1, v: 1, a: 1, hex: 1, expanded: 1 }) => {
    		if ($$dirty.r || $$dirty.g || $$dirty.b || $$dirty.h || $$dirty.s || $$dirty.l || $$dirty.v || $$dirty.a || $$dirty.hex) { $$invalidate('color', color = {r, g, b, h, s, l, v, a, hex}); }
    		if ($$dirty.expanded) { $$invalidate('displayValue', displayValue = expanded ? 'visible' : ''); }
    	};

    	return {
    		h,
    		s,
    		v,
    		l,
    		r,
    		g,
    		b,
    		hex,
    		a,
    		color,
    		startColor,
    		disableAlpha,
    		expanded,
    		updateExpanded,
    		setColor,
    		update,
    		onlyChars,
    		displayValue,
    		inputend_handler,
    		input_handler,
    		input_handler_1,
    		click_handler,
    		input_handler_2
    	};
    }

    class ChromeSlim extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, ["h", "s", "v", "l", "r", "g", "b", "hex", "a", "color", "startColor", "disableAlpha", "expanded", "setColor"]);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "ChromeSlim", options, id: create_fragment$6.name });

    		const { ctx } = this.$$;
    		const props = options.props || {};
    		if (ctx.color === undefined && !('color' in props)) {
    			console.warn("<ChromeSlim> was created without expected prop 'color'");
    		}
    	}

    	get h() {
    		return this.$$.ctx.h;
    	}

    	set h(h) {
    		this.$set({ h });
    		flush();
    	}

    	get s() {
    		return this.$$.ctx.s;
    	}

    	set s(s) {
    		this.$set({ s });
    		flush();
    	}

    	get v() {
    		return this.$$.ctx.v;
    	}

    	set v(v) {
    		this.$set({ v });
    		flush();
    	}

    	get l() {
    		return this.$$.ctx.l;
    	}

    	set l(l) {
    		this.$set({ l });
    		flush();
    	}

    	get r() {
    		return this.$$.ctx.r;
    	}

    	set r(r) {
    		this.$set({ r });
    		flush();
    	}

    	get g() {
    		return this.$$.ctx.g;
    	}

    	set g(g) {
    		this.$set({ g });
    		flush();
    	}

    	get b() {
    		return this.$$.ctx.b;
    	}

    	set b(b) {
    		this.$set({ b });
    		flush();
    	}

    	get hex() {
    		return this.$$.ctx.hex;
    	}

    	set hex(hex) {
    		this.$set({ hex });
    		flush();
    	}

    	get a() {
    		return this.$$.ctx.a;
    	}

    	set a(a) {
    		this.$set({ a });
    		flush();
    	}

    	get color() {
    		return this.$$.ctx.color;
    	}

    	set color(color) {
    		this.$set({ color });
    		flush();
    	}

    	get startColor() {
    		return this.$$.ctx.startColor;
    	}

    	set startColor(startColor) {
    		this.$set({ startColor });
    		flush();
    	}

    	get disableAlpha() {
    		return this.$$.ctx.disableAlpha;
    	}

    	set disableAlpha(disableAlpha) {
    		this.$set({ disableAlpha });
    		flush();
    	}

    	get expanded() {
    		return this.$$.ctx.expanded;
    	}

    	set expanded(expanded) {
    		this.$set({ expanded });
    		flush();
    	}

    	get setColor() {
    		return this.$$.ctx.setColor;
    	}

    	set setColor(value) {
    		throw new Error("<ChromeSlim>: Cannot set read-only property 'setColor'");
    	}
    }

    /* Docs.svelte generated by Svelte v3.12.1 */

    const file$7 = "Docs.svelte";

    function create_fragment$7(ctx) {
    	var script, t0, div4, div0, t1, div3, header, div1, h1, t3, p0, t5, p1, t6, a0, t8, a1, t10, p2, t11, a2, t13, a3, t15, p3, code0, t17, div2, updating_r, updating_g, updating_b, updating_a, updating_h, updating_s, updating_l, updating_v, updating_hex, t18, label, t20, seccion, h20, t22, updating_r_1, updating_g_1, updating_b_1, updating_a_1, updating_h_1, updating_s_1, updating_l_1, updating_v_1, updating_hex_1, t23, h21, t25, pre, code1, t26_value = `<!-- my-component.svelte -->
<script>
  import ChromePicker from 'svelte-color/Chrome.svelte';
  // or "svelte-color/Chrome" for pre-compiled js

  let chrome;
  let color; // same as event.detail

  const handleInput = (event) => {
    {r, g, b, h, s, l, v, a, hex} = event.detail;
    /*
      r: red          Number 0-255,
      g: green        Number 0-255,
      b: blue         Number 0-255,
      h: hue          Number 0-359,
      s: saturation   Number 0-1
      l: lightness    Number 0-1
      v: value        Number 0-1
      a: alpha        Number 0-1
      hex: hex        String (starting with #)
    */
  }

  function setColor(){
    // setColor accepts any value
    // that tinycolor2 accepts
    // use this method, do not do chrome.color = "red"
    // startColor accepts the same values
    chrome.setColor("red");
    chrome.setColor("#fff")
    chrome.setColor("#ffffff")
    chrome.setColor("rgb(255, 255, 255, 1)")
    chrome.setColor("rgba(255, 255, 255 ,1)")
    chrome.setColor("hsv(359, 100%, 100%, 1)")
    chrome.setColor("hsva(359, 100%, 100%, 1)")
    chrome.setColor({r: 255, g: 255, b: 255, a?: 1});
    chrome.setColor({h: 359, s: 1, l: 1, a?: 1});
    chrome.setColor({h: 359, s: 1, v: 1, a?: 1});
  }

</script>

<ChromePicker
  class="classes to add to the root element"
  bind:color
  bind:this={chrome}
  startColor="red"
  disableAlpha={false} // default
  on:input={handleInput}
/>
<!--
  you can also bind
  specific props
  like bind:r={red} bind:h={hue}
-->
` + "", t26, current;

    	function chrome_1_r_binding(value) {
    		ctx.chrome_1_r_binding.call(null, value);
    		updating_r = true;
    		add_flush_callback(() => updating_r = false);
    	}

    	function chrome_1_g_binding(value_1) {
    		ctx.chrome_1_g_binding.call(null, value_1);
    		updating_g = true;
    		add_flush_callback(() => updating_g = false);
    	}

    	function chrome_1_b_binding(value_2) {
    		ctx.chrome_1_b_binding.call(null, value_2);
    		updating_b = true;
    		add_flush_callback(() => updating_b = false);
    	}

    	function chrome_1_a_binding(value_3) {
    		ctx.chrome_1_a_binding.call(null, value_3);
    		updating_a = true;
    		add_flush_callback(() => updating_a = false);
    	}

    	function chrome_1_h_binding(value_4) {
    		ctx.chrome_1_h_binding.call(null, value_4);
    		updating_h = true;
    		add_flush_callback(() => updating_h = false);
    	}

    	function chrome_1_s_binding(value_5) {
    		ctx.chrome_1_s_binding.call(null, value_5);
    		updating_s = true;
    		add_flush_callback(() => updating_s = false);
    	}

    	function chrome_1_l_binding(value_6) {
    		ctx.chrome_1_l_binding.call(null, value_6);
    		updating_l = true;
    		add_flush_callback(() => updating_l = false);
    	}

    	function chrome_1_v_binding(value_7) {
    		ctx.chrome_1_v_binding.call(null, value_7);
    		updating_v = true;
    		add_flush_callback(() => updating_v = false);
    	}

    	function chrome_1_hex_binding(value_8) {
    		ctx.chrome_1_hex_binding.call(null, value_8);
    		updating_hex = true;
    		add_flush_callback(() => updating_hex = false);
    	}

    	let chrome_1_props = {
    		disableAlpha: true,
    		startColor: "#0f0"
    	};
    	if (ctx.r !== void 0) {
    		chrome_1_props.r = ctx.r;
    	}
    	if (ctx.g !== void 0) {
    		chrome_1_props.g = ctx.g;
    	}
    	if (ctx.b !== void 0) {
    		chrome_1_props.b = ctx.b;
    	}
    	if (ctx.a !== void 0) {
    		chrome_1_props.a = ctx.a;
    	}
    	if (ctx.h !== void 0) {
    		chrome_1_props.h = ctx.h;
    	}
    	if (ctx.s !== void 0) {
    		chrome_1_props.s = ctx.s;
    	}
    	if (ctx.l !== void 0) {
    		chrome_1_props.l = ctx.l;
    	}
    	if (ctx.v !== void 0) {
    		chrome_1_props.v = ctx.v;
    	}
    	if (ctx.hex !== void 0) {
    		chrome_1_props.hex = ctx.hex;
    	}
    	var chrome_1 = new Chrome({ props: chrome_1_props, $$inline: true });

    	ctx.chrome_1_binding(chrome_1);
    	binding_callbacks.push(() => bind(chrome_1, 'r', chrome_1_r_binding));
    	binding_callbacks.push(() => bind(chrome_1, 'g', chrome_1_g_binding));
    	binding_callbacks.push(() => bind(chrome_1, 'b', chrome_1_b_binding));
    	binding_callbacks.push(() => bind(chrome_1, 'a', chrome_1_a_binding));
    	binding_callbacks.push(() => bind(chrome_1, 'h', chrome_1_h_binding));
    	binding_callbacks.push(() => bind(chrome_1, 's', chrome_1_s_binding));
    	binding_callbacks.push(() => bind(chrome_1, 'l', chrome_1_l_binding));
    	binding_callbacks.push(() => bind(chrome_1, 'v', chrome_1_v_binding));
    	binding_callbacks.push(() => bind(chrome_1, 'hex', chrome_1_hex_binding));

    	function chromeslim_r_binding(value_9) {
    		ctx.chromeslim_r_binding.call(null, value_9);
    		updating_r_1 = true;
    		add_flush_callback(() => updating_r_1 = false);
    	}

    	function chromeslim_g_binding(value_10) {
    		ctx.chromeslim_g_binding.call(null, value_10);
    		updating_g_1 = true;
    		add_flush_callback(() => updating_g_1 = false);
    	}

    	function chromeslim_b_binding(value_11) {
    		ctx.chromeslim_b_binding.call(null, value_11);
    		updating_b_1 = true;
    		add_flush_callback(() => updating_b_1 = false);
    	}

    	function chromeslim_a_binding(value_12) {
    		ctx.chromeslim_a_binding.call(null, value_12);
    		updating_a_1 = true;
    		add_flush_callback(() => updating_a_1 = false);
    	}

    	function chromeslim_h_binding(value_13) {
    		ctx.chromeslim_h_binding.call(null, value_13);
    		updating_h_1 = true;
    		add_flush_callback(() => updating_h_1 = false);
    	}

    	function chromeslim_s_binding(value_14) {
    		ctx.chromeslim_s_binding.call(null, value_14);
    		updating_s_1 = true;
    		add_flush_callback(() => updating_s_1 = false);
    	}

    	function chromeslim_l_binding(value_15) {
    		ctx.chromeslim_l_binding.call(null, value_15);
    		updating_l_1 = true;
    		add_flush_callback(() => updating_l_1 = false);
    	}

    	function chromeslim_v_binding(value_16) {
    		ctx.chromeslim_v_binding.call(null, value_16);
    		updating_v_1 = true;
    		add_flush_callback(() => updating_v_1 = false);
    	}

    	function chromeslim_hex_binding(value_17) {
    		ctx.chromeslim_hex_binding.call(null, value_17);
    		updating_hex_1 = true;
    		add_flush_callback(() => updating_hex_1 = false);
    	}

    	let chromeslim_props = {
    		disableAlpha: true,
    		startColor: "#0f0"
    	};
    	if (ctx.r !== void 0) {
    		chromeslim_props.r = ctx.r;
    	}
    	if (ctx.g !== void 0) {
    		chromeslim_props.g = ctx.g;
    	}
    	if (ctx.b !== void 0) {
    		chromeslim_props.b = ctx.b;
    	}
    	if (ctx.a !== void 0) {
    		chromeslim_props.a = ctx.a;
    	}
    	if (ctx.h !== void 0) {
    		chromeslim_props.h = ctx.h;
    	}
    	if (ctx.s !== void 0) {
    		chromeslim_props.s = ctx.s;
    	}
    	if (ctx.l !== void 0) {
    		chromeslim_props.l = ctx.l;
    	}
    	if (ctx.v !== void 0) {
    		chromeslim_props.v = ctx.v;
    	}
    	if (ctx.hex !== void 0) {
    		chromeslim_props.hex = ctx.hex;
    	}
    	var chromeslim = new ChromeSlim({ props: chromeslim_props, $$inline: true });

    	ctx.chromeslim_binding(chromeslim);
    	binding_callbacks.push(() => bind(chromeslim, 'r', chromeslim_r_binding));
    	binding_callbacks.push(() => bind(chromeslim, 'g', chromeslim_g_binding));
    	binding_callbacks.push(() => bind(chromeslim, 'b', chromeslim_b_binding));
    	binding_callbacks.push(() => bind(chromeslim, 'a', chromeslim_a_binding));
    	binding_callbacks.push(() => bind(chromeslim, 'h', chromeslim_h_binding));
    	binding_callbacks.push(() => bind(chromeslim, 's', chromeslim_s_binding));
    	binding_callbacks.push(() => bind(chromeslim, 'l', chromeslim_l_binding));
    	binding_callbacks.push(() => bind(chromeslim, 'v', chromeslim_v_binding));
    	binding_callbacks.push(() => bind(chromeslim, 'hex', chromeslim_hex_binding));

    	const block = {
    		c: function create() {
    			script = element("script");
    			t0 = space();
    			div4 = element("div");
    			div0 = element("div");
    			t1 = space();
    			div3 = element("div");
    			header = element("header");
    			div1 = element("div");
    			h1 = element("h1");
    			h1.textContent = "FNOEX - Svelte Color";
    			t3 = space();
    			p0 = element("p");
    			p0.textContent = "A Collection of Color Pickers for Svelte (and vanilla js) hand-modified for FNOEX.";
    			t5 = space();
    			p1 = element("p");
    			t6 = text("Inspired by the excelents ");
    			a0 = element("a");
    			a0.textContent = "Vue Color";
    			t8 = text(" and ");
    			a1 = element("a");
    			a1.textContent = "React Color";
    			t10 = space();
    			p2 = element("p");
    			t11 = text("Available in ");
    			a2 = element("a");
    			a2.textContent = "npm";
    			t13 = text(" and ");
    			a3 = element("a");
    			a3.textContent = "github";
    			t15 = space();
    			p3 = element("p");
    			code0 = element("code");
    			code0.textContent = "npm install svelte-color";
    			t17 = space();
    			div2 = element("div");
    			chrome_1.$$.fragment.c();
    			t18 = space();
    			label = element("label");
    			label.textContent = "Chrome";
    			t20 = space();
    			seccion = element("seccion");
    			h20 = element("h2");
    			h20.textContent = "Slim Variant";
    			t22 = space();
    			chromeslim.$$.fragment.c();
    			t23 = space();
    			h21 = element("h2");
    			h21.textContent = "Usage";
    			t25 = space();
    			pre = element("pre");
    			code1 = element("code");
    			t26 = text(t26_value);
    			script.async = true;
    			script.defer = true;
    			attr_dev(script, "src", "prism.js");
    			attr_dev(script, "class", "svelte-8xiaml");
    			add_location(script, file$7, 1, 2, 16);
    			attr_dev(div0, "class", "docs-bg svelte-8xiaml");
    			attr_dev(div0, "style", ctx.style);
    			add_location(div0, file$7, 119, 2, 1669);
    			attr_dev(h1, "class", "svelte-8xiaml");
    			add_location(h1, file$7, 124, 8, 1794);
    			attr_dev(p0, "class", "svelte-8xiaml");
    			add_location(p0, file$7, 125, 8, 1832);
    			attr_dev(a0, "href", "http://vue-color.surge.sh/");
    			attr_dev(a0, "class", "svelte-8xiaml");
    			add_location(a0, file$7, 126, 37, 1959);
    			attr_dev(a1, "href", "https://casesandberg.github.io/react-color/");
    			attr_dev(a1, "class", "svelte-8xiaml");
    			add_location(a1, file$7, 126, 92, 2014);
    			attr_dev(p1, "class", "svelte-8xiaml");
    			add_location(p1, file$7, 126, 8, 1930);
    			attr_dev(a2, "href", "https://www.npmjs.com/package/svelte-color");
    			attr_dev(a2, "class", "svelte-8xiaml");
    			add_location(a2, file$7, 127, 24, 2112);
    			attr_dev(a3, "href", "https://github.com/ramiroaisen/svelte-color");
    			attr_dev(a3, "class", "svelte-8xiaml");
    			add_location(a3, file$7, 127, 89, 2177);
    			attr_dev(p2, "class", "svelte-8xiaml");
    			add_location(p2, file$7, 127, 8, 2096);
    			attr_dev(code0, "class", "svelte-8xiaml");
    			add_location(code0, file$7, 128, 11, 2257);
    			attr_dev(p3, "class", "svelte-8xiaml");
    			add_location(p3, file$7, 128, 8, 2254);
    			attr_dev(div1, "class", "main-text svelte-8xiaml");
    			add_location(div1, file$7, 123, 6, 1762);
    			attr_dev(label, "class", "chrome-label svelte-8xiaml");
    			add_location(label, file$7, 132, 8, 2493);
    			attr_dev(div2, "class", "main-picker svelte-8xiaml");
    			add_location(div2, file$7, 130, 6, 2318);
    			attr_dev(header, "class", "main svelte-8xiaml");
    			add_location(header, file$7, 122, 4, 1734);
    			attr_dev(h20, "class", "svelte-8xiaml");
    			add_location(h20, file$7, 138, 6, 2597);
    			attr_dev(h21, "class", "svelte-8xiaml");
    			add_location(h21, file$7, 142, 6, 2770);
    			attr_dev(code1, "class", "language-html svelte-8xiaml");
    			add_location(code1, file$7, 145, 8, 2806);
    			attr_dev(pre, "class", "svelte-8xiaml");
    			add_location(pre, file$7, 144, 6, 2792);
    			attr_dev(seccion, "class", "api svelte-8xiaml");
    			add_location(seccion, file$7, 136, 4, 2568);
    			attr_dev(div3, "class", "docs-in svelte-8xiaml");
    			add_location(div3, file$7, 120, 2, 1707);
    			attr_dev(div4, "class", "docs svelte-8xiaml");
    			add_location(div4, file$7, 118, 0, 1648);
    		},

    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},

    		m: function mount(target, anchor) {
    			append_dev(document.head, script);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, div0);
    			append_dev(div4, t1);
    			append_dev(div4, div3);
    			append_dev(div3, header);
    			append_dev(header, div1);
    			append_dev(div1, h1);
    			append_dev(div1, t3);
    			append_dev(div1, p0);
    			append_dev(div1, t5);
    			append_dev(div1, p1);
    			append_dev(p1, t6);
    			append_dev(p1, a0);
    			append_dev(p1, t8);
    			append_dev(p1, a1);
    			append_dev(div1, t10);
    			append_dev(div1, p2);
    			append_dev(p2, t11);
    			append_dev(p2, a2);
    			append_dev(p2, t13);
    			append_dev(p2, a3);
    			append_dev(div1, t15);
    			append_dev(div1, p3);
    			append_dev(p3, code0);
    			append_dev(header, t17);
    			append_dev(header, div2);
    			mount_component(chrome_1, div2, null);
    			append_dev(div2, t18);
    			append_dev(div2, label);
    			append_dev(div3, t20);
    			append_dev(div3, seccion);
    			append_dev(seccion, h20);
    			append_dev(seccion, t22);
    			mount_component(chromeslim, seccion, null);
    			append_dev(seccion, t23);
    			append_dev(seccion, h21);
    			append_dev(seccion, t25);
    			append_dev(seccion, pre);
    			append_dev(pre, code1);
    			append_dev(code1, t26);
    			current = true;
    		},

    		p: function update_1(changed, ctx) {
    			if (!current || changed.style) {
    				attr_dev(div0, "style", ctx.style);
    			}

    			var chrome_1_changes = {};
    			if (!updating_r && changed.r) {
    				chrome_1_changes.r = ctx.r;
    			}
    			if (!updating_g && changed.g) {
    				chrome_1_changes.g = ctx.g;
    			}
    			if (!updating_b && changed.b) {
    				chrome_1_changes.b = ctx.b;
    			}
    			if (!updating_a && changed.a) {
    				chrome_1_changes.a = ctx.a;
    			}
    			if (!updating_h && changed.h) {
    				chrome_1_changes.h = ctx.h;
    			}
    			if (!updating_s && changed.s) {
    				chrome_1_changes.s = ctx.s;
    			}
    			if (!updating_l && changed.l) {
    				chrome_1_changes.l = ctx.l;
    			}
    			if (!updating_v && changed.v) {
    				chrome_1_changes.v = ctx.v;
    			}
    			if (!updating_hex && changed.hex) {
    				chrome_1_changes.hex = ctx.hex;
    			}
    			chrome_1.$set(chrome_1_changes);

    			var chromeslim_changes = {};
    			if (!updating_r_1 && changed.r) {
    				chromeslim_changes.r = ctx.r;
    			}
    			if (!updating_g_1 && changed.g) {
    				chromeslim_changes.g = ctx.g;
    			}
    			if (!updating_b_1 && changed.b) {
    				chromeslim_changes.b = ctx.b;
    			}
    			if (!updating_a_1 && changed.a) {
    				chromeslim_changes.a = ctx.a;
    			}
    			if (!updating_h_1 && changed.h) {
    				chromeslim_changes.h = ctx.h;
    			}
    			if (!updating_s_1 && changed.s) {
    				chromeslim_changes.s = ctx.s;
    			}
    			if (!updating_l_1 && changed.l) {
    				chromeslim_changes.l = ctx.l;
    			}
    			if (!updating_v_1 && changed.v) {
    				chromeslim_changes.v = ctx.v;
    			}
    			if (!updating_hex_1 && changed.hex) {
    				chromeslim_changes.hex = ctx.hex;
    			}
    			chromeslim.$set(chromeslim_changes);
    		},

    		i: function intro(local) {
    			if (current) return;
    			transition_in(chrome_1.$$.fragment, local);

    			transition_in(chromeslim.$$.fragment, local);

    			current = true;
    		},

    		o: function outro(local) {
    			transition_out(chrome_1.$$.fragment, local);
    			transition_out(chromeslim.$$.fragment, local);
    			current = false;
    		},

    		d: function destroy(detaching) {
    			detach_dev(script);

    			if (detaching) {
    				detach_dev(t0);
    				detach_dev(div4);
    			}

    			ctx.chrome_1_binding(null);

    			destroy_component(chrome_1);

    			ctx.chromeslim_binding(null);

    			destroy_component(chromeslim);
    		}
    	};
    	dispatch_dev("SvelteRegisterBlock", { block, id: create_fragment$7.name, type: "component", source: "", ctx });
    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	
      // import Hue from "./Hue.svelte";
      // import Alpha from "./Alpha.svelte";

      let r;
      let g;
      let b;
      let h;
      let s;
      let v;
      let l;
      let a;
      let hex;

      let chrome;

    	function chrome_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			$$invalidate('chrome', chrome = $$value);
    		});
    	}

    	function chrome_1_r_binding(value) {
    		r = value;
    		$$invalidate('r', r);
    	}

    	function chrome_1_g_binding(value_1) {
    		g = value_1;
    		$$invalidate('g', g);
    	}

    	function chrome_1_b_binding(value_2) {
    		b = value_2;
    		$$invalidate('b', b);
    	}

    	function chrome_1_a_binding(value_3) {
    		a = value_3;
    		$$invalidate('a', a);
    	}

    	function chrome_1_h_binding(value_4) {
    		h = value_4;
    		$$invalidate('h', h);
    	}

    	function chrome_1_s_binding(value_5) {
    		s = value_5;
    		$$invalidate('s', s);
    	}

    	function chrome_1_l_binding(value_6) {
    		l = value_6;
    		$$invalidate('l', l);
    	}

    	function chrome_1_v_binding(value_7) {
    		v = value_7;
    		$$invalidate('v', v);
    	}

    	function chrome_1_hex_binding(value_8) {
    		hex = value_8;
    		$$invalidate('hex', hex);
    	}

    	function chromeslim_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			$$invalidate('chrome', chrome = $$value);
    		});
    	}

    	function chromeslim_r_binding(value_9) {
    		r = value_9;
    		$$invalidate('r', r);
    	}

    	function chromeslim_g_binding(value_10) {
    		g = value_10;
    		$$invalidate('g', g);
    	}

    	function chromeslim_b_binding(value_11) {
    		b = value_11;
    		$$invalidate('b', b);
    	}

    	function chromeslim_a_binding(value_12) {
    		a = value_12;
    		$$invalidate('a', a);
    	}

    	function chromeslim_h_binding(value_13) {
    		h = value_13;
    		$$invalidate('h', h);
    	}

    	function chromeslim_s_binding(value_14) {
    		s = value_14;
    		$$invalidate('s', s);
    	}

    	function chromeslim_l_binding(value_15) {
    		l = value_15;
    		$$invalidate('l', l);
    	}

    	function chromeslim_v_binding(value_16) {
    		v = value_16;
    		$$invalidate('v', v);
    	}

    	function chromeslim_hex_binding(value_17) {
    		hex = value_17;
    		$$invalidate('hex', hex);
    	}

    	$$self.$capture_state = () => {
    		return {};
    	};

    	$$self.$inject_state = $$props => {
    		if ('r' in $$props) $$invalidate('r', r = $$props.r);
    		if ('g' in $$props) $$invalidate('g', g = $$props.g);
    		if ('b' in $$props) $$invalidate('b', b = $$props.b);
    		if ('h' in $$props) $$invalidate('h', h = $$props.h);
    		if ('s' in $$props) $$invalidate('s', s = $$props.s);
    		if ('v' in $$props) $$invalidate('v', v = $$props.v);
    		if ('l' in $$props) $$invalidate('l', l = $$props.l);
    		if ('a' in $$props) $$invalidate('a', a = $$props.a);
    		if ('hex' in $$props) $$invalidate('hex', hex = $$props.hex);
    		if ('chrome' in $$props) $$invalidate('chrome', chrome = $$props.chrome);
    		if ('style' in $$props) $$invalidate('style', style = $$props.style);
    	};

    	let style;

    	$$self.$$.update = ($$dirty = { r: 1, g: 1, b: 1 }) => {
    		if ($$dirty.r || $$dirty.g || $$dirty.b) { $$invalidate('style', style = `background-color: rgba(${r}, ${g}, ${b}, 0.5)`); }
    	};

    	return {
    		r,
    		g,
    		b,
    		h,
    		s,
    		v,
    		l,
    		a,
    		hex,
    		chrome,
    		style,
    		chrome_1_binding,
    		chrome_1_r_binding,
    		chrome_1_g_binding,
    		chrome_1_b_binding,
    		chrome_1_a_binding,
    		chrome_1_h_binding,
    		chrome_1_s_binding,
    		chrome_1_l_binding,
    		chrome_1_v_binding,
    		chrome_1_hex_binding,
    		chromeslim_binding,
    		chromeslim_r_binding,
    		chromeslim_g_binding,
    		chromeslim_b_binding,
    		chromeslim_a_binding,
    		chromeslim_h_binding,
    		chromeslim_s_binding,
    		chromeslim_l_binding,
    		chromeslim_v_binding,
    		chromeslim_hex_binding
    	};
    }

    class Docs extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, []);
    		dispatch_dev("SvelteRegisterComponent", { component: this, tagName: "Docs", options, id: create_fragment$7.name });
    	}
    }

    const docs = new Docs({target: document.body});

}());
//# sourceMappingURL=bundle.js.map
