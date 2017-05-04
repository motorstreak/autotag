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
    // splitter:    A callback function that can receive a string, split it and return
    //              the parts as an array. If not provided, the default
    //              splitter is used.
    //
    // decorator:   A callback function that receives nodes for processing.
    //              Use the decorator to apply styles on the node or do whatever
    //              processing you wish to do. If one is not provided, the
    //              default decorator will be used.
    //
    // The callback functions below are invoked before and after processing
    // the similarly named events. If any of the before<event> callbacks
    // return evaluates to false, jquery-autotag will not perform any action on
    // the registered input and the after<event> callbacks will not be invoked.
    //
    //      beforeKeypress(e) - called before processing a keydown event.
    //      afterKeypress - called after processing a keyup event.
    //      beforePaste
    //      afterPaste
    //      beforeClick
    //      afterClick
    //
    // ignoreReturnKey: If set to true, return key presses will be
    //              ignored. False by default.
    //
    // onReturnKey: A callback function that gets invoked when a return key
    //              press is detected during the keydown event. The callback will
    //              only be made if the 'ignoreReturnKey' flag is set to true.
    //
    // trace:     Set this to true to see debug messages on the console.

    $.fn.autotag = function(config) {
        var editor = $(this)[0];
        var lineStyle = 'autotag-line';

        function logToConsole(data, msg) {
            msg = (typeof msg === 'undefined') ? '' : msg;
            if (trace) {
                console.log('TRACE : ' + msg + ' : ' + data);
            }
        }

        // The default tokenizer function.
        function split(str) {
            return str.match(/([^\s]+)|\s+/ig);
        }

        // The default decorator applies a css class to text that begin
        // with a hash (#) or at (@) character.
        function decorate(node, text) {}

        // Event callback functions.
        function beforeKeypress(e) { return true; }
        function afterKeypress() {}
        function beforePaste() { return true; }
        function afterPaste() {}
        function beforeClick() { return true; }
        function afterClick() {}

        // The default return key down event handler ignores
        // the keydown event.
        function onReturnKey() {}

        // Initialize configuration.
        config = config || {};
        var trace = config.trace || false;
        var ignoreReturnKey = config.ignoreReturnKey || false;
        var splitter = config.splitter || split;
        var decorator = config.decorator || decorate;
        var doOnReturnKey = config.onReturnKey || onReturnKey;

        // Event callbacks
        var doBeforeKeypress = config.beforeKeypress || beforeKeypress;
        var doAfterKeypress = config.afterKeypress || afterKeypress;
        var doBeforePaste = config.beforePaste || beforePaste;
        var doAfterPaste = config.afterPaste || afterPaste;
        var doBeforeClick = config.beforeClick || beforeClick;
        var doAfterClick = config.afterClick || afterClick;

        // Store status of beforeKeypress callback return.
        var processInputFlag;

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
                offset = (typeof offset === 'undefined') ? node.length : offset;
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
            if (range) {
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

        //
        var createTextNode = function(str) {
            // Firefox hack - without this, firefox will ignore the leading
            // space in the element causing all sorts of headache.
            str = str && str.replace(/ /g, '\u00a0') || '';
            return document.createTextNode(str);
        };

        // A leading Tag node, required to maintain consistancy in behavior
        // across browsers.
        var createPilotNode = function() {
            var pilotNode = document.createElement('a');
            var breakNode = document.createElement('br');
            pilotNode.appendChild(breakNode);
            return pilotNode;
        };

        // Every text node in the editor is wrapped in a Tag node.
        var createTagNode = function(str) {
            var tagNode = document.createElement('a');
            if (str) {
                var textNode = createTextNode(str);
                tagNode.appendChild(textNode);
            }
            return tagNode;
        };

        // A Block node form a line element in the editor.
        var createBlockNode = function(node) {
            var blockNode = document.createElement('p');
            blockNode.className = lineStyle;
            if (node !== null) {
                blockNode.appendChild(node);
            }
            return blockNode;
        };

        var createNewLine = function() {
            var pilot = createPilotNode();
            return createBlockNode(pilot);
        };

        var removeAllBreakNodes = function(node) {
            var i=0;
            var breakNode;
            // var parentNode;
            var breakNodes = node.querySelectorAll('BR');
            while ((breakNode = breakNodes[i++]) && i <= breakNodes.length) {
                var parentNode = breakNode.parentNode;
                parentNode.removeChild(breakNode);
                if (parentNode.childNodes.length === 0) {
                    removeNode(parentNode);
                }
            }
        };

        var removeAllChildNodes = function(node) {
            while (node && node.hasChildNodes()) {
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
            return node &&
                document.createTreeWalker(
                    node,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
        };

        // If the text is too long to fit in a single line,
        // break it up into multiple lines. The threshold value ensures that
        // the line breakup happens in a preemptive fashion.
        var paragraphize = function(line, threshold) {
            if (ignoreReturnKey === false) {
                line = line || getLine();

                // A default value of 10 is sufficient for most fonts.
                threshold = (typeof threshold === 'undefined') ? 10 : threshold;
                if (line !== null) {
                    var range = getCaret();
                    var tagNode = range.endContainer.parentNode;
                    var lineRightPos = line.getBoundingClientRect().right;

                    if (isTag(tagNode)) {
                        var tagRightPos = tagNode.getBoundingClientRect().right;

                        // Start on a new line when tagNode is close to the
                        // edge of the current line.
                        logToConsole(tagRightPos + ':' + lineRightPos,
                            'Line to text block right position');

                        if((tagRightPos + threshold) >= lineRightPos ) {
                            var newLine = getNextLine(line) || createNewLine();
                            line.parentNode.insertBefore(newLine, line.nextSibling);

                            // If there are more than one tag node on the line,
                            // move the last tag node to the new line.
                            if (line.childNodes.length > 2) {
                                newLine.insertBefore(tagNode, newLine.firstChild);
                                setCaret(tagNode.firstChild);
                            }
                        }
                    }
                }
            }
        };

        var prepareLine = function(line) {
            line = (typeof line === 'undefined') ? getLine() : line;
            if (line) {
                var walker = getTextWalker(line);
                var textNode = walker && walker.nextNode();
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
                    while(textNode) {
                        prepareText(textNode);
                        textNode = walker.nextNode();
                    }

                    // Now deal with the last BR tag. If it exists and is
                    // a child of the line, reattach to the last tag node.
                    removeAllBreakNodes(line);
                    line.appendChild(createPilotNode());

                    // if (breakNode && isLine(breakNode.parentNode)) {
                    //     var prevSibling = breakNode.previousSibling;
                    //     if (prevSibling && isTag(prevSibling)) {
                    //         prevSibling.appendChild(breakNode);
                    //     }
                    // } else {
                    //     line.appendChild(createPilotNode());
                    // }
                }
            } else {
                line = createNewLine();
                editor.appendChild(line);
            }
            return line;
        };

        var prepareText = function(node) {
            if (isText(node)) {
                var parentNode = node.parentNode;
                if(isLine(parentNode)) {
                    var tagNode = createTagNode();
                    parentNode.insertBefore(tagNode, node);
                    tagNode.appendChild(node);
                    setCaret(node);
                }
            }
            return node;
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

        var isLine = function(node) {
            return node &&
                node.tagName == 'P' &&
                node.className === lineStyle;
        };

        var isTag = function(node) {
            return node && node.tagName == 'A';
        };

        var isEditor = function(node) {
            return node && node.isSameNode(editor);
        };

        var isText = function(node) {
            return node && node.nodeType == Node.TEXT_NODE;
        };

        var getKeyCode = function(e) {
            var code = e.which || e.keyCode || 0;
            logToConsole(code, 'Key');
            return code;
        }

        // Line is a <p> node within the editor. Navigate up the
        // range's ancestor tree until we hit either a <p> node or
        // the editor node. If on the editor node, return the first
        // available line.
        var getLine = function(range) {
            range = (typeof range === 'undefined') ? getCaret() : range;
            var line = null;
            if (range) {
                var node = range.endContainer;

                // Navigate up until a line node or editor node is reached.
                while (node && !isEditor(node) && !isLine(node)) {
                    node = node.parentNode;
                }

                // Return the line node or the first line node if editor.
                if (node) {
                    if (isLine(node)) {
                        line = node;
                    } else {
                        var selector = 'p.' + lineStyle + ':first-child';
                        line = node.querySelector(selector);
                    }
                }
            }
            return line;
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
        };

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

        var isDeleteKey = function(code) {
            return code == 8;
        };

        var isReturnKey = function(code) {
            return code == 13;
        };

        var isPrintableKey = function(code) {
            var isPrintable =
                code == 32 || // Spacebar key
                // code == 13 || // Return key
                (code > 47 && code < 58)   || // Number keys
                (code > 64 && code < 91)   || // Alphabet keys
                (code > 95 && code < 112)  || // Numpad keys
                (code > 185 && code < 193) || // ; = , - . / ` keys
                (code > 218 && code < 223);   // [ \ ] ' keys
            return isPrintable;
        };

        var processReturnKey = function() {
            if (ignoreReturnKey === false){
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
        };

        var getPreviousTag = function(node) {
            var prev = node.previousSibling;
            if (prev) {
                if (isLine(prev)) {
                    return prev.querySelector('a:last-child');
                } else if (isTag(prev)) {
                    return prev
                }
            } else {
                if (isTag(node)) {
                    return getPreviousTag(node.parentNode);
                } else {

                }
            }
        };

        var deleteText = function(node, offset) {
            if (isText(node)) {
                offset = (typeof offset === 'undefined') ? node.nodeValue.length
                                                         : offset;
                if (offset > 0) {
                    var str = node.nodeValue;
                    node.nodeValue = str.slice(0, offset-1) + str.slice(offset);
                    setCaret(node, offset-1);
                    prepareLine();
                } else {
                    node = getPreviousTag(node.parentNode);
                    setCaret(node.firstChild);
                }
            } else {
                console.log("Yikes!");
                console.log(node);
                var nextTag = getPreviousTag(node);
                if (nextTag) {
                    setCaret(nextTag.firstChild);
                }
            }
        };

        var processDeleteKey = function() {
            var range = getCaret();
            deleteText(range.endContainer, range.endOffset);
        };

        var processPastedInput = function(e) {
            var content;
            if (e.clipboardData) {
                content = (e.originalEvent || e).clipboardData.getData('text/plain');
            } else if (window.clipboardData) {
                content = window.clipboardData.getData('Text');
            }

            var container = getCaret().endContainer;
            if (isText(container)) {
                container.nodeValue = container.nodeValue + content;
                setCaret(container);
            } else {
                var textNode = document.createTextNode(content);
                container.insertBefore(textNode, container.firstChild);
                setCaret(textNode);
            }
            processInput();
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

            logToConsole(parts, 'splitter');

            if (numparts > 0) {
                var lastTagNode = container.parentNode;
                container.nodeValue = parts[numparts-1];
                decorator(lastTagNode, lastTagNode.firstChild.nodeValue);

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
                        decorator(tagNode, tagNode.firstChild.nodeValue);

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

        // Start handling events.
        editor.addEventListener('keydown', function(e) {
            processInputFlag = doBeforeKeypress(e);
            if (processInputFlag === true) {
                inputLineNumber = getLineNumber();

                var code = getKeyCode(e);
                if (isDeleteKey(code)) {
                    e.preventDefault();
                    processDeleteKey();
                } else if (isReturnKey(code)) {
                    if (ignoreReturnKey === true) {
                        e.preventDefault();
                        doOnReturnKey();
                    }
                } else if (isPrintableKey(code)) {
                    paragraphize();
                }
            }
        });

        editor.addEventListener('keyup', function(e) {
            if (processInputFlag === true) {
                var code = getKeyCode(e);
                var isPrintable = isPrintableKey(code);
                if (isPrintable) {
                    prepareLine();
                    processInput();
                } else {
                    console.log(getCaret().endContainer);
                }

                if (isReturnKey(code)){
                    processReturnKey();
                }
                doAfterKeypress();
            }
        });

        editor.addEventListener('paste', function(e) {
            if (doBeforePaste() === true) {
                e.preventDefault();
                processPastedInput(e);
                doAfterPaste();
            }
        });

        editor.addEventListener('click', function(e) {
            if (doBeforeClick() === true) {
                prepareEditor();
                doAfterClick();
            }
        });

        return this;
    };
})(jQuery);
