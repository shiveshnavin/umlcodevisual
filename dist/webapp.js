var App = function() {
    function App(nomnoml, codeMirror, saveAs, _) {
        var _this = this;
        this._ = _;
        this.signals = new Observable;
        this.on = this.signals.on;
        this.off = this.signals.off;
        var body = document.querySelector("body");
        var lineNumbers = document.getElementById("linenumbers");
        var lineMarker = document.getElementById("linemarker");
        var textarea = document.getElementById("textarea");
        var canvasElement = document.getElementById("canvas");
        var canvasPanner = document.getElementById("canvas-panner");
        var canvasTools = document.getElementById("canvas-tools");
        this.editor = codeMirror.fromTextArea(textarea, {
            lineNumbers: true,
            mode: "nomnoml",
            matchBrackets: true,
            theme: "solarized light",
            keyMap: "sublime"
        });
        this.editor.on("drop", function(cm, dragEvent) {
            var files = dragEvent.dataTransfer.files;
            if (files[0].type == "image/svg+xml") {
                dragEvent.preventDefault();
                _this.handleOpeningFiles(files)
            }
        });
        var editorElement = this.editor.getWrapperElement();
        this.filesystem = new FileSystem;
        var devenv = new DevEnv(editorElement, lineMarker, lineNumbers);
        this.panner = new CanvasPanner(canvasPanner, function() {
            return _this.sourceChanged()
        }, _.throttle);
        this.downloader = new DownloadLinks(canvasElement, saveAs);
        new HoverMarker("canvas-mode", body, [canvasPanner, canvasTools]);
        new Tooltips(document.getElementById("tooltip"), document.querySelectorAll(".tools a"));
        this.defaultSource = (document.getElementById("defaultGraph") || {
            innerHTML: ""
        }).innerHTML;
        var lastValidSource = null;
        var reloadStorage = function() {
            lastValidSource = null;
            _this.filesystem.configureByRoute(location.hash);
            var source = _this.filesystem.storage.read() || "";
            _this.editor.setValue(source || _this.defaultSource);
            _this.sourceChanged()
        };
        window.addEventListener("hashchange", function() {
            return reloadStorage()
        });
        window.addEventListener("resize", _.throttle(function() {
            return _this.sourceChanged()
        }, 750, {
            leading: true
        }));
        this.editor.on("changes", _.debounce(function() {
            return _this.sourceChanged()
        }, 300));
        this.sourceChanged = function() {
            try {
                devenv.clearState();
                var source = _this.editor.getValue();
                var model = nomnoml.draw(canvasElement, source, _this.panner.zoom());
                lastValidSource = source;
                _this.panner.positionCanvas(canvasElement);
                _this.filesystem.storage.save(source);
                _this.downloader.source = source;
                _this.downloader.setFilename(model.config.title);
                _this.signals.trigger("source-changed", source)
            } catch (e) {
                devenv.setError(e);
                if (lastValidSource) {
                    nomnoml.draw(canvasElement, lastValidSource, _this.panner.zoom())
                }
                _this.panner.positionCanvas(canvasElement)
            }
        };
        reloadStorage()
    }
    App.prototype.loadSvg = function(svg) {
        var svgNodes = (new DOMParser).parseFromString(svg, "text/xml");
        if (svgNodes.getElementsByTagName("desc").length !== 1) {
            alert("SVG did not have nomnoml code embedded within it.");
            return
        }
        var code = svgNodes.getElementsByTagName("desc")[0].childNodes[0].nodeValue;
        code = this._.unescape(code);
        this.editor.setValue(code)
    };
    App.prototype.currentSource = function() {
        return this.editor.getValue()
    };
    App.prototype.magnifyViewport = function(diff) {
        this.panner.magnify(diff)
    };
    App.prototype.resetViewport = function() {
        this.panner.reset()
    };
    App.prototype.toggleSidebar = function(id) {
        var sidebars = ["about", "reference", "export", "files"];
        for (var _i = 0, sidebars_1 = sidebars; _i < sidebars_1.length; _i++) {
            var key = sidebars_1[_i];
            if (id !== key) document.getElementById(key).classList.remove("visible")
        }
        document.getElementById(id).classList.toggle("visible")
    };
    App.prototype.discardCurrentGraph = function() {
        if (confirm("Do you want to discard current diagram and load the default example?")) {
            this.editor.setValue(this.defaultSource);
            this.sourceChanged()
        }
    };
    App.prototype.saveViewModeToStorage = function() {
        var question = "Do you want to overwrite the diagram in " + "localStorage with the currently viewed diagram?";
        if (confirm(question)) {
            this.filesystem.moveToLocalStorage(this.currentSource());
            window.location.href = "./"
        }
    };
    App.prototype.exitViewMode = function() {
        window.location.href = "./"
    };
    App.prototype.handleOpeningFiles = function(files) {
        var _this = this;
        if (files.length !== 1) {
            alert("You can only upload one file at a time.");
            return
        }
        var reader = new FileReader;
        reader.onload = function() {
            return _this.loadSvg(reader.result)
        };
        reader.readAsText(files[0])
    };
    return App
}();
var CanvasPanner = function() {
    function CanvasPanner(element, onChange, throttle) {
        var _this = this;
        this.onChange = onChange;
        this.offset = {
            x: 0,
            y: 0
        };
        this.zoomLevel = 0;
        this.superSampling = window.devicePixelRatio || 1;
        var mouseDownPoint = false;

        function isVec(value) {
            return value != false
        }
        var mouseMove = function(e) {
            if (isVec(mouseDownPoint)) {
                _this.offset = nomnoml.skanaar.vector.diff({
                    x: e.pageX,
                    y: e.pageY
                }, mouseDownPoint);
                onChange()
            }
        };
        var mouseUp = function() {
            mouseDownPoint = false;
            element.style.width = "33%"
        };
        var magnify = function(e) {
            _this.zoomLevel = Math.min(10, _this.zoomLevel - (e.deltaY < 0 ? -1 : 1));
            onChange()
        };
        var mouseDown = function(e) {
            element.style.width = "100%";
            mouseDownPoint = nomnoml.skanaar.vector.diff({
                x: e.pageX,
                y: e.pageY
            }, _this.offset)
        };
        element.addEventListener("mousedown", mouseDown);
        element.addEventListener("mouseup", mouseUp);
        element.addEventListener("mouseleave", mouseUp);
        element.addEventListener("wheel", throttle(magnify, 50), {
            passive: true
        });
        element.addEventListener("mousemove", throttle(mouseMove, 50), {
            passive: true
        })
    }
    CanvasPanner.prototype.positionCanvas = function(element) {
        var viewport = window;
        var w = element.width / this.superSampling;
        var h = element.height / this.superSampling;
        element.style.top = 300 * (1 - h / viewport.innerHeight) + this.offset.y + "px";
        element.style.left = 150 + (viewport.innerWidth - w) / 2 + this.offset.x + "px";
        element.style.width = w + "px";
        element.style.height = h + "px"
    };
    CanvasPanner.prototype.zoom = function() {
        return this.superSampling * Math.exp(this.zoomLevel / 10)
    };
    CanvasPanner.prototype.magnify = function(diff) {
        this.zoomLevel = Math.min(10, this.zoomLevel + diff);
        this.onChange()
    };
    CanvasPanner.prototype.reset = function() {
        this.zoomLevel = 1;
        this.offset = {
            x: 0,
            y: 0
        };
        this.onChange()
    };
    return CanvasPanner
}();
var DevEnv = function() {
    function DevEnv(editor, marker, lineNumbers) {
        this.editor = editor;
        this.marker = marker;
        this.lineNumbers = lineNumbers
    }
    DevEnv.prototype.clearState = function() {
        this.marker.style.top = "-30px";
        this.lineNumbers.classList.remove("error")
    };
    DevEnv.prototype.setError = function(error) {
        this.lineNumbers.classList.add("error");
        var matches = error.message.match("line ([0-9]*)");
        if (matches) {
            var lineHeightValue = window.getComputedStyle(this.editor).lineHeight;
            var lineHeight = parseFloat(lineHeightValue) || 12;
            this.marker.style.top = 3 + lineHeight * +matches[1] + "px"
        } else {
            throw error
        }
    };
    return DevEnv
}();
var DownloadLinks = function() {
    function DownloadLinks(canvasElement, saveAs) {
        this.canvasElement = canvasElement;
        this.saveAs = saveAs;
        this.filename = "graph";
        this.source = ""
    }
    DownloadLinks.prototype.pngDownload = function() {
        var _this = this;
        var dynamic = this.canvasElement;
        if (!!dynamic.msToBlob) {
            this.saveAs(dynamic.msToBlob(), this.filename + ".png")
        } else {
            this.canvasElement.toBlob(function(blob) {
                return _this.saveAs(blob, _this.filename + ".png")
            })
        }
    };
    DownloadLinks.prototype.svgDownload = function() {
        var dynamic = nomnoml;
        var svg = dynamic.renderSvg(this.source, this.canvasElement);
        this.saveAs(new Blob([svg], {
            type: "image/svg+xml"
        }), this.filename + ".svg")
    };
    DownloadLinks.prototype.srcDownload = function() {
        var src = this.source;
        this.saveAs(new Blob([src], {
            type: "text/txt"
        }), this.filename + ".nomnoml")
    };
    DownloadLinks.prototype.setFilename = function(filename) {
        filename = filename || "graph";
        this.filename = filename
    };
    return DownloadLinks
}();
var __extends = this && this.__extends || function() {
    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || {
            __proto__: []
        }
        instanceof Array && function(d, b) {
            d.__proto__ = b
        } || function(d, b) {
            for (var p in b)
                if (b.hasOwnProperty(p)) d[p] = b[p]
        };
        return extendStatics(d, b)
    };
    return function(d, b) {
        extendStatics(d, b);

        function __() {
            this.constructor = d
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __)
    }
}();
var FileSystem = function() {
    function FileSystem() {
        this.signals = new Observable;
        this.on = this.signals.on;
        this.off = this.signals.off;
        this.storage = new DefaultGraphStore
    }
    FileSystem.prototype.files = function() {
        return JSON.parse(localStorage["nomnoml.file_index"] || "[]")
    };
    FileSystem.prototype.setFiles = function(index) {
        localStorage["nomnoml.file_index"] = JSON.stringify(index);
        this.signals.trigger("updated")
    };
    FileSystem.prototype.moveToFileStorage = function(name, source) {
        var entry = {
            name: name,
            date: (new Date).toISOString(),
            backingStore: "local_file"
        };
        var index = this.files();
        index.push(entry);
        index.sort(function(a, b) {
            return a.name.localeCompare(b.name)
        });
        localStorage["nomnoml.file_index"] = JSON.stringify(index);
        var fileStore = new LocalFileGraphStore(entry.name);
        fileStore.save(source);
        this.signals.trigger("updated")
    };
    FileSystem.prototype.moveToLocalStorage = function(source) {
        this.storage = new DefaultGraphStore;
        this.storage.save(source)
    };
    FileSystem.prototype.discard = function(entry) {
        var fileStore = new LocalFileGraphStore(entry.name);
        fileStore.clear();
        this.setFiles(this.files().filter(function(e) {
            return e.name != entry.name
        }));
        this.signals.trigger("updated")
    };
    FileSystem.prototype.configureByRoute = function(path) {
        var route = Route.from(path);
        this.storage = this.routedStorage(route);
        this.activeFile = nomnoml.skanaar.find(this.files(), function(e) {
            return e.name === route.path
        }) || {
            name: route.path,
            date: (new Date).toISOString(),
            backingStore: "local_file"
        };
        this.signals.trigger("updated")
    };
    FileSystem.prototype.routedStorage = function(route) {
        if (route.context === "view") {
            return new UrlGraphStore(decodeURIComponent(route.path))
        }
        if (route.context === "file") {
            return new LocalFileGraphStore(route.path)
        }
        return new DefaultGraphStore
    };
    return FileSystem
}();
var LocalGraphStore = function() {
    function LocalGraphStore(key) {
        this.key = key
    }
    LocalGraphStore.prototype.read = function() {
        return localStorage[this.key]
    };
    LocalGraphStore.prototype.save = function(source) {
        localStorage[this.key] = source
    };
    LocalGraphStore.prototype.clear = function() {
        localStorage.removeItem(this.key)
    };
    return LocalGraphStore
}();
var LocalFileGraphStore = function(_super) {
    __extends(LocalFileGraphStore, _super);

    function LocalFileGraphStore(key) {
        var _this = _super.call(this, "nomnoml.files/" + key) || this;
        _this.kind = "local_file";
        return _this
    }
    return LocalFileGraphStore
}(LocalGraphStore);
var DefaultGraphStore = function(_super) {
    __extends(DefaultGraphStore, _super);

    function DefaultGraphStore() {
        var _this = _super.call(this, "nomnoml.lastSource") || this;
        _this.kind = "local_default";
        return _this
    }
    return DefaultGraphStore
}(LocalGraphStore);
var UrlGraphStore = function() {
    function UrlGraphStore(source) {
        this.source = source;
        this.kind = "url"
    }
    UrlGraphStore.prototype.read = function() {
        return this.source
    };
    UrlGraphStore.prototype.save = function(source) {};
    UrlGraphStore.prototype.clear = function() {};
    return UrlGraphStore
}();
var HoverMarker = function() {
    function HoverMarker(className, elementToMark, hoverables) {
        function classToggler(state) {
            return function() {
                if (state) elementToMark.classList.add(className);
                else elementToMark.classList.remove(className)
            }
        }
        for (var _i = 0, hoverables_1 = hoverables; _i < hoverables_1.length; _i++) {
            var element = hoverables_1[_i];
            element.addEventListener("mouseenter", classToggler(true));
            element.addEventListener("mouseleave", classToggler(false))
        }
    }
    return HoverMarker
}();
var Observable = function() {
    function Observable() {
        this.callbacks = {}
    }
    Observable.prototype.on = function(event, fn) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = []
        }
        this.callbacks[event].push(fn)
    };
    Observable.prototype.off = function(event, fn) {
        var fns = this.callbacks[event];
        if (fns) {
            var index = fns.indexOf(fn);
            if (index !== -1) fns.splice(index, 1);
            if (fns.length === 0) delete this.callbacks[event]
        }
    };
    Observable.prototype.trigger = function(event) {
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i]
        }
        var fns = this.callbacks[event];
        if (fns) fns.forEach(function(fn) {
            return fn.apply(null, args)
        })
    };
    return Observable
}();
var Route = function() {
    function Route(context, path) {
        this.context = context;
        this.path = path
    }
    Route.from = function(hash) {
        var slashIndex = hash.indexOf("/");
        if (hash[0] == "#" && slashIndex > -1) {
            return {
                context: Route.urlDecode(hash.substr(1, slashIndex - 1)),
                path: Route.urlDecode(hash.substr(slashIndex + 1))
            }
        }
        return {
            context: null,
            path: null
        }
    };
    Route.urlEncode = function(unencoded) {
        return encodeURIComponent(unencoded).replace(/'/g, "%27").replace(/"/g, "%22")
    };
    Route.urlDecode = function(encoded) {
        return decodeURIComponent(encoded.replace(/\+/g, " "))
    };
    return Route
}();
var Tooltips = function() {
    function Tooltips(tooltip, links) {
        for (var i = 0; i < links.length; i++) {
            attach(links[i])
        }

        function attach(link) {
            link.onmouseover = function() {
                tooltip.textContent = link.getAttribute("title")
            };
            link.onmouseout = function() {
                tooltip.textContent = ""
            }
        }
    }
    return Tooltips
}();

function ensureType(template, obj) {
    if (Array.isArray(template)) {
        if (Array.isArray(obj)) {
            if (template.length == 0) {
                return obj
            } else {
                return obj.map(function(e) {
                    return ensureType(template[0], e)
                }).filter(function(e) {
                    return e !== undefined
                })
            }
        } else {
            return undefined
        }
    }
    if ("number" == typeof template) {
        return "number" == typeof obj ? obj : undefined
    }
    if ("string" == typeof template) {
        return "string" == typeof obj ? obj : undefined
    }
    if ("boolean" == typeof template) {
        return "boolean" == typeof obj ? obj : undefined
    }
    if ("object" == typeof template) {
        if ("object" == typeof obj) {
            for (var key in template) {
                if (ensureType(template[key], obj[key]) === undefined) return undefined
            }
            return obj
        }
    }
    return undefined
}

function assert(actual) {
    return {
        equal: function(expected) {
            equal(actual, expected)
        }
    }
}

function equal(a, b) {
    if (a === b) return;
    var as = JSON.stringify(a);
    var bs = JSON.stringify(b);
    if (as !== bs) throw new Error(as + " != " + bs)
}

function test_ensureType() {
    assert(ensureType([], [])).equal([]);
    assert(ensureType([], [0])).equal([0]);
    assert(ensureType([0], [])).equal([]);
    assert(ensureType([0], [0])).equal([0]);
    assert(ensureType({
        a: ""
    }, {
        a: ""
    })).equal({
        a: ""
    });
    assert(ensureType({
        a: ""
    }, {
        a: 0
    })).equal(undefined);
    assert(ensureType([{
        a: ""
    }], [{
        a: 0
    }])).equal([])
}

function ExportMenu(selector, app) {
    return new Vue({
        el: selector,
        data: {
            shareLink: ""
        },
        mounted: function() {
            var _this = this;
            app.signals.on("source-changed", function(src) {
                return _this.onSourceChange(src)
            });
            app.filesystem.signals.on("updated", function(src) {
                return _this.$forceUpdate()
            })
        },
        methods: {
            downloadPng: function() {
                app.downloader.pngDownload()
            },
            downloadSvg: function() {
                app.downloader.svgDownload()
            },
            downloadSrc: function() {
                app.downloader.srcDownload()
            },
            onSourceChange: function(src) {
                this.shareLink = "#view/" + Route.urlEncode(src)
            }
        }
    })
}

function FileMenu(selector, app) {
    return new Vue({
        el: selector,
        data: {
            source: ""
        },
        mounted: function() {
            var _this = this;
            app.signals.on("source-changed", function(src) {
                return _this.onSourceChange(src)
            });
            app.filesystem.signals.on("updated", function(src) {
                return _this.$forceUpdate()
            })
        },
        methods: {
            items: function() {
                return app.filesystem.files()
            },
            isActive: function(item) {
                return this.isLocalFile() && app.filesystem.activeFile.name === item.name
            },
            isLocalFile: function() {
                return app.filesystem.storage.kind === "local_file"
            },
            isAtHome: function() {
                return app.filesystem.storage.kind === "local_default"
            },
            itemPath: function(item) {
                return "#file/" + encodeURIComponent(item.name).replace(/%20/g, "+")
            },
            discard: function(item) {
                if (confirm('Permanently delete "' + item.name + '"')) app.filesystem.discard(item)
            },
            saveAs: function() {
                var name = prompt("Name your diagram");
                if (name) {
                    if (app.filesystem.files().some(function(e) {
                            return e.name === name
                        })) {
                        alert("A file named " + name + " already exists.");
                        return
                    }
                    app.filesystem.moveToFileStorage(name, app.currentSource());
                    location.href = "#file/" + encodeURIComponent(name)
                }
            },
            loadSvg: function(e) {
                var files = e.target.files;
                app.handleOpeningFiles(files)
            },
            onSourceChange: function(src) {
                this.source = src
            }
        }
    })
}
var icon = function() {
    var icons = {
        "link-outline": '<path d="M17.5 6c.3 0 .6.1.8.3.4.5.4 1.1 0 1.6l-1.7 1.7.3.3c.5.6.9 1.4.9 2.2s-.4 1.6-1 2.2l-4.1 4.2c-.6.5-1.4.9-2.2.9s-1.6-.4-2.2-1l-.3-.2-1.7 1.7a1 1 0 0 1-1.6 0c-.4-.5-.4-1.1 0-1.6l1.7-1.7-.3-.3c-.5-.6-.9-1.4-.9-2.2s.4-1.6 1-2.2l4.1-4.2c.6-.5 1.4-.8 2.2-.8s1.6.3 2.2.8l.3.3 1.7-1.7c.2-.2.5-.3.8-.3m0-2a3 3 0 0 0-2.2 1l-.5.4a5.2 5.2 0 0 0-5.9 1l-4.2 4a5 5 0 0 0-1 6l-.4.5a3 3 0 0 0 0 4.4 3 3 0 0 0 4.4 0l.5-.5a5 5 0 0 0 5.9-1l4.2-4a5 5 0 0 0 1-6l.4-.5a3 3 0 0 0 0-4.4 3 3 0 0 0-2.2-.9zm-6.1 7.2a2 2 0 0 0 2 2L11.6 15a2 2 0 0 0-2-2l1.8-1.8M12.5 9c-.2 0-.5.1-.6.3l-4.2 4.2c-.2.1-.3.4-.3.6 0 .2.1.5.3.6l.3.3.7-.7a1 1 0 0 1 1.6 0c.4.5.4 1.1 0 1.6l-.7.7.3.3c.1.2.4.3.6.3l.6-.3 4.2-4.2c.2-.1.3-.4.3-.6 0-.2-.1-.5-.3-.6l-.3-.3-.7.7a1 1 0 0 1-1.6 0c-.4-.5-.4-1.1 0-1.6l.7-.7-.3-.3a.9.9 0 0 0-.6-.3z"/>',
        "camera-outline": '<path d="M19 20h-14c-1.6 0-3-1.3-3-3v-8c0-1.6 1.3-3 3-3h1.5l1-1c.5-.5 1.5-1 2.4-1h4c.8 0 1.8.4 2.4 1l1 1h1.5c1.6 0 3 1.3 3 3v8c0 1.6-1.3 3-3 3zm-14-12c-.5 0-1 .4-1 1v8c0 .5.4 1 1 1h14c.5 0 1-.4 1-1v-8c0-.5-.4-1-1-1h-2c-.2 0-.52-.1-.7-.2l-1.2-1.2c-.2-.2-.7-.4-1-.4h-4c-.2 0-.7.2-1 .4l-1.2 1.2c-.1.1-.4.2-.7.2h-2zM12 10c1.3 0 2.5 1.1 2.5 2.5s-1.1 2.5-2.5 2.5-2.5-1.1-2.5-2.5 1.1-2.5 2.5-2.5m0-1c-1.9 0-3.5 1.5-3.5 3.5 0 1.9 1.5 3.5 3.5 3.5s3.5-1.5 3.5-3.5c0-1.9-1.5-3.5-3.5-3.5zM18 8.6c-.7 0-1.3.5-1.3 1.3s.5 1.2 1.3 1.2 1.3-.58 1.3-1.2-.5-1.3-1.3-1.3z"/>',
        "image-outline": '<path d="M8.5 7.9c.8 0 1.5.6 1.5 1.5s-.6 1.5-1.5 1.5-1.5-.6-1.5-1.5.6-1.5 1.5-1.5m0-1c-1.3 0-2.5 1.1-2.5 2.5s1.1 2.5 2.5 2.5 2.5-1.1 2.5-2.5-1.1-2.5-2.5-2.5zM16 11.9c.45.0 1.27 1.8 1.7 4.0h-11.3c.4-1.0 1.0-2.0 1.6-2.0.8 0 1.1.1 1.53.42.4.2 1.0.58 1.97.58 1.1 0 1.9-.8 2.6-1.6.6-.6 1.2-1.3 1.8-1.3m0-1c-2 0-3 3-4.5 3s-1.4-1-3.5-1c-2 0-3.0 4-3.0 4h14.0s-1-6-3-6zM22 6c0-1.1-.8-2-2-2h-16c-1.1 0-2 .8-2 2v12c0 1.1.8 2 2 2h16c1.1 0 2-.8 2-2v-12zm-2 12h-16v-12h16.0l-.0 12z"/>',
        "download-outline": '<path d="M20.9 17c0-.1-.0-.2-.0-.3l-2-6c-.1-.4-.5-.6-.9-.6h-.5l.6-.6c1.17-1.17 1.17-3.0 0-4.2-.81-.8-2.0-1.0-3.1-.7v-1.3c0-1.6-1.3-3-3-3s-3 1.3-3 3v1.3c-1.0-.3-2.3-.1-3.1.7-1.17 1.17-1.17 3.0.0 4.2l.68.6h-.5c-.4 0-.8.2-.9.6l-2 6c-.0.1-.0.2-.0.3-.0 0-.0 5-.0 5 0 .5.4 1 1 1h16c.5 0 1-.4 1-1 0 0 0-5-.0-5zm-13.6-10.5c.1-.1.4-.2.7-.2s.5.1.7.2l2.2 2.2v-5.7c0-.5.4-1 1-1s1 .4 1 1v5.7l2.2-2.2c.3-.3 1.0-.3 1.4 0 .3.39.3 1.0.0 1.4l-4.7 4.6-4.7-4.6c-.3-.3-.3-1.0 0-1.4zm-.5 5.5h1.8l3.4 3.41 3.4-3.41h1.8l1.6 5h-13.8l1.6-5zm12.2 9h-14v-3h14v3z"/>',
        "document-add": '<path d="M15 12h-2v-2c0-.5-.4-1-1-1s-1 .4-1 1v2h-2c-.5 0-1 .4-1 1s.4 1 1 1h2v2c0 .5.4 1 1 1s1-.4 1-1v-2h2c.5 0 1-.4 1-1s-.4-1-1-1zM19.7 7.2l-4-4c-.1-.1-.4-.2-.7-.2h-8c-1.6 0-3 1.3-3 3v12c0 1.6 1.3 3 3 3h10c1.6 0 3-1.3 3-3v-10c0-.2-.1-.52-.2-.7zm-2.1.7h-1.0c-.8 0-1.5-.6-1.5-1.5v-1.0l2.5 2.5zm-.5 11h-10c-.5 0-1-.4-1-1v-12c0-.5.4-1 1-1h7v1.5c0 1.3 1.1 2.5 2.5 2.5h1.5v9c0 .5-.4 1-1 1z"/>',
        "home-outline": '<path d="M22.2 10.4c-3.39-2.8-9.5-8.1-9.6-8.2l-.6-.5-.6.5c-.0.0-6.2 5.3-9.66 8.2-.4.3-.6.9-.6 1.5 0 1.1.8 2 2 2h1v6c0 1.1.8 2 2 2h12c1.1 0 2-.8 2-2v-6h1c1.1 0 2-.8 2-2 0-.5-.2-1.1-.7-1.5zm-8.2 9.5h-4v-5h4v5zm4-8l.0 8h-3.0v-6h-6v6h-3v-8h-3.0c2.7-2.3 7.3-6.2 9.0-7.68 1.6 1.4 6.2 5.3 9 7.6l-3-.0z"/>'
    };
    return Vue.component("icon", {
        data: function() {
            return {
                svg: ""
            }
        },
        props: ["id"],
        mounted: function() {
            var header = '<svg version="1.2" baseProfile="tiny" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">';
            this.svg = header + icons[this.id] + "</svg>"
        },
        template: '<i v-html="svg"></i>'
    })
}();

function StorageTools(selector, app) {
    return new Vue({
        el: selector,
        mounted: function() {
            var _this = this;
            app.filesystem.signals.on("updated", function(src) {
                return _this.$forceUpdate()
            })
        },
        methods: {
            isUrlStorage: function() {
                return app.filesystem.storage.kind == "url"
            },
            isLocalFileStorage: function() {
                return app.filesystem.storage.kind == "local_file"
            },
            saveViewModeToStorage: function() {
                app.saveViewModeToStorage()
            }
        }
    })
}
var nomnoml;
(function(nomnoml) {
    var skanaar;
    (function(skanaar) {
        skanaar.vector = {
            dist: function(a, b) {
                return skanaar.vector.mag(skanaar.vector.diff(a, b))
            },
            add: function(a, b) {
                return {
                    x: a.x + b.x,
                    y: a.y + b.y
                }
            },
            diff: function(a, b) {
                return {
                    x: a.x - b.x,
                    y: a.y - b.y
                }
            },
            mult: function(v, factor) {
                return {
                    x: factor * v.x,
                    y: factor * v.y
                }
            },
            mag: function(v) {
                return Math.sqrt(v.x * v.x + v.y * v.y)
            },
            normalize: function(v) {
                return skanaar.vector.mult(v, 1 / skanaar.vector.mag(v))
            },
            rot: function(a) {
                return {
                    x: a.y,
                    y: -a.x
                }
            }
        }
    })(skanaar = nomnoml.skanaar || (nomnoml.skanaar = {}))
})(nomnoml || (nomnoml = {}));
var nomnoml;
(function(nomnoml) {
    var skanaar;
    (function(skanaar) {
        function plucker(pluckerDef) {
            switch (typeof pluckerDef) {
                case "undefined":
                    return function(e) {
                        return e
                    };
                case "string":
                    return function(obj) {
                        return obj[pluckerDef]
                    };
                case "number":
                    return function(obj) {
                        return obj[pluckerDef]
                    };
                case "function":
                    return pluckerDef
            }
        }
        skanaar.plucker = plucker;

        function max(list, plucker) {
            var transform = skanaar.plucker(plucker);
            var maximum = transform(list[0]);
            for (var i = 0; i < list.length; i++) {
                var item = transform(list[i]);
                maximum = item > maximum ? item : maximum
            }
            return maximum
        }
        skanaar.max = max;

        function sum(list, plucker) {
            var transform = skanaar.plucker(plucker);
            for (var i = 0, summation = 0, len = list.length; i < len; i++) summation += transform(list[i]);
            return summation
        }
        skanaar.sum = sum;

        function flatten(lists) {
            var out = [];
            for (var i = 0; i < lists.length; i++) out = out.concat(lists[i]);
            return out
        }
        skanaar.flatten = flatten;

        function find(list, predicate) {
            for (var i = 0; i < list.length; i++)
                if (predicate(list[i])) return list[i];
            return undefined
        }
        skanaar.find = find;

        function last(list) {
            return list[list.length - 1]
        }
        skanaar.last = last;

        function hasSubstring(haystack, needle) {
            if (needle === "") return true;
            if (!haystack) return false;
            return haystack.indexOf(needle) !== -1
        }
        skanaar.hasSubstring = hasSubstring;

        function format(template) {
            var parts = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                parts[_i - 1] = arguments[_i]
            }
            var matrix = template.split("#");
            var output = [matrix[0]];
            for (var i = 0; i < matrix.length - 1; i++) {
                output.push(parts[i] || "");
                output.push(matrix[i + 1])
            }
            return output.join("")
        }
        skanaar.format = format;

        function merged(a, b) {
            function assign(target, data) {
                for (var key in data) target[key] = data[key]
            }
            var obj = {};
            assign(obj, a);
            assign(obj, b);
            return obj
        }
        skanaar.merged = merged;

        function indexBy(list, key) {
            var obj = {};
            for (var i = 0; i < list.length; i++) obj[list[i][key]] = list[i];
            return obj
        }
        skanaar.indexBy = indexBy;

        function uniqueBy(list, pluckerDef) {
            var seen = {};
            var getKey = skanaar.plucker(pluckerDef);
            var out = [];
            for (var i = 0; i < list.length; i++) {
                var key = getKey(list[i]);
                if (!seen[key]) {
                    seen[key] = true;
                    out.push(list[i])
                }
            }
            return out
        }
        skanaar.uniqueBy = uniqueBy
    })(skanaar = nomnoml.skanaar || (nomnoml.skanaar = {}))
})(nomnoml || (nomnoml = {}));