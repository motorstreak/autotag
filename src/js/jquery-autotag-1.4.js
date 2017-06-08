/*! jquery-autotag.js v1.4 https://github.com/motorstreak/jquery-autotag */
/*
 Version: 1.4
 Author: Navin Samuel
 Web: https://github.com/motorstreak/jquery-autotag
 Licensed under MIT License http://www.opensource.org/licenses/mit-license
*/

var Autotag = Autotag || {};
Autotag = (function() {
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

  return function(editor, config) {

    var activeSubmenu;

    // The line on which the input was captured. This is updated
    // each time a keyup event is triggered.
    var inputLineNumber;

    // Store status of beforeKeypress callback return.
    var processInputFlag;

    // Stores the last selection made in the editor.
    var selectionRange;

    var continuingStyle;

    var editorMenubar;

    // Map keeyboard controls to format options since we override them.
    var styleKeyMap = {
      66: 'font-weight:bold',
      73: 'font-style:italic',
      85: 'text-decoration:underline'
    };

    // Dump logs for testing.
    function logToConsole(data, msg) {
      msg = (typeof msg === 'undefined') ? '' : msg;
      if (trace) {
        console.log('TRACE : ' + msg + ' : ' + data);
      }
    }

    function debounce(func, wait, immediate) {
      var timeout;
      return function() {
        var context = this,
          args = arguments;
        var later = function() {
          timeout = null;
          if (!immediate) func.apply(context, args);
        };

        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);

        if (callNow) {
          func.apply(context, args);
        }
      };
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
      return true;
    };
    var doBeforeKeypress = config.beforeKeypress || function() {
      return true;
    };
    var doBeforePaste = config.beforePaste || function() {
      return true;
    };

    // A leading Tag node, required to maintain consistancy in behavior
    // across browsers.
    var addPilotNodeToLine = function(line) {
      var breakNode = createBreakNode();
      line.appendChild(breakNode);
      return breakNode;
    };

    // A Block node form a line element in the editor.
    var createBlockNode = function() {
      return document.createElement('p');
    };

    var createBreakNode = function() {
      var node = document.createElement('a');
      node.appendChild(document.createElement('br'));
      if (continuingStyle) {
        node.setAttribute('style', continuingStyle);
      }
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
      var tagNode = document.createElement('a');
      if (str) {
        tagNode.appendChild(createTextNode(str));
      }
      return tagNode;
    };

    var createTextNode = function(str) {
      // Firefox hack - without this, firefox will ignore the leading
      // space in the element causing all sorts of headache.
      str = str && str.replace(/ /g, '\u00a0') || '';
      return document.createTextNode(str);
    };

    var fixCaretPosition = function() {
      var range = getRange();
      var node = range.endContainer;
      if (node == range.startContainer) {
        if (isBreakTag(node)) {
          setCaret(node, 0);
        } else if (isTag(node)) {
          setCaret(node.lastChild);
        } else if (isLine(node)) {
          var tags = node.querySelectorAll('a');
          if (tags.length > 0) {
            var tag = tags[range.endOffset - 1] || tags[tags.length - 1];
            setCaret(tag.lastChild);
          }
        }
      }
    };

    var fixEditor = function(clear) {
      clear = (typeof clear === 'undefined') ? false : true;
      if (clear || !getFirstLine()) {
        removeAllChildNodes(editor);
        createNewLine();
      } else {
        // IE adds unwanted nodes sometimes.
        var lines = editor.childNodes;
        for (var i = 0; i < lines.length; i++) {
          if (lines[i].tagName !== 'P') {
            removeNode(lines[i]);
          }
        }
      }
    };

    var fixLine = function(line) {
      line = (typeof line === 'undefined') ? getLine() : line;
      if (isLine(line)) {
        if (line.textContent.length === 0) {
          removeAllChildNodes(line);
          setCaret(addPilotNodeToLine(line), 0);
        } else {
          removeBreakNodesOnLine(line);
        }
      }
      return line;
    };

    var fixText = function(node, offset) {
      offset = (typeof offset === 'undefined') ? 0 : offset;
      node = (typeof node === 'undefined') ? getRange().endContainer : node;
      if (isText(node)) {
        var parentNode = node.parentNode;
        if (isLine(parentNode)) {
          var tagNode = createTagNode();
          tagNode.appendChild(node);
          parentNode.insertBefore(tagNode, node);
          setCaret(node, offset);
        } else if (isTag(parentNode)) {
          removeBreakNodes(parentNode);
        }
      }
      return node;
    };

    var formatSelection = function(dataset) {
      if (selectionRange && dataset) {
        scope = dataset.autotagScope || 'text';
        // action = (typeof action === 'undefined') ? 'set' : action;

        var nodes;
        if (scope == 'editor') {
          // Do nothing for now.
        } else if (scope == 'line') {
          nodes = getLinesInRange(selectionRange);
        } else if (scope == 'text') {
          nodes = getTagsInRange(selectionRange);
        }

        for (var key in dataset) {
          if (dataset.hasOwnProperty(key) &&
            key.match(/^autotag(Toggle|Set|Unset|Increment|Decrement|Initialize)/)) {
            for (var i = 0; i < nodes.length; i++) {
              applyStyle(nodes[i], dataset[key].split(/\s*;\s*/), key);
            }
          }
        }
        resetRange(selectionRange);
      }
    };

    var getPixelAmount = function(value) {
      return parseInt(value && value.match(/^[-]*[0-9]+/)[0] || 0);
    };

    var applyStyle = function(node, declrations, action) {


      for (var j = 0; j < declrations.length; j++) {
        var declaration = declrations[j].split(/\s*:\s*/);
        var property = declaration[0];
        var value = declaration[1];

        var curValue = node.style.getPropertyValue(property);

        if (action == 'autotagUnset' ||
          action == 'autotagToggle' && curValue.length > 0) {
          node.style.removeProperty(property);

        } else if (action == 'autotagSet' ||
          (action == 'autotagInitialize' || action == 'autotagToggle') &&
          curValue.length === 0) {
          node.style.setProperty(property, value);

        } else {
          var amount = getPixelAmount(value);
          var curAmount = getPixelAmount(curValue);

          if (action == 'autotagIncrement') {
            curAmount += amount;
          } else if (action == 'autotagDecrement') {
            curAmount -= amount;
          }

          if (curAmount <= 0) {
            node.style.removeProperty(property);
          } else {
            node.style.setProperty(property, curAmount + 'px');
          }
        }
      }
    };

    var getFirstLine = function() {
      return editor.querySelector('p:first-child');
    };

    var getKeyCode = function(e) {
      return (e.which || e.keyCode || 0);
    };

    // Line is a <p> node within the editor. Navigate up the
    // range's ancestor tree until we hit either a <p> node or
    // the editor node.
    var getLine = function(node) {
      node = (typeof node === 'undefined') ?
        getRange().endContainer : node;
      while (node && !isEditor(node) && !isLine(node)) {
        node = node.parentNode;
      }
      return isLine(node) ? node : getFirstLine();
    };

    var getLineNumber = function(line) {
      line = (typeof line === 'undefined') ? getLine() : line;
      var lineNumber;
      if (isLine(line)) {
        lineNumber = 1;
        while ((line = line.previousSibling)) {
          lineNumber++;
        }
      }
      return lineNumber;
    };

    var getLinesInRange = function(range) {
      var line = getLine(range.startContainer);
      var endLine = getLine(range.endContainer);

      var lines = [line];
      while (line && (line !== endLine)) {
        lines.push(line = line.nextSibling);
      }
      return lines;
    };

    var getNextLine = function(line) {
      line = (typeof line === 'undefined') ? getLine() : line;
      return isLine(line) && line.nextSibling;
    };

    var getNextTag = function(node) {
      var next;
      if (node && !isEditor(node)) {
        if (isLine(node)) {
          next = node.firstChild;
        } else if (isTag(node)) {
          next = node.nextSibling ||
            getNextTag(node.parentNode.nextSibling);
        }

        if (!next) {
          next = getNextTag(node.parentNode.nextSibling);
        }

        if (isBreakTag(next)) {
          next = getNextTag(next.parentNode.nextSibling);
        }
      }
      return next;
    };

    var getPreviousLine = function(line) {
      line = (typeof line === 'undefined') ? getLine() : line;
      return isLine(line) && line.previousSibling;
    };

    var getRange = function() {
      var selection, range;
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

    var getStylePropertyValue = function(node, property) {
      return node &&
        property &&
        window.getComputedStyle(node, null).getPropertyValue(property);
    };

    var findTagInLine = function(line, index) {
      index = (typeof index === 'undefined' || index < 0) ? 0 : index;
      return line.querySelector('a:nth-child(' + index + ')');
    };

    var getTagsInRange = function(range) {
      var startNode = range.startContainer;
      var endNode = range.endContainer;

      var tag =
        isLine(startNode) && findTagInLine(startNode, range.startOffset + 1) ||
        isTag(startNode) && startNode ||
        isText(startNode) && startNode.parentNode;

      var endTag =
        isLine(endNode) && findTagInLine(endNode, range.endOffset) ||
        isTag(endNode) && endNode ||
        isText(endNode) && endNode.parentNode;

      var tags = [tag];
      while (tag && (tag !== endTag)) {
        tags.push(tag = getNextTag(tag));
      }
      return tags;
    };

    var getTextNodes = function(node) {
      var text;
      var textNodes = [];
      var walker = getTextWalker(node);

      while ((text = walker.nextNode())) {
        textNodes.push(text);
      }
      return textNodes;
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

    var gotoLine = function(line, wordPos) {
      wordPos = (typeof wordPos === 'undefined') ? 0 : wordPos;
      if (isLine(line)) {
        if (wordPos === 0) {
          var first = line.querySelector('a:first-child');
          setCaret(first, 0);
        } else {
          var tags = line.querySelectorAll('a');
          wordPos =
            (tags.length > wordPos) ? wordPos : (tags.length - 1);
          setCaret(tags[wordPos]);
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

    var isCaret = function(range) {
      return range.startContainer == range.endContainer &&
        range.startOffset == range.endOffset;
    };

    var isDeleteKey = function(code) {
      return code == 8;
    };

    var isEditor = function(node) {
      return node && node.isSameNode(editor);
    };

    var isFormatKey = function(code) {
      return (code == 66 || code == 73 || code == 85);
    };

    var isLine = function(node) {
      return node && node.tagName == 'P';
    };

    var isPrintableKey = function(code) {
      return (code == 32) || // Spacebar key
        (code > 47 && code < 58) || // Number keys
        (code > 64 && code < 91) || // Alphabet keys
        (code > 95 && code < 112) || // Numpad keys
        (code > 185 && code < 193) || // ; = , - . / ` keys
        (code > 218 && code < 223); // [ \ ] ' keys
    };

    var isReturnKey = function(code) {
      return code == 13;
    };

    var isTag = function(node) {
      return node && node.tagName == 'A';
    };

    var isText = function(node) {
      return node && node.nodeType == Node.TEXT_NODE;
    };

    var paragraphize = function(root, refresh) {
      root = (typeof root === 'undefined') ? editor : root;
      refresh = (typeof refresh === 'undefined') ? false : true;

      if (refresh) {
        removeNodesInList(root.querySelectorAll('div'));
      }

      if (isLine(root)) {
        var tagNodes = root.querySelectorAll('a');
        var tagNode, tagNodeHeight;
        for (var i = 0; i < tagNodes.length; i++) {
          softWrapNode(tagNodes[i]);
        }
      }
    };

    var processInput = function() {
      var range = getRange();
      var container = range.endContainer;

      if (isText(container)) {
        var offset = range.endOffset;
        fixText(container, offset);

        var refTag = container.parentNode;
        var parts = splitter(container.nodeValue || '');

        // Trim empty values from the array.
        parts = parts && parts.filter(Boolean) || '';
        var numparts = parts.length;

        logToConsole(parts, 'splitter');

        if (numparts > 1) {
          // Prevent caret jump in Safari by hiding the original node.
          refTag.style.display = 'none';

          var newTag, length;
          for (var i = 0; i < numparts; i++) {
            newTag = createTagNode(parts[i]);
            newTag.setAttribute('style', refTag.getAttribute('style'));
            newTag.style.display = 'inline';
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
      } else if (isTag(container) && isText(container.firstChild)) {
        decorator(container, container.firstChild.nodeValue);
      }
    };

    var processPastedInput = function(e) {
      var content;
      if (e.clipboardData) {
        content = (e.originalEvent || e)
          .clipboardData.getData('text/plain');
      } else if (window.clipboardData) {
        content = window.clipboardData.getData('Text');
      }

      var container = getRange().endContainer;

      // In IE, selecting full text (Ctrl + A) will position the caret
      // on the editor element.
      if (isEditor(container)) {
        fixEditor(true);
        container = getRange().endContainer;
      }

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
        fixEditor();
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
      return removeNodesInList(node && node.querySelectorAll('br'));
    };

    var removeBreakNodesOnLine = function(line) {
      line = (typeof line === 'undefined') ? getLine() : line;
      return isLine(line) && removeBreakNodes(line);
    };

    var removeNode = function(node) {
      return node && node.parentNode && node.parentNode.removeChild(node);
    };

    var removeNodesInList = function(nodeList) {
      for (var i = 0; nodeList && i <= nodeList.length; i++) {
        removeNode(nodeList[i]);
      }
      return nodeList;
    };

    // Clears all existing ranges and sets it to the provided one.
    var resetRange = function(range) {
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
      return range;
    };

    // Takes in the current node and sets the cursor location
    // on the first child, if the child is a Text node.
    var setCaret = function(node, offset) {
      return setSelection(node, offset, node, offset);
    };

    var setContinuingStyle = function() {
      var container = getRange().endContainer;
      var tag = isTag(container) && container ||
        isText(container) && container.parentNode;
      continuingStyle =
        tag && tag.getAttribute('style') || continuingStyle;
    };

    var setSelection = function(startContainer, startOffset, endContainer, endOffset) {
      var range;
      if (startContainer && endContainer) {
        startOffset = (typeof startOffset === 'undefined') ? 0 : startOffset;
        endOffset = (typeof endOffset === 'undefined') ? endContainer.length : endOffset;

        range = document.createRange();
        try {
          range.setStart(startContainer, startOffset);
          range.setEnd(endContainer, endOffset);
        } catch (err) {
          // Chrome does not like setting an offset of 1
          // on an empty node.
        }
        resetRange(range);
      }
      return range;
    };

    var softWrapNode = function(node) {
      if (node) {
        var fontSize = parseFloat(getStylePropertyValue(node, 'font-size'));
        if (node.getBoundingClientRect().height > fontSize * 1.3) {
          var wrap = node.previousSibling &&
            node.previousSibling.tagName === 'DIV';
          if (!wrap) {
            var wrapNode = document.createElement('div');
            node.parentNode.insertBefore(wrapNode, node);
          }
        }
      }
      return node;
    };

    editor.addEventListener('dblclick', function(e) {
      selectionRange = getRange();
    });

    document.addEventListener('selectionchange', debounce(function(e) {
      selectionRange = getRange();
    }, 250));

    editor.addEventListener('click', function(e) {
      removeNode(activeSubmenu);
      selectionRange = getRange();
      if (doBeforeClick()) {
        fixEditor();
        doAfterClick();
      }
    });

    editor.addEventListener('focus', function(e) {
      selectionRange = getRange();
      fixEditor();
    });

    // Start handling events.
    editor.addEventListener('keydown', function(e) {
      processInputFlag = doBeforeKeypress(e);
      if (processInputFlag === true) {
        inputLineNumber = getLineNumber();

        var code = getKeyCode(e);
        if (isDeleteKey(code)) {
          fixCaretPosition();
        } else if (isReturnKey(code)) {
          if (ignoreReturnKey) {
            e.preventDefault();
            doOnReturnKey();
          } else {
            setContinuingStyle();
          }
        } else if (e.metaKey && isFormatKey(code)) {
          e.preventDefault();
          formatSelection({
            autotagToggle: styleKeyMap[code]
          });
        }
      }
    });

    editor.addEventListener('keyup', function(e) {
      if (processInputFlag === true) {
        var code = getKeyCode(e);
        if (isDeleteKey(code)) {
          if (isEditor(getRange().endContainer)) {
            fixEditor();
          } else {
            fixLine();
          }
          paragraphize(getLine(), true);
        } else if (isReturnKey(code)) {
          processReturnKey();
        } else if (isPrintableKey(code)) {
          fixLine();
          processInput();
          paragraphize(getLine(), true);
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

    // Thanks to IE, we have to initialize the editor.
    fixEditor();

    var createPaletteCell = function(row, h, s, l) {
      var cell = document.createElement('span');
      var hsla = 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + '1.0)';
      cell.className = 'autotag-color';
      cell.style.color = cell.style.background = hsla;
      row.appendChild(cell);
    };

    var createPalette = function(menu) {
      var palette = document.createElement('div');
      palette.className = 'autotag-palette';
      menu.appendChild(palette);

      // Color palette
      var row;
      for (var s = 100, l = 96; s >= 50; s += -5, l += -6) {
        row = palette.appendChild(document.createElement('div'));
        for (var h = 0; h < 360; h += 32) {
          createPaletteCell(row, h, s, l);
        }
      }

      // Grayscale palette
      row = palette.appendChild(document.createElement('div'));
      for (l = 0; l <= 100; l += 9) {
        createPaletteCell(row, 0, 0, l);
      }

      activeSubmenu = palette;
    };

    var performMenuAction = function(menu) {
      removeNode(activeSubmenu);
      var action = menu.dataset.autotagAction;
      if (menu.dataset.autotagPalette) {
        createPalette(menu);
      } else {
        formatSelection(menu.dataset);

        // MAke sure to adjust wraps as required.
        paragraphize(getLine(), true);
      }
    };

    return {
      attachMenubar: function(menubar) {
        if (menubar) {
          editorMenubar = menubar;
          editorMenubar.addEventListener('click', function(e) {
            if (selectionRange) {
              resetRange(selectionRange);

              var target = e.target;
              if (target.classList.contains('autotag-menu')) {
                performMenuAction(target);
              } else if (target.classList.contains('autotag-color')) {
                var color = target.style.backgroundColor;
                var dataset = activeSubmenu.parentNode.dataset;

                var declration;
                if (dataset.autotagPalette == 'color') {
                  declaration = 'color: ' + color;
                } else if (dataset.autotagPalette == 'fill') {
                  declaration = 'background-color: ' + color;
                }
                dataset.autotagSet = declaration;
                formatSelection(dataset);
                removeNode(activeSubmenu);
              }
            } else {
              removeNode(activeSubmenu);
            }
          });
        }
      }
    };
  };
})();
