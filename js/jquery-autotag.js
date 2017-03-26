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
    var formatWrapper = function(wrapper, str) {
      if (str.match(/^#/)) {
        wrapper.className = 'hash-autotag';
      } else if (str.match(/^@/)) {
        wrapper.className = 'at-autotag';
      }
    };

    var createContainer = function(str) {
      var container = document.createTextNode(spaceToUnicode(str));
      if (str.match(/^[#@]/)) {
        var wrapper = document.createElement("span");
        wrapper.appendChild(container);
        formatWrapper(wrapper, str);
      }
      return container;
    };

    var appendContainer = function(toNode, container) {
      var nodeToAppend = container.parentNode || container;
      toNode.parentNode.insertBefore(nodeToAppend, toNode.nextSibling);
      return nodeToAppend;
    };

    var removeNode = function(node) {
      node && node.parentNode.removeChild(node);
    }

    var processInput = function(e) {
      // Always get the current location to determine the current node
      // being operated on.
      var range = getCaretPosition();
      var offset = range.endOffset;
      var container = range.endContainer;
      var input = container.nodeValue || '';

      //

      var parts = input.match(/([#@](\w*[\b]*))|([^#@]+)/ig);
      if (parts != null) {
        parts = parts.filter(Boolean);

        var partsCount = parts.length;
        // Adjust the caret position if new nodes get added.
        // if (partsCount > 0) {
        //   offset = parts[partsCount-1].length;
        // }
        var caretNodeIndex, partOffset = 0;
        for(caretNodeIndex=0; caretNodeIndex < parts.length; caretNodeIndex++) {
          partOffset = partOffset + part[caretNodeIndex].length;
          if (offset <= partOffset) {
            break;
          }
        }

        console.log(parts);
        console.log(offset);

        if (partsCount > 0) {
          var tmpNode = container;
          while (!(tmpNode.isSameNode(editor) ||
            tmpNode.tagName == 'SPAN')) {
            tmpNode = tmpNode.parentNode;
          }

          // If we stopped traveresed dues to a an ancestor span,
          // set this as the container.
          var wrapper;
          if (tmpNode.tagName == 'SPAN') {
            wrapper = tmpNode;
          }

          var ptrNode = wrapper || container;
          for (var i=0; i < partsCount; i++) {
            var newContainer = createContainer(parts[i]);
            ptrNode = appendContainer(ptrNode, newContainer);
          }

          var parentNode = container.parentNode;
          removeNode(container);
          if (parentNode.childNodes.length == 0) {
            removeNode(parentNode);
          }

          var curNode =
            ptrNode.nodeType == Node.TEXT_NODE ? ptrNode : ptrNode.firstChild;
          setCaretPosition(curNode, offset);
        }
      }
    };

    var removeTextNodes = function(node){
      var n;
      var walk = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
      while(n = walk.nextNode()) {
        n.parentNode.removeChild(n);
      }
    }

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
