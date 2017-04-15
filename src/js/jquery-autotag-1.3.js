(function($) {
    $.fn.autotag = function() {
        var editor = $(this)[0];
        var currentLineNumber;

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
                try {
                    range.setStart(node, offset);
                    range.setEnd(node, offset);
                }
                catch(err) {
                    // Chrome does not like setting an offset of 1
                    // on an empty node.
                }
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

        var createTextNode = function(str) {
            // Firefox hack - without this, firefox will ignore the leading
            // space in the span.
            str = str && str.replace(/ /g, '\u00a0') || '';
            return document.createTextNode(str);
        };

        var createPilotNode = function() {
            var pilotNode = document.createElement('a');
            var breakNode = document.createElement('br');
            pilotNode.appendChild(breakNode);
            return pilotNode;
        }

        var createTagNode = function(str) {
            var tagNode = document.createElement('a');
            if (str) {
                var textNode = createTextNode(str);
                tagNode.appendChild(textNode);
            }
            return tagNode;
        };

        var createBlockNode = function(node) {
            var blockNode = document.createElement('p');
            if (node !== null) {
                blockNode.appendChild(node);
            }
            return blockNode;
        };

        var removeAllChildNodes = function(node) {
            while (node.hasChildNodes()) {
                node.removeChild(node.lastChild);
            }
            return node;
        };

        var removeNode = function(node) {
            if (node && node.parentNode) {
                node.parentNode.removeChild(node);
            }
            return node;
        };

        var getTextWalker = function(node) {
            return document.createTreeWalker(
                    node,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
        };

        var applyStyle = function(node, str) {
            var styleApplied = false;
            if (typeof str === 'undefined') {
                str = node.firstChild.nodeValue;
            }
            if (str.match(/^#[\w]+/)) {
                node.className = 'hash-autotag';
                styleApplied = true;
            } else if (str.match(/^@[\w]+/)) {
                node.className = 'at-autotag';
                styleApplied = true;
            } else {
                node.removeAttribute("class");
            }
            return styleApplied;
        };

        var prepareLine = function(line) {
            line = (typeof line === 'undefined') ? getLine() : line;
            var walker = getTextWalker(line);
            var textNode = walker.nextNode();
            if (textNode === null) {
                // IE inserts <p><br/></p> on return at end of line.
                // Change this to <p><a><br/></a></p>.
                removeAllChildNodes(line);
                var pilot = createPilotNode();
                line.appendChild(pilot);

                // FF requires the caret to be at offset 1.
                // IE does not care! Chrome throws an exception.
                setCaret(pilot, 0);
            } else {
                // IE inserts <p>text<br></p> on return mid string.
                // Change this to <p><a>text<br></a></p>.
                var tagNode;
                while(textNode) {
                    tagNode = prepareText(textNode).parentNode;
                    textNode = walker.nextNode();
                }
                var breakNode = line.querySelector('br:last-child');
                if (breakNode) {
                    var prevSibling = breakNode.previousSibling;
                    prevSibling.appendChild(breakNode);
                }
            }
            return line;
        };

        var prepareText = function(textNode) {
            var parentNode = textNode.parentNode;
            if (textNode.nodeType == Node.TEXT_NODE &&
                parentNode.tagName === 'P') {

                var tagNode = createTagNode();
                parentNode.insertBefore(tagNode, textNode);
                tagNode.appendChild(textNode);
                setCaret(textNode);
            }
            return textNode;
        };

        var prepareEditor = function() {
            var walker = getTextWalker(editor);
            if (walker.nextNode() === null) {
                removeAllChildNodes(editor);

                var pilot = createPilotNode();
                var blockNode = createBlockNode(pilot);
                editor.appendChild(blockNode);
                setCaret(pilot, 0);
            }
        };

        var getPreviousLine = function(line) {
            line = (typeof line === 'undefined') ? getLine() : line;
            return line && line.previousSibling;
        };

        var getNextLine = function(line) {
            line = (typeof line === 'undefined') ? getLine() : line;
            return line && line.nextSibling;
        };

        var getLine = function(range) {
            range = (typeof range === 'undefined') ? getCaret() : range;
            var node = null;
            if (range) {
                node = range.endContainer;
                while (node.parentNode && node.tagName !== 'P') {
                    node = node.parentNode;
                }
            }
            return node;
        };

        var getLineNumber = function(line) {
            line = (typeof line === 'undefined') ? getLine() : line;
            var lineNumber = null;
            if (line) {
                lineNumber = 1;
                while (line.previousSibling !== null) {
                    lineNumber++;
                    line = line.previousSibling;
                }
            }
            return lineNumber;
        }

        var gotoCurrentLine = function() {
            return gotoLine(getLine());
        };

        var gotoLine = function(line, pos) {
            if (line) {
                if (typeof pos !== 'undefined') {
                    if (pos === 0) {
                        var firstNode = line.querySelector('a:first-child');
                        if (firstNode) {
                            setCaret(firstNode, 0);
                        }
                    }

                } else {
                    var lastNode = line.querySelector('a:last-child');
                    if (lastNode) {
                        setCaret(lastNode);
                    }
                }
            }
            return line;
        };

        var processInput = function(str) {
            prepareText(getCaret().endContainer);

            var range = getCaret();
            var offset = range.endOffset;
            var container = range.endContainer;

            var input = str || container.nodeValue || '';
            var parts = input.split(/(\B[#@]\b\w+(?=\W*))/ig);

            // Trim empty values from the array.
            parts = parts.filter(Boolean);
            var partsCount = parts.length;

            if (partsCount > 0) {
                var lastTagNode = container.parentNode;
                container.nodeValue = parts[partsCount-1];
                applyStyle(lastTagNode);

                // Ensure that the caret does not move after the
                // reorganization of nodes.
                var refOffset =
                    input.length - parts[partsCount-1].length;
                if (offset > refOffset && offset <= input.length) {
                    setCaret(container, offset - refOffset);
                }

                if (partsCount > 1) {
                    var refNode = lastTagNode;
                    var parentNode = refNode.parentNode;

                    for(var i=partsCount-2; i>=0; i--) {
                        tagNode = createTagNode(parts[i]);
                        parentNode.insertBefore(tagNode, refNode);
                        applyStyle(tagNode);

                        // Ensure that the caret does not move after the
                        // reorganization of nodes.
                        refOffset = refOffset - parts[i].length;
                        if (offset > refOffset &&
                            offset <= (refOffset + parts[i].length)) {
                            setCaret(tagNode.firstChild, offset - refOffset);
                        }
                        refNode = tagNode;
                    }
                }
            }
        };

        editor.addEventListener('keydown', function(e) {
            currentLineNumber = getLineNumber();
            prepareEditor();
        });

        editor.addEventListener('keyup', function(e) {
            var code = (e.keyCode ? e.keyCode : e.which);
            processInput();

            if (code == 13 ){
                if (getLineNumber() == currentLineNumber) {
                    var next = getNextLine();
                    if (next !== null) {
                        prepareLine(next);
                        gotoLine(next, 0);
                    }
                } else {
                    var line = getLine();
                    prepareLine(getPreviousLine(line));
                    prepareLine(line);
                    gotoLine(line);
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
            if (container.nodeValue) {
                container.nodeValue.concat(content);
            } else {
                var textNode = document.createTextNode(content);
                container.insertBefore(textNode, container.firstChild);
                setCaret(textNode, 0);
            }

            processInput();
        });

        editor.addEventListener('click', function(e) {
            prepareEditor();
        });

        editor.addEventListener('focus', function(e) {
            prepareEditor();
        });

        return this;
    };
})(jQuery);
