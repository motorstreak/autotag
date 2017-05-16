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
    // newlineOnWrap: If set to true, instead of wrapping, overflowing text
    //              will be insrted into a new line, similar in behavior to
    //              pressing the return key.
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

        function afterClick() {}
        function afterKeypress() {}
        function afterPaste() {}
        function beforeClick() { return true; }
        function beforeKeypress(e) { return true; }
        function beforePaste() { return true; }

        // The default decorator applies a css class to text that begin
        // with a hash (#) or at (@) character.
        function decorate(node, text) {}

        // The default return key down event handler ignores
        // the keydown event.
        function onReturnKey() {}

        // The default tokenizer function.
        function split(str) {
            return str.match(/([^\s]+)|\s+/ig);
        }

        // Initialize configuration.
        config = config || {};
        var ignoreReturnKey = config.ignoreReturnKey || false;
        var newlineOnWrap = config.newlineOnWrap || false;
        var trace = config.trace || false;

        // Callbacks
        var decorator = config.decorator || decorate;
        var doOnReturnKey = config.onReturnKey || onReturnKey;
        var splitter = config.splitter || split;

        // Event callbacks
        var doAfterClick = config.afterClick || afterClick;
        var doAfterKeypress = config.afterKeypress || afterKeypress;
        var doAfterPaste = config.afterPaste || afterPaste;

        var doBeforeClick = config.beforeClick || beforeClick;
        var doBeforeKeypress = config.beforeKeypress || beforeKeypress;
        var doBeforePaste = config.beforePaste || beforePaste;


        // A leading Tag node, required to maintain consistancy in behavior
        // across browsers.
        var addPilotNode = function(line) {
            var breakNode = createBreakNode();
            line.appendChild(breakNode);
            return breakNode;
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

            var pilot = addPilotNode(line);
            setCaret(pilot, 0);
            return line;
        };

        // Every text node in the editor is wrapped in a Tag node.
        var createTagNode = function(str) {
            var tagNode = document.createElement(tagNodeName);
            if (str) {
                var textNode = createTextNode(str);
                tagNode.appendChild(textNode);
            }
            return tagNode;
        };

        var createTextNode = function(str) {
            // Firefox hack - without this, firefox will ignore the leading
            // space in the element causing all sorts of headache.
            str = str && str.replace(/ /g, '\u00a0') || '';
            return document.createTextNode(str);
        };

        var deleteText = function(node, offset) {
            // if (node) {
            //     if (isText(node) && offset > 0) {
            //         var value = node.nodeValue;
            //         var newOffset = offset - 1;
            //         node.nodeValue =
            //             value.slice(0, newOffset) + value.slice(offset);
            //
            //         // Replace empty tag nodes with break tags if required.
            //         if (newOffset === 0) {
            //             prepareLine();
            //         } else {
            //             setCaret(node, newOffset);
            //         }
            //     } else {
            //         // Node could be a break tag or at the
            //         // beginning of a regular tag.
            //         var next = getNextTextForDeletion(node);
            //         if (next) {
            //             deleteText(next, next.nodeValue.length);
            //         }
            //     }
            // }
        };

        // Should always return a text node or return null.
        var getNextTextForDeletion = function(node, offset) {
            // var nextText = null;
            // if (node && !isEditor(node)) {
            //     if (isBreakTag(node)) {
            //         node = node.previousSibling || node.parentNode;
            //     }
            //
            //     var next = node.previousSibling || node.parentNode;
            //     if ((node.textContent.length === 0)) {
            //         // An empty tag or a line with no text.
            //         removeNode(node);
            //     }
            //
            //     if (isText(next)) {
            //         nextText = next;
            //     } else if (isTag(next)) {
            //         nextText = next.lastChild || getNextTextForDeletion(next);
            //     } else if (isLine(next)) {
            //         var lastStop = next.lastChild;
            //         if (isBreakTag(lastStop)) {
            //             setCaret(lastStop, 0);
            //         } else if (isTag(lastStop)) {
            //             setCaret(lastStop.lastChild);
            //         } else {
            //             nextText = getNextTextForDeletion(next);
            //         }
            //     }
            // }
            // prepareEditor();
            // return nextText;
        };

        var fixTextParentNode = function(node) {
            if (isText(node)) {
                var parentNode = node.parentNode;
                if (isLine(parentNode)) {
                    var tagNode = createTagNode();
                    parentNode.insertBefore(tagNode, node);
                    tagNode.appendChild(node);
                    setCaret(node);
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
            node = (typeof range === 'undefined')  ? getRange().endContainer : node;
            var line = null;

            // Navigate up until a line node or editor node is reached.
            while (node && !isEditor(node) && !isLine(node)) {
                node = node.parentNode;
            }

            // Return the line node or the first line node if editor.
            if (node) {
                if (isLine(node)) {
                    line = node;
                } else {
                    // Some other node?
                    line = node.querySelector('p:first-child');
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

        var getNextLine = function(line) {
            line = (typeof line === 'undefined') ? getLine() : line;
            return line && line.nextSibling;
        };

        var getPreviousLine = function(line) {
            line = (typeof line === 'undefined') ? getLine() : line;
            return line && line.previousSibling;
        };

        // var getPreviousText = function(node) {
        //     var prevText;
        //     if (node && !isEditor(node)) {
        //         console.log("Node :" + (node.outerHTML || node.nodeValue) + ":");
        //
        //         var next = node.previousSibling || node.parentNode;
        //         console.log("Next :" + (next.outerHTML || next.nodeValue) + ":") ;
        //
        //         if (isText(node)) {
        //             if (node.nodeValue.length === 0) {
        //                 removeNode(node);
        //                 prevText = getPreviousText(next);
        //             } else {
        //                 prevText = node;
        //             }
        //         } else {
        //             var lineNumber;
        //             var tagNodes = node.querySelectorAll('a');
        //
        //             console.log(tagNodes);
        //
        //             if (isLine(node) &&
        //                     (lineNumber = getLineNumber(node)) &&
        //                     (lineNumber == 1 || (lineNumber != inputLineNumber))) {
        //
        //                     var tagNodeCount = tagNodes.length;
        //                     if (tagNodeCount > 1) {
        //                         setCaret(tagNodes[tagNodeCount - 1].lastChild);
        //                     } else if (tagNodeCount == 1) {
        //                         setCaret(tagNodes[0], 0);
        //                     }
        //                     // console.log(getRange());
        //             } else {
        //                 removeNode(node);
        //                 prevText = getPreviousText(next);
        //             }
        //         }
        //     }
        //     return prevText;
        // };



        var getTextNodes = function(node){
            var text;
            var textNodes = [];
            var walker = getTextWalker(node);
            while((text = walker.nextNode())) {
                textNodes.push(text);
            }
            return textNodes;
        };

        var gotoCurrentLine = function() {
            return gotoLine(getLine());
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

        var isDeleteKey = function(code) {
            return code == 8;
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

        var isEditor = function(node) {
            return node && node.isSameNode(editor);
        };

        var isText = function(node) {
            return node && node.nodeType == Node.TEXT_NODE;
        };

        var isBreak = function(node) {
            return node && node.tagName == 'BR';
        };

        var isBreakTag = function(node) {
            return isTag(node) && isBreak(node.lastChild);
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
                    var range = getRange();
                    var tagNode = range.endContainer.parentNode;
                    var lineRightPos = line.getBoundingClientRect().right;

                    if (isTag(tagNode)) {
                        var tagRightPos = tagNode.getBoundingClientRect().right;

                        // Start on a new line when tagNode is close to the
                        // edge of the current line.
                        logToConsole(tagRightPos + ':' + lineRightPos,
                            'Line to text block right position');

                        if ((tagRightPos + threshold) >= lineRightPos) {
                            var newLine = getNextLine(line) || createNewLine();
                            // line.parentNode.insertBefore(newLine, line.nextSibling);

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

        var prepareEditor = function() {
            var walker = getTextWalker(editor);
            var textNode = walker.nextNode();
            if (textNode === null) {
                removeAllChildNodes(editor);
                createNewLine();
            } else {
                prepareLine();
            }
        };

        var prepareLine = function(line) {
            line = (typeof line === 'undefined') ? getLine() : line;
            if (line) {
                var walker = getTextWalker(line);
                var textNode = walker && walker.nextNode();
                if (textNode === null || line.textContent.length === 0) {
                    // IE inserts <p><br/></p> on return at end of line.
                    // Change this to <p><a><br/></a></p>.
                    removeAllChildNodes(line);
                    var pilot = addPilotNode(line);

                    // FF requires the caret to be at offset 1.
                    // IE does not care! Chrome throws an exception.
                    setCaret(pilot, 0);
                } else {
                    // IE inserts <p>text<br></p> on return mid string.
                    // Change this to <p><a>text<br></a></p>.
                    while (textNode) {
                        fixTextParentNode(textNode);
                        textNode = walker.nextNode();
                    }

                    // Now deal with the last BR tag. If it exists and is
                    // a child of the line, reattach to the last tag node.
                    removeAllBreakNodes(line);
                    // addPilotNode(line);
                }
            } else {
                line = createNewLine();
            }
            return line;
        };

        var processDeleteKey = function() {
            var range = getRange();
            if (range.startOffset === range.endOffset) {
                deleteText(range.endContainer, range.endOffset);
                return true;
            } else {
                return false;
            }
        };

        var processInput = function(str) {
            fixTextParentNode(getRange().endContainer);

            var range = getRange();
            var offset = range.endOffset;
            var container = range.endContainer;

            var input = str || container.nodeValue || '';
            var parts = splitter(input);

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
                        prepareLine(next);
                        gotoLine(next, 0);
                    }
                } else {
                    var prev = getPreviousLine(current);
                    prepareLine(prev);
                    prepareLine(current);
                    gotoLine(current, 0);
                }
            }
        };

        var removeAllBreakNodes = function(node) {
            var i = 0;
            var breakNode;
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

        // var terminateLine = function(line) {
        //
        // };

        editor.addEventListener('click', function(e) {
            if (doBeforeClick() === true) {

                // The editor may be blank sometime (e.g first use).
                prepareEditor();

                // IE & Firefox may place the cursor outside the span.
                var node = getRange().endContainer;
                if (!isText(node)) {
                    // The last tag (n==1) is a break node.
                    var tags = node.querySelectorAll(tagNodeName);
                    var tagCount = tags.length;
                    if (tagCount == 1) {
                        setCaret(tags[0], 0);
                    } else if (tagCount > 1) {
                        setCaret(tags[tagCount -1].firstChild);
                    }
                }
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
                    if (processDeleteKey() === true) {
                        e.preventDefault();
                    }
                } else if (isReturnKey(code)) {
                    if (ignoreReturnKey === true) {
                        e.preventDefault();
                        doOnReturnKey();
                    }
                } else if (isPrintableKey(code)) {
                    if (newlineOnWrap === true) {
                        paragraphize();
                    }
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
                }

                if (isReturnKey(code)) {
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

        return this;
    };
})(jQuery);
