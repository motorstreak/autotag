(function($) {
  $.fn.autotag = function() {
    // var savedRange;

    // This is the only line of jQuery code in this plugin's body.
    // You can replace this with document.getElementById("someId") if you
    // prefer pure JS code (and ofcourse remove the plugin wrapper code).
    var rootNode = $(this)[0];

    // Uncomment to get focus on load.
    // rootNode.focus();

    var getCursorLocation = function() {
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
    var setCursorLocation = function(node) {
      var range;
      if (node != null) {
        range = document.createRange();
        range.setStart(node, 1);
        range.setEnd(node, 1);
        resetCursorLocation(range);
      }
      return range;
    };

    // Clears all existing ranges and sets it to the provided one.
    var resetCursorLocation = function(range) {
      // document.getElementById("area").focus();
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
      var wrapperNode = document.createElement("span");
      wrapperNode.appendChild(document.createTextNode(str));
      applyStyleToNode(wrapperNode, str);
      return wrapperNode;
    };

    // Apply styles to the input text if it is a hashtag or an attag.
    var applyStyleToNode = function(node, str) {
      if (str.match(/^[\s]*#/)) {
        node.className = 'hash-autotag';
      } else if (str.match(/^[\s]*@/)) {
        node.className = 'at-autotag';
      } else {
        node.className = '';
      }
    };

    // Text areas are created on the root node when the input area is used
    // for the first time. We do not want any text nodes directly on the
    // input area since we may have to apply styles to the first word in the
    // input.
    var wrapIfRootTextNode = function() {
      var endNode = savedRange.endContainer;
      var endNodeParent = endNode.parentNode;

      if (endNode.nodeType == Node.TEXT_NODE && endNodeParent.isSameNode(rootNode)) {
        var inputStr = savedRange.endContainer.nodeValue || '';
        var wrappedNode = wrapInput(inputStr);

        // Here, parentNode is the root node.
        endNodeParent.appendChild(wrappedNode);
        savedRange = setCursorLocation(wrappedNode.firstChild);

        // The text node is not required any more since we prefer to wrap
        // all text data within a span. The span itself can contain a text node.
        endNode.remove();
      }
    };

    var processInput = function(e) {
      // Always get the current location to determine the current node
      // being operated on.
      savedRange = getCursorLocation();

      var inputStr = savedRange.endContainer.nodeValue || '';
      if (inputStr.length > 0) {
        wrapIfRootTextNode();

        // savedRange may have got updated in wrapIfRootTextNode()
        var endNode = savedRange.endContainer;
        var endNodeParent = endNode.parentNode;

        // Split the string based on the following seperators - comma,
        // period and space.
        var words = inputStr.match(/[,\.\s]*[^,\.\s]*/ig);
        if (words.length > 1) {

          endNode.nodeValue = words[0];
          applyStyleToNode(endNodeParent, words[0]);
          savedRange.setEnd(endNode, words[0].length);

          for (var i=1; i < words.length; i++) {
            if (words[i].length > 0) {

              // Wrap each substring in a span.
              var wrappedNode = wrapInput(words[i]);
              endNodeParent.parentNode
                .insertBefore(wrappedNode, endNodeParent.nextSibling);

              // Create a new range
              savedRange = setCursorLocation(wrappedNode.firstChild);
              endNodeParent = savedRange.endContainer.parentNode;
            }
          }
        }
      }
    };

    // Process input and create tags as the user types!
    $(this).on("keyup", function(e) {
      processInput(e);
    });

    // Accomodate chaining.
    return this;
  };
})(jQuery);
