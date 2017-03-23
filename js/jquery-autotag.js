(function($) {
  $.fn.autotag = function() {
    var editor = $(this)[0];

    // Firefox hack - without this, firefox will ignore the leading
    // space in the span.
    var spaceToUnicode = function(str) {
      return str.replace(/ /g, '\u00a0');
    };

    var getCaretPosition = function() {
      var range;
      if(window.getSelection) {
        range = window.getSelection().getRangeAt(0);
      } else if(document.selection) {
        range = document.selection.createRange();
      }
      return range;
    };

    // Takes in the current node and sets the cursor location
    // on the first child, if the child is a Text node.
    var setCaretPosition = function(node, offset) {
      var range;
      if (node != null) {
        range =  getCaretPosition();
        range.setStart(node, offset);
        range.setEnd(node, offset);
        resetCaretPosition(range);
      }
      return range;
    };

    // Clears all existing ranges and sets it to the provided one.
    var resetCaretPosition = function(range) {
      if (range != null) {
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

    // Apply styles to the input text if it is a hashtag or an attag.
    var formatContainer = function(container, str) {
      if (str.match(/^#/)) {
        container.className = 'hash-autotag';
      } else if (str.match(/^@/)) {
        container.className = 'at-autotag';
      }
    };

    var createContainer = function(str) {
      var container;
      var textNode = document.createTextNode(spaceToUnicode(str));
      if (str.match(/^[#@]/)) {
        container = document.createElement("span");
        container.appendChild(textNode);
        formatContainer(container, str);
      } else {
        container = textNode;
      }
      return container;
    };

    var appendSibling = function(node, sibling) {
      node.parentNode.insertBefore(sibling, node.nextSibling);
    };

    var processInput = function(e) {

      // Always get the current location to determine the current node
      // being operated on.
      var range = getCaretPosition();
      var offset = range.endOffset;
      var node = range.endContainer;
      var input = node.nodeValue || '';

      var parts = input.match(/([#@](\w*[\b]*))|([^#@]+)/ig);
      if (parts != null) {
        parts = parts.filter(Boolean);

        var partsCount = parts.length;
        // Adjust the caret position if new nodes get added.
        if (partsCount > 1) {
          offset = parts[partsCount-1].length;
        }

        // console.log(parts);
        // console.log(offset);

        if (partsCount > 0) {
          var curContainer = node;
          for (var i=0; i < partsCount; i++) {
            var newContainer = createContainer(parts[i]);

            // We want to hop back only as far as outer span.
            var tmpNode = node;
            var tmpContainer = curContainer;
            while (!(tmpContainer.parentNode.isSameNode(editor) ||
              tmpContainer.tagName == 'SPAN')) {
              tmpNode = tmpNode.parentNode;
              tmpContainer = tmpContainer.parentNode;
            }

            // If we stopped traveresed dues to a an ancestor span,
            // set this as the container.
            if (tmpContainer.tagName == 'SPAN') {
              node = tmpNode;
              curContainer = tmpContainer;
            }

            appendSibling(curContainer, newContainer);
            curContainer = newContainer;
          }

          node.parentNode.removeChild(node);

          var curNode =
            curContainer.nodeType == Node.TEXT_NODE ? curContainer : curContainer.firstChild;
          // setCaretPosition(curNode, curNode.nodeValue.length);
          setCaretPosition(curNode, offset);
        }
      }
    };

    // Does not work on IE <= 8
    editor.addEventListener('keyup', function(e) {
      if (e.keyCode > 40 && e.keyCode < 112 || e.keyCode == 32) {
        processInput(e);
      }
    });

    // Accomodate chaining.
    return this;
  };
})(jQuery);
