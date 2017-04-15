/*! jquery-autotag.js v1.4 https://github.com/motorstreak/jquery-autotag */
/*
 Version: 1.4
 Author: Navin Samuel
 Web: https://github.com/motorstreak/jquery-autotag
 Licensed under MIT License http://www.opensource.org/licenses/mit-license
*/

(function($) {
    // Configuration options
    //
    // splitter:  A function that can receive a string, split it and return
    //            the parts as an array. If not provided, the default
    //            splitter is used.
    //
    // decorator: A function that receives nodes that need to be processed.
    //            Use the decorator to apply styles on the node or do whatever
    //            processing you wish to do. If one is not provided, the
    //            default decorator will be used.
    //
    // trace:     Set this to true to see debug messages on the console.

    $.fn.autotag = function(config) {
        var editor = $(this)[0];

        // The default tokenizer function.
        function split(str) {
            return str.split(/(\B[^,;\.\w]\b\w+(?=\W*))/ig);
        }

        // The default decorator applies a css class to text that begin
        // with a hash (#) or at (@) character.
        function decorate(node) {
            var text = node.firstChild.nodeValue;
            if (text.match(/^#[\w]+/)) {
                node.className = 'autotag-hashtag';
            } else if (text.match(/^@[\w]+/)) {
                node.className = 'autotag-attag';
            } else {
                node.removeAttribute("class");
            }
            return node;
        }

        // Initialize configuration.
        config = config || {};
        var trace = config.trace || false;
        var splitter = config.splitter || split;
        var decorator = config.decorator || decorate;

        // The line on which the input was captured. This is updated
        // each time a keyup event is triggered.
        var inputLineNumber;

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

        var prepareLine = function(line) {
            line = (typeof line === 'undefined') ? getLine() : line;
            if (line.nodeType !== Node.DOCUMENT_NODE) {
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
            }
            return line;
        };

        var prepareText = function(textNode) {
            var parentNode = textNode.parentNode;
            if (textNode.nodeType == Node.TEXT_NODE) {
                if(parentNode.tagName === 'P') {

                    var tagNode = createTagNode();
                    parentNode.insertBefore(tagNode, textNode);
                    tagNode.appendChild(textNode);
                    setCaret(textNode);
                }
            }
            return textNode;
        };

        var prepareEditor = function() {
            var walker = getTextWalker(editor);
            var textNode = walker.nextNode();
            if (textNode === null) {
                removeAllChildNodes(editor);
                var pilot = createPilotNode();
                var blockNode = createBlockNode(pilot);
                editor.appendChild(blockNode);
                setCaret(pilot, 0);
            } else {
                prepareLine();
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
            var parts = splitter(input);

            // Trim empty values from the array.
            parts = parts && parts.filter(Boolean) || '';
            var numparts = parts.length;

            if (trace) {
                console.log(parts);
            }

            if (numparts > 0) {
                var lastTagNode = container.parentNode;
                container.nodeValue = parts[numparts-1];
                decorator(lastTagNode);

                // Ensure that the caret does not move after the
                // reorganization of nodes.
                var refOffset = input.length - parts[numparts-1].length;
                if (offset > refOffset && offset <= input.length) {
                    setCaret(container, offset - refOffset);
                }

                if (numparts > 1) {
                    var refNode = lastTagNode;
                    var parentNode = refNode.parentNode;

                    for(var i=numparts-2; i>=0; i--) {
                        tagNode = createTagNode(parts[i]);
                        parentNode.insertBefore(tagNode, refNode);
                        decorator(tagNode);

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

        ///////////// Start processing events

        editor.addEventListener('keydown', function(e) {
            inputLineNumber = getLineNumber();
        });

        editor.addEventListener('keyup', function(e) {
            processInput();

            var code = (e.keyCode ? e.keyCode : e.which);
            if (code == 13 ){
                if (getLineNumber() == inputLineNumber) {
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
