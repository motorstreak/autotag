(function($) {
    $.fn.autotag = function() {
        var editor = $(this)[0];

        // Store the value of the last saved caret position so that
        // we can position the cursor at the last known position
        // when focus is gained on tab in.
        var activeRange;
        var AUTO_NODE = '_auto_';

        var createTextNode = function(str) {
            // Firefox hack - without this, firefox will ignore the leading
            // space in the span.
            str = str.replace(/ /g, '\u00a0');
            return document.createTextNode(str);
        };

        var getCaretPosition = function() {
            var range;
            if (window.getSelection) {
                range = window.getSelection().getRangeAt(0);
            } else if (document.selection) {
                range = document.selection.createRange();
            }
            // activeRange = range;
            return range;
        };

        // Takes in the current node and sets the cursor location
        // on the first child, if the child is a Text node.
        var setCaretPosition = function(node, offset) {
            var range;
            if (node !== null) {
                offset = (typeof offset === "undefined") ? node.length : offset;
                range = getCaretPosition();
                range.setStart(node, offset);
                range.setEnd(node, offset);
                resetCaretPosition(range);
            }
            activeRange = range;
            return range;
        };

        // Clears all existing ranges and sets it to the provided one.
        var resetCaretPosition = function(range) {
            if (range !== null) {
                if (window.getSelection) {
                    var selection = window.getSelection();
                    if (selection.rangeCount > 0) {
                        selection.removeAllRanges();
                    }
                    selection.addRange(range);
                } else if (document.createRange) {
                    window.getSelection().addRange(range);
                } else if (document.selection) {
                    range.select();
                }
            }
        };

        var isOfType = function(node, type) {
            return node && (node.getAttribute('type') === type);
        };

        var setNodeType = function(node, type) {
            if (node !== null) {
                if (typeof type === 'undefined') {
                    node.removeAttribute('type');
                } else {
                    node.setAttribute('type', type);
                }
            }
        };

        // Wraps the input in a span element so that we can apply any
        // styles if required - for example, when a user adds a # in front
        // of this text.
        var wrapString = function(str) {
            var wrapperNode = document.createElement("a");
            var textNode;
            if (str.length > 0) {
                textNode = createTextNode(str);
            } else {
                textNode = createTextNode('\u00a0');
                setNodeType(wrapperNode, AUTO_NODE);
            }
            wrapperNode.appendChild(textNode);
            applyStyleToNode(wrapperNode, str);
            return wrapperNode;
        };

        // Apply styles to the input text if it is a hashtag or an attag.
        var applyStyleToNode = function(node, str) {
            if (str.match(/^#[\w]+/)) {
                node.className = 'hash-autotag';
            } else if (str.match(/^@[\w]+/)) {
                node.className = 'at-autotag';
            } else {
                node.removeAttribute("class");
            }
        };

        var appendNode = function(node, toNode) {
            toNode.parentNode.insertBefore(node, toNode.nextSibling);
        };

        var removeNode = function(node) {
            if (node && node.parentNode) {
                node.parentNode.removeChild(node);
            }
        };

        var processLine = function(range, line) {
            // Always get the current location to determine the current node
            // being operated on.
            // var range;
            var offset = range.endOffset;
            var container = range.endContainer;
            var containerParent = container.parentNode;

            // Remove pilot node status and trim text.
            // if (containerParent.hasAttribute("type")) {
            //     if (containerParent.getAttribute('type') == 'lead') {
            //         container.nodeValue = container.nodeValue.replace(/\s+$/, '');
            //     }
            //     containerParent.removeAttribute("type");
            //     range = setCaretPosition(container, container.length);
            // }

            if (isOfType(containerParent, AUTO_NODE)) {
                container.nodeValue = container.nodeValue.replace(/\s+$/, '');
                containerParent.removeAttribute("type");
                // range.endOffset = container.nodeValue.length;
                setCaretPosition(container);
            }

            // if (container.nodeValue) {
            //     container.nodeValue = container.nodeValue.replace(/^\s+$/, '');
            // }

            var input = line || container.nodeValue || '';
            var parts = input.split(/(\B[#@]\b\w+(?=\W*))/ig);

            if (parts !== null) {
                parts = parts.filter(Boolean);
                var partsCount = parts.length;

                console.log(parts);

                var wrapper, newContainer;
                if (partsCount > 0) {
                    if (containerParent.nodeName != 'A') {
                        wrapper = wrapString(parts[0]);
                        appendNode(wrapper, container);
                        removeNode(container);

                        newContainer = wrapper.firstChild;
                        range = setCaretPosition(newContainer, newContainer.length);
                        container = range.endContainer;
                        containerParent = container.parentNode;
                    }

                    applyStyleToNode(containerParent, container.nodeValue);

                    var containerGrandParent = containerParent.parentNode;
                    if (containerGrandParent.nodeName != 'P' ||
                        containerGrandParent.isSameNode(editor)) {
                        var containerParentNextSibling = containerParent.nextSibling;
                        var blockWrapper = blockWrap(containerParent);
                        containerGrandParent.insertBefore(blockWrapper, containerParentNextSibling);
                        range = setCaretPosition(container, container.length);
                    }
                }

                if (partsCount > 1) {
                    container.nodeValue = parts[0];
                    for (var i = 1; i < partsCount; i++) {
                        wrapper = wrapString(parts[i]);
                        appendNode(wrapper, containerParent);

                        newContainer = wrapper.firstChild;
                        range = setCaretPosition(newContainer, newContainer.length);
                        containerParent = newContainer.parentNode;
                    }
                }
            }
            return range;
        };

        // Prevent FF inserted <br> tags on Space.
        var processSpace = function() {
            var range = getCaretPosition();
            var offset = range.endOffset;
            var container = range.endContainer;
            var value = container.nodeValue;
            container.nodeValue =
                value.substring(0, offset) + "\u00a0" + value.substring(offset);
            range = setCaretPosition(container, offset + 1);
            processLine(range);
            return range;
        };

        var processNewline = function() {
            var range = getCaretPosition();
            var container = range.endContainer;
            var containerParent = container.parentNode;

            var offset = range.endOffset;
            var value = container.nodeValue || '';

            var parts = [value.substring(0, offset), value.substring(offset)];

            container.nodeValue = parts[0].length === 0 ? '\u00a0' : parts[0];

            if (isOfType(containerParent, AUTO_NODE)) {
                wrapper = wrapString(value);
            } else {
                wrapper = wrapString(parts[1]);
            }
            setNodeType(wrapper, AUTO_NODE);


            // if (isOfType(containerParent, AUTO_NODE)) {
            //
            //     if (parts[1].length === 0)
            //         parts[1] = '\u00a0';
            //     }
            //     wrapper = wrapString(parts[1]);
            //     setNodeType(wrapper, AUTO_NODE);
            // }
            // container.nodeValue = parts[0];

            // var wrapper;
            // if (parts[1].length > 0) {
            //     wrapper = wrapString(parts[1]);
            // } else {
            //     wrapper = wrapString("\u00a0", true);
            // }

            // wrapper = wrapString(parts[1]);
            // if ((parts[1] === '\u00a0' || parts[1].length === 0) &&
            //     isOfType(containerParent, AUTO_NODE)) {
            //     setNodeType(wrapper, AUTO_NODE);
            // }

            var blockWrapper = blockWrap(wrapper);
            appendNode(blockWrapper, container.parentNode.parentNode);
            range = setCaretPosition(wrapper.firstChild, 0);
            // editor.focus();
            console.log(range);
            return range;
        };

        var editorHasNoText = function() {
            var walk = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
            return (walk.nextNode() === null);
        };

        var blockWrap = function(node) {
            // Add a newline wrapper.
            var blockNode = document.createElement("p");
            removeNode(node);
            blockNode.appendChild(node);

            // Setting any layout property on block wrapper (div)
            // will result in the display of resizable bars in IE. By adding
            // an text element on the div (which we never use) acts as a wedge
            // and props up the div element to its natural height. Note that
            // we set contenteditable to false so that the text node does not
            // get edited.
            // var wedge = createTextNode("\u00a0");
            // var wedgeWrapper = document.createElement('t');
            // wedgeWrapper.appendChild(wedge);
            // wedgeWrapper.setAttribute("contenteditable", "false");
            // blockNode.appendChild(wedgeWrapper);

            return blockNode;
        };

        var prepareEditor = function() {
            if (editorHasNoText()) {
                while (editor.firstChild) {
                    editor.removeChild(editor.firstChild);
                }
            }
        };

        editor.addEventListener('focus', function(e) {
            prepareEditor();
        });

        // Prevent FF from inserting ghost <br>s on Space.
        editor.addEventListener('keydown', function(e) {
            var code = (e.keyCode ? e.keyCode : e.which);
            if (code == 32) {
                processSpace();
                e.preventDefault();
            } else if (code == 13) {
                processNewline();
                e.preventDefault();
            } else if (code == 39) {
                var node = getCaretPosition().endContainer.parentNode;
                if (isOfType(node, AUTO_NODE)) {
                    e.preventDefault();
                }
            }
        });

        // Does not work on IE <= 8
        editor.addEventListener('keyup', function(e) {
            var code = (e.keyCode ? e.keyCode : e.which);
            if (code != 32 && code != 13) {
                var nextSibling = getCaretPosition().endContainer.nextSibling;
                // Remove unwanted <br> tags inserted by firefox.
                if (nextSibling && nextSibling.nodeName == 'BR') {
                    removeNode(nextSibling);
                }
                if (code > 40 && code < 112 || code == 8) {
                    activeRange = processLine(getCaretPosition());
                }
            }
        });

        editor.addEventListener('paste', function(e) {
            e.preventDefault();

            var content;
            if (e.clipboardData) {
                content = (e.originalEvent || e).clipboardData.getData('text/plain');
            } else if (window.clipboardData) {
                content = window.clipboardData.getData('Text');
            }

            var range = getCaretPosition();
            var container = range.endContainer;
            var wrapper = wrapString(content);
            if (container.isSameNode(editor)) {
                container.appendChild(wrapper);
                range = setCaretPosition(wrapper.firstChild, 0);
            } else {
                appendNode(wrapper, container);
            }
            processLine(range, content);
        });

        editor.addEventListener('focus', function(e) {
            var node = getCaretPosition().endContainer.parentNode;
            if (activeRange && (node.nodeName == "T" || node.isSameNode(editor))) {
                resetCaretPosition(activeRange);
            }
        });

        editor.addEventListener('click', function(e) {
            var node = getCaretPosition().endContainer;
            if (node.nodeName == "P") {
                setCaretPosition(node.firstChild, 0);
            } else if (isOfType(node.parentNode, AUTO_NODE)) {
                setCaretPosition(node, 0);
            }
            console.log(node);
        });

        return this;
    };
})(jQuery);
