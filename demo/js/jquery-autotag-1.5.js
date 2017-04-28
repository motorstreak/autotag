
(function($) {
    "use strict";

    $.fn.autotag = function(config) {
        var editor = $(this)[0];

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
            if (node !== null) {
                offset = (typeof offset === 'undefined') ? node.length : offset;
                var range = getCaret();
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
            return getCaret();
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

        var getKeyCode = function(e) {
            return e.which || e.keyCode || 0;
        };

        var isPrintableKey = function(e) {
            var code = getKeyCode(e);
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

        var isEditor = function(node) {
            return node && node.isSameNode(editor);
        };

        var isLine = function(node) {
            return node && node.tagName == 'P'
        };

        var isText = function(node) {
            return node && node.nodeType == Node.TEXT_NODE;
        };

        var fixLine = function(node) {
        };

        var fixEditor = function() {
        };

        var fixText = function(node) {
            var parentNode = node.parentNode;
            if (isEditor(parentNode)) {
                var line = node.previousSibling;
                line = isLine(line) && line || createNewLine();
                line.appendChild(node);
                setCaret(node);
            }
        };

        var fixNode = function(node) {
            var lastChild = node.lastChild;
            if (isText(node)) {
                fixText(node);
            } else if (isLine(node)) {
                if (lastChild) {
                    fixNode(lastChild);
                } else {
                    createNewText(line);
                }
            } else if (isEditor(node)) {
                if (lastChild) {
                    fixNode(lastChild);
                } else {
                    createNewLine();
                }
            } else {
                // Noting to do here.
            }
        };

        var createNewLine = function(text) {
            text = text || document.createTextNode('\u200B');
            var line = document.createElement('p');
            line.appendChild(text);
            editor.appendChild(line);
            setCaret(text);
            return line;
        };

        var createNewText = function(line) {
            var text = document.createTextNode('\u200B');
            line.appendChild(text);
        };

        editor.addEventListener('click', function(e) {
            fixNode(getCaret().endContainer);
        });

        editor.addEventListener('keydown', function(e) {
            var keyCode = getKeyCode(e);
        });

        editor.addEventListener('keyup', function(e) {
            var keyCode = getKeyCode(e);
            if (isPrintableKey(e)) {
                var range = getCaret();
                fixNode(range.endContainer);
                // fixLine(range);
            } else if(keyCode == 13) {

            }
        });

        return this;
    };

})(jQuery);
