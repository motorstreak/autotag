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

        // The line on which the input was captured. This is updated
        // each time a keyup event is triggered.
        var inputLineNumber;

        // Store status of beforeKeypress callback return.
        var processInputFlag;

        // Setting this to a span (or any other element) causes IE
        // to add additional HTML tags to the text, especially when
        // a URL is added to the attribute.
        var tagNodeName = 'a';

        function logToConsole(data, msg) {
            msg = (typeof msg === 'undefined') ? '' : msg;
            if (trace) {
                console.log('TRACE : ' + msg + ' : ' + data);
            }
        }

        // Initialize configuration.
        config = config || {};
        var ignoreReturnKey = config.ignoreReturnKey || false;
        var trace = config.trace || false;

        // Callbacks
        var decorator = config.decorator || function(node, text) {};
        var doOnReturnKey = config.onReturnKey || function() {};
        var splitter = config.splitter || function(str) {
            return str.match(/([^\s]+)|\s+/ig);
        };

        // Event callbacks
        var doAfterClick = config.afterClick || function() {};
        var doAfterKeypress = config.afterKeypress || function() {};
        var doAfterPaste = config.afterPaste || function() {};

        var doBeforeClick = config.beforeClick || function() {
            return true
        };
        var doBeforeKeypress = config.beforeKeypress || function() {
            return true
        };
        var doBeforePaste = config.beforePaste || function() {
            return true
        };


        // A leading Tag node, required to maintain consistancy in behavior
        // across browsers.
        var addPilotNodeToLine = function(line) {
            var breakNode = createBreakNode();
            line.appendChild(breakNode);
            return breakNode;
        };

        var appendNode = function(node, to) {
            to.parentNode.insertBefore(node, to.nextSibling);
            return node;
        };

        var prependNode = function(node, to) {
            to.parentNode.insertBefore(node, to);
            return node;
        };

        // A Block node form a line element in the editor.
        var createBlockNode = function() {
            return document.createElement('p');
        };

        var createBreakNode = function() {
            var node = document.createElement(tagNodeName);
            node.appendChild(document.createElement('br'));
            return node;
        };

        var createNewLine = function() {
            var line = createBlockNode();
            editor.appendChild(line);
            setCaret(addPilotNodeToLine(line), 0);
            return line;
        };

        // Every text node in the editor is wrapped in a Tag node.
        var createTagNode = function(str) {
            var tagNode = document.createElement(tagNodeName);
            str && tagNode.appendChild(createTextNode(str));
            return tagNode;
        };

        var createTextNode = function(str) {
            // Firefox hack - without this, firefox will ignore the leading
            // space in the element causing all sorts of headache.
            str = str && str.replace(/ /g, '\u00a0') || '';
            return document.createTextNode(str);
        };

        // Should always return a text node or return null.
        var getNextTextForDeletion = function(node, offset) {};

        var fixText = function(node, offset) {
            offset = (typeof offset === 'undefined') ? 0 : offset;
            node = (typeof node === 'undefined') ? getRange().endContainer : node;
            if (isText(node)) {
                var parentNode = node.parentNode;
                if (isLine(parentNode)) {
                    var tagNode = createTagNode();
                    parentNode.insertBefore(tagNode, node);
                    tagNode.appendChild(node);
                    setCaret(node, offset);
                } else if (isTag(parentNode)) {
                    removeBreakNodes(parentNode);
                }
            }
            return node;
        };

        var getRange = function() {
            var range;
            var selection;
            if (typeof window.getSelection != "undefined") {
                selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    range = selection.getRangeAt(0);
                }
            } else if ((selection = document.selection) &&
                selection.type != "Control") {
                range = selection.createRange();
            }
            return range;
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

        var getKeyCode = function(e) {
            var code = e.which || e.keyCode || 0;
            logToConsole(code, 'Key');
            return code;
        };

        // Line is a <p> node within the editor. Navigate up the
        // range's ancestor tree until we hit either a <p> node or
        // the editor node. If on the editor node, return the first
        // available line.
        var getLine = function(node) {
            node = (typeof range === 'undefined') ? getRange().endContainer : node;

            // Navigate up until a line node or editor node is reached.
            while (node && !isEditor(node) && !isLine(node)) {
                node = node.parentNode;
            }

            var line = node;
            if (!isLine(node)) {
                // Quite possibly at the editor level!
                line = node.querySelector('p:first-child');
            }

            return line;
        };

        var getLineNumber = function(line) {
            line = (typeof line === 'undefined') ? getLine() : line;
            var lineNumber = 1;
            if (isLine(line)) {
                while (line = line.previousSibling) {
                    lineNumber++;
                }
            }
            return lineNumber;
        };

        var getNextLine = function(line) {
            line = (typeof line === 'undefined') ? getLine() : line;
            return line && line.nextSibling;
        };

        var getPreviousLine = function(line) {
            line = (typeof line === 'undefined') ? getLine() : line;
            return line && line.previousSibling;
        };

        var getTextNodes = function(node) {
            var text;
            var textNodes = [];
            var walker = getTextWalker(node);

            while (text = walker.nextNode()) {
                textNodes.push(text);
            }
            return textNodes;
        };

        var gotoLine = function(line, pos) {
            if (line) {
                if (typeof pos !== 'undefined') {
                    if (pos === 0) {
                        var first = line.querySelector(tagNodeName + ':first-child');
                        if (first) {
                            setCaret(first, 0);
                        }
                    }
                } else {
                    var tags = line.querySelectorAll(toUpperCase);
                    var last = tags[tags.length - 1];
                    if (last) {
                        setCaret(last);
                    }
                }
            }
            return line;
        };

        var isBreak = function(node) {
            return node && node.tagName == 'BR';
        };

        var isBreakTag = function(node) {
            return isTag(node) && isBreak(node.lastChild);
        };

        var isDeleteKey = function(code) {
            return code == 8;
        };

        var isEditor = function(node) {
            return node && node.isSameNode(editor);
        };

        var isLine = function(node) {
            return node && node.tagName == 'P';
        };

        var isPrintableKey = function(code) {
            var isPrintable =
                code == 32 || // Spacebar key
                // code == 13 || // Return key
                (code > 47 && code < 58) || // Number keys
                (code > 64 && code < 91) || // Alphabet keys
                (code > 95 && code < 112) || // Numpad keys
                (code > 185 && code < 193) || // ; = , - . / ` keys
                (code > 218 && code < 223); // [ \ ] ' keys
            return isPrintable;
        };

        var isReturnKey = function(code) {
            return code == 13;
        };

        var isTag = function(node) {
            return node && node.tagName == tagNodeName.toUpperCase();
        };

        var isText = function(node) {
            return node && node.nodeType == Node.TEXT_NODE;
        };

        var fixLine = function(line) {
            line = (typeof line === 'undefined') ? getLine() : line;
            if (isLine(line)) {
                if (line.textContent.length === 0) {
                    removeAllChildNodes(line);
                    addPilotNodeToLine(line);
                } else {
                    removeBreakNodesOnLine(line);
                }
            }
        };

        var processInput = function() {
            var range = getRange();
            var container = range.endContainer;

            if (isText(container)) {
                var offset = range.endOffset;
                fixText(container, offset);

                var parts = splitter(container.nodeValue || '');

                // Trim empty values from the array.
                parts = parts && parts.filter(Boolean) || '';
                var numparts = parts.length;

                logToConsole(parts, 'splitter');

                var refTag = container.parentNode;
                if (numparts > 1) {
                    // Prevent caret jump in Safari by hiding the original node.
                    refTag.style.display = 'none';

                    var newTag, length;
                    for (var i = 0; i < numparts; i++) {
                        newTag = createTagNode(parts[i]);
                        decorator(newTag, newTag.firstChild.nodeValue);
                        refTag.parentNode.insertBefore(newTag, refTag.nextSibling);

                        length = parts[i].length;
                        if (offset > 0 && offset <= length) {
                            setCaret(newTag.firstChild, offset);
                        }

                        offset = offset - length;
                        refTag = newTag;
                    }
                    removeNode(container.parentNode);
                } else {
                    decorator(refTag, refTag.firstChild.nodeValue);
                }
            } else if (isTag(container)) {
                decorator(container, container.firstChild.nodeValue);
            }
        };

        var processPastedInput = function(e) {
            var content;
            if (e.clipboardData) {
                content = (e.originalEvent || e).clipboardData.getData('text/plain');
            } else if (window.clipboardData) {
                content = window.clipboardData.getData('Text');
            }

            var container = getRange().endContainer;
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

        var processReturnKey = function() {
            if (ignoreReturnKey === false) {
                var current = getLine();
                if (getLineNumber(current) == inputLineNumber) {
                    var next = getNextLine(current);
                    if (next !== null) {
                        fixLine(next);
                        gotoLine(next, 0);
                    }
                } else {
                    var prev = getPreviousLine(current);
                    fixLine(prev);
                    fixLine(current);
                    gotoLine(current, 0);
                }
                processInput();
            }
        };

        var removeAllChildNodes = function(node) {
            while (node && node.hasChildNodes()) {
                node.removeChild(node.lastChild);
            }
            return node;
        };

        var removeBreakNodes = function(node) {
            node && removeNodesInList(node.querySelectorAll('br'));
            return node;
        };

        var removeBreakNodesOnLine = function(line) {
            line = (typeof line === 'undefined') ? getLine() : line;
            isLine(line) && removeBreakNodes(line);
            return line;
        };

        var removeNode = function(node) {
            node && node.parentNode && node.parentNode.removeChild(node);
            return node;
        };

        var removeNodesInList = function(nodeList) {
            for (var i = 0; i <= nodeList.length; i++) {
                removeNode(nodeList[i]);
            }
            return nodeList;
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
            activeRange = range;
            return range;
        };

        // Takes in the current node and sets the cursor location
        // on the first child, if the child is a Text node.
        var setCaret = function(node, offset) {
            var range;
            if (node !== null) {
                offset = (typeof offset === 'undefined') ? node.length : offset;
                range = document.createRange();
                try {
                    range.setStart(node, offset);
                    range.setEnd(node, offset);
                } catch (err) {
                    // Chrome does not like setting an offset of 1
                    // on an empty node.
                }
                resetCaret(range);
            }
            return range;
        };

        editor.addEventListener('click', function(e) {
            if (doBeforeClick() === true) {
                getLine() || createNewLine();
                doAfterClick();
            }
        });

        // Start handling events.
        editor.addEventListener('keydown', function(e) {
            processInputFlag = doBeforeKeypress(e);
            if (processInputFlag === true) {
                inputLineNumber = getLineNumber();

                var code = getKeyCode(e);
                if (isDeleteKey(code)) {
                    if (isEditor(getRange().endContainer)) {
                        getLine() || createNewLine();
                        e.preventDefault();
                    }
                } else if (isReturnKey(code) && ignoreReturnKey) {
                    e.preventDefault();
                    doOnReturnKey();
                }
            }
        });

        editor.addEventListener('keyup', function(e) {
            if (processInputFlag === true) {
                var code = getKeyCode(e);

                if (isDeleteKey(code) && isEditor(getRange().endContainer)) {
                    getLine() || createNewLine();
                } else if (isReturnKey(code)) {
                    processReturnKey();
                } else if (isPrintableKey(code)) {
                    fixLine();
                    processInput();
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

        return this;
    };
})(jQuery);
