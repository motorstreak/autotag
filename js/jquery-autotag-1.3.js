(function($) {
    $.fn.autotag = function() {
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

        var createTextNode = function(str) {
            // Firefox hack - without this, firefox will ignore the leading
            // space in the span.
            str = str.replace(/ /g, '\u00a0');
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
            var textNode = createTextNode(str);
            tagNode.appendChild(textNode);
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
        };

        var prepareEditor = function() {
            var node;
            var walker = document.createTreeWalker(
                editor,
                NodeFilter.SHOW_ELEMENT, {
                    acceptNode: function(node) {
                        if (node.tagName == 'T') {
                            return NodeFilter.FILTER_ACCEPT;
                        } else {
                            return NodeFilter.FILTER_SKIP;
                        }
                    }
                },
                false);
            if (walker.nextNode() == null) {
                var pilotNode = createPilotNode();
                node = pilotNode.firstChild;

                var blockNode = createBlockNode(pilotNode);
                removeAllChildNodes(editor);
                editor.appendChild(blockNode);
            } else {
                node = walker.currentNode;
            }
            setCaret(node, 0);
        };

        editor.addEventListener('keydown', function(e) {
        });

        editor.addEventListener('click', function(e) {
            console.log(getCaret());
        });

        editor.addEventListener('focus', function(e) {
            prepareEditor();
            // e.preventDefault();
        });

        return this;
    };
})(jQuery);
