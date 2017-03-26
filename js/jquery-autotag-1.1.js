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

    // Wraps the input in a span element so that we can apply any
    // styles if required - for example, when a user adds a # in front
    // of this text.
    var wrapInput = function(str) {
      var wrapperNode = document.createElement("a");
      wrapperNode.appendChild(document.createTextNode(spaceToUnicode(str)));
      applyStyleToNode(wrapperNode, str);
      return wrapperNode;
    };

    // Apply styles to the input text if it is a hashtag or an attag.
    var applyStyleToNode = function(node, str) {
      if (str.match(/^[\s]*#[\w]/)) {
        node.className = 'hash-autotag';
      } else if (str.match(/^[\s]*@[\w]/)) {
        node.className = 'at-autotag';
      } else {
        node.removeAttribute("class");
      }
    };

    var appendNode = function(node, toNode) {
      toNode.parentNode.insertBefore(node, toNode.nextSibling);
    };

    var removeNode = function(node) {
      var parentNode = node && node.parentNode
      parentNode && parentNode.removeChild(node);
    }

    var processInput = function(e) {
      // Always get the current location to determine the current node
      // being operated on.
      var range = getCaretPosition();
      var offset = range.endOffset;
      var container = range.endContainer;
      var containerParent = container.parentNode;
      var input = container.nodeValue || '';
      var parts = input.match(/[,\.\s]*[^,\.\s]*/ig);

      if (parts != null) {
        parts = parts.filter(Boolean);
        var partsCount = parts.length;

        console.log(parts);

        if (partsCount > 0) {
          if (containerParent.tagName != 'A') {
            var wrapper = wrapInput(parts[0]);
            var newContainer = wrapper.firstChild;
            appendNode(wrapper, container);
            removeNode(container);
            setCaretPosition(newContainer, newContainer.length);
            container = newContainer;
            containerParent = container.parentNode;
          }

          applyStyleToNode(containerParent, container.nodeValue);

          var containerGrandParent = containerParent.parentNode;
          if (containerGrandParent.tagName != 'DIV' ||
              containerGrandParent.isSameNode(editor)) {
            var containerParentNextSibling = containerParent.nextSibling;
            var blockWrapper = blockWrap(containerParent);
            containerGrandParent.insertBefore(blockWrapper, containerParentNextSibling);
            setCaretPosition(container, container.length);
          }
        }

        if (partsCount > 1) {
          container.nodeValue = parts[0];
          for(var i=1; i<partsCount; i++) {
            var wrapper = wrapInput(parts[i]);
            var newContainer = wrapper.firstChild;
            appendNode(wrapper, containerParent);
            setCaretPosition(newContainer, newContainer.length);
            containerParent = newContainer.parentNode;
          }
        }
      }
    };

    // Prevent FF inserted <br> tags on Space.
    var processSpace = function(e) {
      var range = getCaretPosition();
      var offset = range.endOffset;
      var container = range.endContainer;
      var value = container.nodeValue;
      container.nodeValue =
        value.substring(0, offset) + "\u00a0"  + value.substring(offset);
      setCaretPosition(container, offset + 1);
      processInput();
    };

    var processNewline = function(e) {
      var range = getCaretPosition();
      var container = range.endContainer;
      var offset = range.endOffset;
      var value = container.nodeValue;
      // var parts = container.nodeValue.slice(range.endOffset);
      var parts = [value.substring(0, offset), value.substring(offset)];
      container.nodeValue = parts[0];
    };

    var editorHasNoText = function(){
      var walk = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
      return (walk.nextNode() == null);
    };

    var blockWrap = function(node) {
      // Add a newline wrapper.
      var blockNode = document.createElement("div");
      removeNode(node);
      blockNode.appendChild(node);
      return blockNode;
    };

    var prepareEditor = function() {
      if (editorHasNoText()) {
        while (editor.firstChild) {
          editor.removeChild(editor.firstChild);
        }
      }
    };

    editor.addEventListener('focus', function(e) {
      prepareEditor();
    });

    // Prevent FF from inserting ghost <br>s on Space.
    editor.addEventListener('keydown', function(e) {
      // prepareEditor();
      if (e.keyCode == 32) {
        processSpace(e);
        e.preventDefault();
      } else if (e.keyCode == 13) {
        processNewline(e);
        e.preventDefault();
      }
    });

    // Does not work on IE <= 8
    editor.addEventListener('keyup', function(e) {
      if (e.keyCode != 32 && e.keyCode != 13) {
        var nextSibling = getCaretPosition().endContainer.nextSibling;
        // Remove unwanted <br> tags inserted by firefox.
        if (nextSibling && nextSibling.tagName == 'BR') {
          removeNode(nextSibling);
        }
        if (e.keyCode > 40 && e.keyCode < 112) {
          processInput(e);
        }
      }
    });

    return this;
  };
})(jQuery);
