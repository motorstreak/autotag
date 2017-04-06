(function($) {
    $.fn.autotag = function() {
        var editor = $(this)[0];

        // Store the value of the last saved caret position so that
        // we can position the cursor at the last known position
        // when focus is gained on tab in.

        var AUTO_NODE = '_auto_';
        var activeRange;

        var createTextNode = function(str) {
            // Firefox hack - without this, firefox will ignore the leading
            // space in the span.
            str = str.replace(/ /g, '\u00a0');
            return document.createTextNode(str);
        };

        var getCaret = function() {
            var range;
            if (window.getSelection) {
                range = window.getSelection().getRangeAt(0);
            } else if (document.selection) {
                range = document.selection.createRange();
            }
            return range;
        };

        // Takes in the current node and sets the cursor location
        // on the first child, if the child is a Text node.
        var setCaret = function(node, offset) {
            var range;
            if (node !== null) {
                offset = (typeof offset === "undefined") ? node.length : offset;
                range = getCaret();
                range.setStart(node, offset);
                range.setEnd(node, offset);
                resetCaret(range);
            }
            activeRange = getCaret();
            return range;
        };

        // Clears all existing ranges and sets it to the provided one.
        var resetCaret = function(range) {
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
            return getCaret();
        };

        var isOfType = function(node, type) {
            return node && (node.getAttribute('type') === type);
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
                wrapperNode.setAttribute('type', AUTO_NODE);
            }
            wrapperNode.appendChild(textNode);
            applyStyle(wrapperNode, str);
            return wrapperNode;
        };

        // Apply styles to the input text if it is a hashtag or an attag.
        var applyStyle = function(node, str) {
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

        var processLine = function(line) {
            // Always get the current location to determine the current node
            // being operated on.
            var range = getCaret();
            var offset = range.endOffset;
            var container = range.endContainer;
            var node = container.parentNode;

            if (isOfType(node, AUTO_NODE)) {
                container.nodeValue = container.nodeValue.replace(/\s+$/, '');
                node.removeAttribute("type");
                setCaret(container);
            }

            var input = line || container.nodeValue || '';
            var parts = input.split(/(\B[#@]\b\w+(?=\W*))/ig);

            if (parts !== null) {
                parts = parts.filter(Boolean);
                var partsCount = parts.length;

                // console.log(parts);

                var wrapper, newContainer;
                if (partsCount > 0) {
                    if (node.nodeName != 'A') {
                        wrapper = wrapString(parts[0]);
                        appendNode(wrapper, container);
                        removeNode(container);

                        newContainer = wrapper.firstChild;
                        range = setCaret(newContainer, newContainer.length);
                        container = range.endContainer;
                        node = container.parentNode;
                    }

                    applyStyle(node, container.nodeValue);

                    var nodeParent = node.parentNode;
                    if (nodeParent.nodeName != 'P' ||
                        nodeParent.isSameNode(editor)) {

                        var blockWrapper = blockWrap(node);
                        nodeParent.insertBefore(blockWrapper, node.nextSibling);
                        setCaret(container);
                    }

                    if (partsCount > 1) {
                        container.nodeValue = parts[0];
                        for (var i = 1; i < partsCount; i++) {
                            wrapper = wrapString(parts[i]);
                            appendNode(wrapper, node);

                            newContainer = wrapper.firstChild;
                            setCaret(newContainer);
                            node = newContainer.parentNode;
                        }
                    }
                }
            }
            return getCaret();
        };

        // Prevent FF inserted <br> tags on Space.
        var processSpace = function() {
            var range = getCaret();
            var offset = range.endOffset;
            var container = range.endContainer;
            var value = container.nodeValue;
            container.nodeValue =
                value.substring(0, offset) + "\u00a0" + value.substring(offset);
            setCaret(container, offset + 1);
            return processLine();
        };

        var processNewline = function() {
            var range = getCaret();
            var container = range.endContainer;
            var node = container.parentNode;

            var offset = range.endOffset;
            var value = container.nodeValue || '';

            var parts = [value.substring(0, offset), value.substring(offset)];
            container.nodeValue = parts[0].length === 0 ? '\u00a0' : parts[0];

            if (isOfType(node, AUTO_NODE)) {
                wrapper = wrapString(value);
                wrapper.setAttribute('type', AUTO_NODE);
            } else {
                wrapper = wrapString(parts[1]);
            }

            var blockWrapper = blockWrap(wrapper);
            appendNode(blockWrapper, node.parentNode);
            return setCaret(wrapper.firstChild, 0);
        };

        var processDelete = function() {
            var range = getCaret();
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

        editor.addEventListener('focus', function(e) {
            if (editorHasNoText()) {
                while (editor.firstChild) {
                    editor.removeChild(editor.firstChild);
                }
            }
        });

        // Prevent FF from inserting ghost <br>s on Space.
        editor.addEventListener('keydown', function(e) {
            var code = (e.keyCode ? e.keyCode : e.which);
            var container = getCaret().endContainer;
            var node = container.parentNode;

            if (code == 32) {
                processSpace();
                e.preventDefault();
            } else if (code == 13) {
                processNewline();
                e.preventDefault();
            } else if (code == 39 || code == 40) {
                if (isOfType(node, AUTO_NODE)) {
                    setCaret(container, 0);
                    if (code == 39) {
                        e.preventDefault();
                    }
                }
            } else if (code == 8) {
                if (isOfType(node, AUTO_NODE)) {
                    removeNode(node);
                }
            } else if (code == 38) {
                var node = container.parentNode;
                var topline = node.parentNode.previousSibling;
                var topNode = topline && topline.firstChild;
                if (topNode && isOfType(topNode, AUTO_NODE)) {
                    setCaret(topNode.firstChild, 0);
                    // e.preventDefault;
                    console.log(topNode);
                }
            }
        });

        // Does not work on IE <= 8
        editor.addEventListener('keyup', function(e) {
            var code = (e.keyCode ? e.keyCode : e.which);
            if (code != 32 && code != 13) {
                var container = getCaret().endContainer;
                var nextSibling = container.nextSibling;
                // Remove unwanted <br> tags inserted by firefox.
                if (nextSibling && nextSibling.nodeName == 'BR') {
                    removeNode(nextSibling);
                }
                if (code > 40 && code < 112) {
                    processLine();
                } else if (code == 8) {
                    processDelete();
                // } else if (code >= 37 || code <= 40) {
                    // if (isOfType(container.parentNode, AUTO_NODE)) {
                    //     setCaret(container, 0);
                    // }

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

            var container = getCaret().endContainer;
            var wrapper = wrapString(content);
            if (container.isSameNode(editor)) {
                container.appendChild(wrapper);
                setCaret(wrapper.firstChild, 0);
            } else {
                appendNode(wrapper, container);
            }
            processLine(content);
        });

        editor.addEventListener('focus', function(e) {
            var node = getCaret().endContainer.parentNode;
            if (activeRange && (node.nodeName == "T" || node.isSameNode(editor))) {
                resetCaret(activeRange);
            }
        });

        editor.addEventListener('click', function(e) {
            var node = getCaret().endContainer;
            if (node.nodeName == "P") {
                setCaret(node.firstChild, 0);
            } else if (isOfType(node.parentNode, AUTO_NODE)) {
                setCaret(node, 0);
            }
        });

        return this;
    };
})(jQuery);
