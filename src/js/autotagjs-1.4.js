/*! autotagjs.js v1.4 https://github.com/motorstreak/autotag */
/*
 Version: 1.4
 Author: Navin Samuel
 Web: https://github.com/motorstreak/autotag
 Licensed under MIT License http://www.opensource.org/licenses/mit-license
*/

// var Autotag = Autotag || {};
var AutotagJS = (function() {
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
    //      afterSelection
    //
    // ignoreReturnKey: If set to true, return key presses will be
    //              ignored. False by default.
    //
    // onReturnKey: A callback function that gets invoked when a return key
    //              press is detected during the keydown event. The callback will
    //              only be made if the 'ignoreReturnKey' flag is set to true.
    //
    // trace:     Set this to true to see debug messages on the console.


    // Map keeyboard controls to format options since we override them.
    var styleKeyMap = {
        66: 'font-weight:bold',
        73: 'font-style:italic',
        85: 'text-decoration:underline'
    };

    var autoWordTag = 'span',
        autoLineTag = 'div',

        // Reserved class names
        blankListClassName = 'atg-list-blank',
        defaultListClassName = 'atg-list',
        menuClassName = 'atg-menu',
        paletteClassName = 'atg-palette',
        paletteCellClassName = 'atg-palette-cell',
        // paletteCellFillClassName = 'atg-palette-fill-cell',
        // paletteCellColorClassName = 'atg-palette-color-cell',
        paletteRowClassName = 'atg-palette-row',
        paletteCellCrossClassName = 'atg-crossed-cell',
        submenuClassName = 'atg-submenu';

    function initObject(obj, toObj) {
        return ((typeof obj === 'undefined') || obj == null) ? toObj : obj;
    }

    // A debounce function to damp event firing.
    function debounce(func, wait, immediate) {
        var timeout;
        return function() {
            var context = this,
                args = arguments;

            var later = function() {
                timeout = null;
                if (!immediate) {
                    func.apply(context, args);
                }
            };

            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);

            if (callNow) {
                func.apply(context, args);
            }
        };
    }

    // Some utility functions.
    function getKeyCode(e) {
        return (e.which || e.keyCode || 0);
    }

    function appendNode(toNode, node) {
        return toNode.parentNode.insertBefore(node, toNode.nextSibling);
    }

    function appendNodes(node, nodeList) {
        for (var i=0; i<nodeList.length; i++) {
            node = appendNode(node, nodeList[i]);
        }
    }

    function removeNode(node) {
        return node && node.parentNode.removeChild(node);
    }

    function removeNodesInList(nodeList) {
        for (var i=0; nodeList && i<nodeList.length; i++) {
            removeNode(nodeList[i]);
        }
    }

    function removeAllChildNodes (node) {
        while (node && node.hasChildNodes()) {
            node.removeChild(node.lastChild);
        }
    }

    function isTextNode(node) {
        return node && node.nodeType == Node.TEXT_NODE;
    }

    function isTabKey(code) {
        return code == 9;
    }

    function isReturnKey(code) {
        return code == 13;
    }

    function isDeleteKey(code) {
        return code == 8;
    }

    // Returns all direct childrten of node after applying
    // the filter function.
    function getChildren(node, filter) {
        var children = [];
        node = node.firstChild;

        while(node) {
            if (!filter || filter(node)) {
                children.push(node);
            }
            node = node.nextSibling;
        }
        return children;
    }

    function getSiblings(node, filter) {
        return getChildren(node.parentNode, filter);
    }

    function getRange() {
        var selection, range;
        if (typeof window.getSelection != 'undefined') {
            selection = window.getSelection();
            if (selection.rangeCount) {
                range = selection.getRangeAt(0);
            }
        } else if ((selection = document.selection) &&
            selection.type != 'Control') {
            range = selection.createRange();
        }

        return range;
    }

    // Clears all existing ranges and sets it to the provided one.
    function resetRange(range) {
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
    }

    // Returns true if the node is contained within the Range.
    function rangeIntersectsNode(range, node) {
        var nodeRange;
        if (range.intersectsNode) {
            return range.intersectsNode(node);
        } else {
            nodeRange = node.ownerDocument.createRange();
            try {
                nodeRange.selectNode(node);
            } catch (e) {
                nodeRange.selectNodeContents(node);
            }

            return range.compareBoundaryPoints(Range.END_TO_START, nodeRange) == -1 &&
                range.compareBoundaryPoints(Range.START_TO_END, nodeRange) == 1;
        }
    }

    function splitAtWord(str) {
        return str.match(/([^,\s\.]+)|[,\s\.]+/ig);
    }

    return function(editor, config) {
        var activeSubmenu,

            // The line on which the input was captured. This is updated
            // each time a keyup event is triggered.
            inputLineNumber,

            // Stores the last selection made in the editor.
            selectionRange,

            editorMenubar;

        // Continues the current text style to the next line and
        // across line breaks.
        var continuingTagStyle = '';

        // Initialize configuration.
        config = config || {};

        var ignoreReturnKey = config.ignoreReturnKey || false;
        var trace = config.trace || false;

        // Callbacks
        var decorator = config.decorator || function(node, text) {};

        // The default splitter splits on words.
        var splitter = config.splitter || splitAtWord;

        // Event callbacks
        var doAfterKeypress = config.afterKeypress || function() {};

        // Returns the tags under the selection.
        var doAfterSelection = config.afterSelection || function(tags) {};

        var doOnMenuClick = config.onMenuClick || function() {};

        var applyCommand = function(target, commands) {
            if (Array.isArray(target)) {
                for (var i = 0; i < target.length; i++) {
                    applyCommand(target[i], commands);
                }
            } else {
                for (var j = 0; j < commands.length; j++) {
                    var cmd = commands[j];
                    if (cmd == 'clear') {
                        // continuingStyle = null;
                        target.setAttribute('style', '');

                    } else if (cmd.match(/^list(\s+\w+(-\w+)*){1}/)) {
                        var listPrefix = cmd.split(/\s+/)[1];

                        switch(listPrefix) {
                            case 'clear':
                                // clearList(target);
                                break;
                            case 'indent':
                                indentLine(target);
                                break;

                            case 'outdent':
                                outdentLine(target);
                                break;

                            default:
                                indentLine(target, listPrefix);
                        }
                    }
                }
            }
        };

        var applyInstruction = function(nodes, instruction, declarations) {
            if (instruction == 'autotagjsCommand') {
                applyCommand(nodes, declarations);
            } else if (instruction == 'autotagjsCallback') {
                doOnMenuClick(declarations, nodes);
            } else {
                applyStyle(nodes, instruction, declarations);
            }
        };

        var applyStyle = function(target, instruction, declarations) {
            if (Array.isArray(target)) {
                for (var i = 0; i < target.length; i++) {
                    applyStyle(target[i], instruction, declarations);
                }
            } else {
                for (var j = 0; j < declarations.length; j++) {
                    var declaration = declarations[j].split(/\s*:\s*/),
                        property = declaration[0],
                        value = declaration[1];

                    var curValue = target.style.getPropertyValue(property);

                    if (instruction == 'autotagjsUnset' ||
                        instruction == 'autotagjsToggle' && curValue.length > 0) {
                        target.style.removeProperty(property);

                    } else if (instruction == 'autotagjsSet' ||
                        (instruction == 'autotagjsInitialize' ||
                        instruction == 'autotagjsToggle') &&
                        curValue.length === 0) {
                        target.style.setProperty(property, value);

                    } else if (instruction.match(/^autotagjs(Increment|Decrement)/)) {
                        curValue = curValue || getComputedStyle(target).getPropertyValue(property);
                        var amount = getPixelAmount(value),
                            curAmount = getPixelAmount(curValue);

                        if (instruction == 'autotagjsIncrement') {
                            curAmount += amount;
                        } else if (instruction == 'autotagjsDecrement') {
                            curAmount -= amount;
                        }

                        if (curAmount <= 0) {
                            target.style.removeProperty(property);
                        } else {
                            target.style.setProperty(property, curAmount + 'px');
                        }
                    }
                }
            }
        };

        var createPalette = function(menu, fill) {
            var palette = menu.getElementsByClassName(submenuClassName)[0];
            if (palette) {
                palette.style.display = '';
            } else {
                palette = document.createElement('div');
                palette.classList.add(submenuClassName);
                palette.classList.add(paletteClassName);
                menu.appendChild(palette);

                // Color palette
                var row, cell, maxCols = 10, maxRows = 5;

                var hueStep = Math.round(360 / maxCols),
                    saturationStep = Math.round(40 / maxRows),
                    luminosityStep = Math.round(80 / maxRows);

                for (var i = 0, s = 100, l = 94; i < maxRows; i++, s -= saturationStep, l -= luminosityStep) {
                    row = createPaletteRow(palette);
                    for (var j = 0, h = 0; j < maxCols; j++, h += hueStep) {
                        createPaletteCell(row, h, s, l, fill);
                    }
                }

                row = createPaletteRow(palette);
                luminosityStep = Math.round(100 / (maxCols-1));

                for (i = 0, l = luminosityStep; i < maxCols-1; i++, l += luminosityStep) {
                    createPaletteCell(row, 0, 0, l, fill);
                }
                createCrossedPaletteCell(row, fill);
            }
            activeSubmenu = palette;
        };

        var createPaletteCellAction = function(cell, type) {
            var dataset = cell.dataset;
            if (!dataset.autotagjsSet) {
                var style, color = dataset.autotagjsPaletteColor;

                if (type == 'color') {
                    style = 'color: ' + color;

                } else if (type == 'fill') {
                    style = 'background-color: ' + color;

                    var contrast = dataset.autotagjsPaletteContrastColor;
                    if (contrast) {
                        style = style + '; color: ' + contrast;
                    }
                }
                dataset.autotagjsSet = style;
            }
        };

        var createCrossedPaletteCell = function(row, fill) {
            var cell = createPaletteCell(row, 0, 0, 100);
            cell.classList.add(paletteCellCrossClassName);
            if (!fill) {
                cell.dataset.autotagjsPaletteColor = '#000';
            }
            return cell;
        };

        var createPaletteCell = function(row, h, s, l, fill) {
            var cell = document.createElement('div'),
                hsla = 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + '1.0)';
            cell.className = paletteCellClassName;
            cell.style.background = hsla;
            cell.dataset.autotagjsPaletteColor = hsla;
            if (fill) {
                cell.dataset.autotagjsPaletteContrastColor =
                    generateContrastColor(cell.style.background);
            }
            return row.appendChild(cell);
        };

        var generateContrastColor = function(rgbStr) {
            var rgb = rgbStr.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
            for (var i=1; i < rgb.length; i++) {
                rgb[i] = rgb[i]/255.0;
                rgb[i] =
                    (rgb[i] <= 0.03928) ? rgb[i]/12.92
                                        : Math.pow((rgb[i] + 0.055)/1.055, 2.4);
            }
            var lumin = rgb[1] * 0.2126 + rgb[2] * 0.7152 + rgb[3] * 0.0722;
            return (lumin > 0.179) ? '#000' : '#FFF';
        };

        var createPaletteRow = function(palette) {
            var row = document.createElement('div');
            row.className = paletteRowClassName;
            return palette.appendChild(row);
        };

        var createNewLine = function(refLine, options) {
            options = options || {};
            var line = document.createElement(autoLineTag);
            if (refLine) {
                // By default, attach as child of node.
                if (options.asSibling) {
                    refLine.parentNode.insertBefore(line, refLine.nextSibling);
                } else if (options.asPreviousSibling) {
                    refLine.parentNode.insertBefore(line, refLine);
                } else {
                    refLine.appendChild(line);
                }

                if (options.addPilotNode) {
                    var pilot = createTagNode('\u200b');
                    line.appendChild(pilot);

                    // Ensure that the pilot node is not an inline-block element.
                    // Inline Block elements do not get cursor when text is not
                    // present.
                    pilot.style.display = 'inline';

                    if (options.setCaret) {
                        setCaret(pilot);
                    }
                }
            }
            return line;
        };

        // Every text node in the editor is wrapped in a Tag node.
        var createTagNode = function(stringOrText, style) {
            var tag = document.createElement(autoWordTag),
                text;
            if (typeof stringOrText === 'string') {
                text = createTextNode(stringOrText);
            } else if (isTextNode(stringOrText)) {
                text = stringOrText;
            }

            if (text) {
                tag.appendChild(text);
            }

            tag.setAttribute('style', style || continuingTagStyle);
            return tag;
        };

        var createTextNode = function(str) {
            // Firefox hack - without this, firefox will ignore the leading
            // space in the element causing all sorts of headache.
            str = str && str.replace(/ /g, '\u00a0') || '';
            return document.createTextNode(str);
        };

        var fixCaret = function() {
            var range = getRange();
            var node = range.endContainer;

            if (isTag(node)) {
                setCaret(node.lastChild, 0);
            } else if (isLine(node)) {
                var tags = node.querySelectorAll(autoWordTag);
                if (tags.length > 0) {
                    var tag = tags[range.endOffset - 1] || tags[tags.length - 1];
                    setCaret(tag.lastChild);
                }
            }
        };

        var fixEditor = function(clear) {
            var lines = getChildren(editor, isLine);
            // If editor is empty, add a new break node.
            if (lines.length == 0) {
                createNewLine(editor, {addPilotNode: true, setCaret: true});
            } else {
                for (var i=0; i<lines.length; i++) {
                    if (!lines[i].hasChildNodes()) {
                        removeNode(lines[i]);
                    }
                }
            }
        };

        var fixLine = function(line, walkTree) {
            var tags = getChildren(line, isTag);
            for(var i=0; i<tags.length; i++) {
                if (isBlankNode(tags[i])) {
                    removeNode(tags[i]);
                }
            }

            var lines = getChildren(line, isLine);
            for (i=0; walkTree && i<lines.length; i++) {
                fixLine(lines[i], walkTree);
            }

            fixEditor();
        };

        var fixText = function(text) {
            if (isTextNode(text) && !isTag(text.parentNode)) {
                var tag = document.createElement(autoWordTag);
                text.parentNode.insertBefore(tag, text);
                tag.appendChild(text);
            }
        };

        var formatSelection = function(dataset) {
            if (selectionRange && dataset) {
                var nodes;
                switch (dataset.autotagjsScope) {
                    case 'line':
                        nodes = getLinesInRange(selectionRange);
                        break;
                    case 'selection':
                        var tags = getTagsInRange(selectionRange);
                        var lines = getLinesInRange(selectionRange);
                        if (lines.length > 1 ||
                            tags.length == getTagsInLine(getActiveLine()).length) {
                            nodes = tags.concat(lines);
                        } else {
                            nodes = tags;
                        }
                        break;
                    default:
                        nodes = getTagsInRange(selectionRange);
                }

                nodes = nodes.filter(Boolean);
                for (var key in dataset) {
                    if (dataset.hasOwnProperty(key)) {
                        applyInstruction(nodes, key, dataset[key].split(/\s*;\s*/));
                    }
                }
                resetRange(selectionRange);
            }
        };

        var getActiveLine = function(range) {
            range = range || getRange();
            return range && getLine(range.startContainer, false);
        };

        var getFirstLine = function() {
            return editor.querySelector(autoLineTag + ':first-child');
        };

        var getIndentationIndex = function(line) {
            var level = 0;
            while ((line = line.parentNode) && !isEditor(line)) {
                level++;
            }
            // Indentation index is only 3 levels deep.
            return (level == 0 ? null : (level % 3 || 3));
        };

        var getLine = function(node, walkTree) {
            while (node && !isEditor(node) && (walkTree || !isLine(node))) {
                node = node.parentNode;
            }
            return isLine(node) ? node : getFirstLine();
        };

        var getLinesInRange = function(range) {
            return getNodesInRange(range, NodeFilter.SHOW_ELEMENT, isLine);
        };

        var getLineNumber = function(line) {
            line = initObject(line, getActiveLine());

            var lineNumber;
            if (isLine(line)) {
                lineNumber = 1;
                while ((line = line.previousSibling)) {
                    lineNumber++;
                }
            }
            return lineNumber;
        };

        // Gets the list prefix for the given line. If no prefix is
        // found, go check ancestors.
        var getListPrefix = function(line) {
            if (isEditor(line)) {
                return 'autotagjs';
            }

            var names = line.className.match(/(\w+(-\w+)*)-list-\d+/);
            var prefix = names && names[1];
            return (prefix ? prefix : getListPrefix(line.parentNode));
        };

        var getNodesFromTree = function(walker, filter, limit) {
            var nodes = [];
            do {
                var node = walker.currentNode;
                if (!filter || filter(node)) {
                    nodes.push(node);
                }
            } while (walker.nextNode() && (!limit || nodes.length <= limit));
            return nodes;
        };

        var getNodesInRange = function(range, nodeFilter, filter) {
            var walker = getRangeWalker(range, nodeFilter, filter);
            return getNodesFromTree(walker, filter);
        };

        var getPixelAmount = function(value) {
            return parseInt(value && value.match(/^[-]*[0-9]+/)[0] || 0);
        };

        var getRangeContainersAndOffsets = function(range) {
            return {
                startContainer : range.startContainer,
                endContainer : range.endContainer,
                startOffset : range.startOffset,
                endOffset : range.endOffset
            };
        };

        var getRangeWalker = function(range, whatToShow, ancestorFilter) {
            ancestorFilter =  ancestorFilter || isTag;
            var ancestor = range.commonAncestorContainer ;

            // The ancestor node should be
            while(!ancestorFilter(ancestor) &&
                !isLine(ancestor) && !isEditor(ancestor)) {
                ancestor = ancestor.parentNode;
            }

            return getTreeWalker(ancestor, whatToShow, function(node) {
                return rangeIntersectsNode(range, node);
            });
        };

        var getRootLine = function(node) {
            var range = getRange();
            node = initObject(node, range && range.endContainer);
            return getLine(node, true);
        };

        var getStylePropertyValue = function(node, property) {
            return node &&
                property &&
                window.getComputedStyle(node, null).getPropertyValue(property);
        };

        var getTag = function(node) {
            if (isTextNode(node)) {
                return node.parentNode;
            } else if (isTag(node)) {
                return node;
            } else if (isLine(node)) {
                return getTagsInLine(node)[0];
            }
        };

        var getTagsInLine = function(line, deep) {
            if (deep) {
                var walker = getTreeWalker(line, NodeFilter.SHOW_ELEMENT);
                return getNodesFromTree(walker, isTag);
            } else {
                return getChildren(line, isTag);
            }
        };

        var getTagsInRange = function(range) {
            return getNodesInRange(range, NodeFilter.SHOW_ELEMENT, isTag);
        };

        var getTreeWalker = function(container, whatToShow, filter) {
            return document.createTreeWalker(
                container,
                whatToShow,
                function(node) {
                    return (!filter || filter(node)) ? NodeFilter.FILTER_ACCEPT
                                                     : NodeFilter.FILTER_REJECT;
                },
                false
            );
        };

        var gotoLine = function(line) {
            if (isLine(line)) {
                setCaret(line.querySelector(autoWordTag + ':first-child'), 0);
            }
        };

        var hideSubmenu = function() {
            if (activeSubmenu) {
                activeSubmenu.style.display = 'none';
            }
        };

        var indentLine = function(line, prefix, refresh) {
            if(!isListIndenter(line)) {
                refresh = initObject(refresh, true);
                prefix = initObject(prefix, getListPrefix(line));

                var selection = getRangeContainersAndOffsets(selectionRange);

                // The second check (isEdi..) is required to acomodate Firefox which
                // appends the next lines class to the top line on a delete.
                if (isBlankList(line) || !isEditor(line.parentNode) &&
                    isRootList(line)) {
                    updateList(line, prefix, getIndentationIndex(line), refresh);
                } else {
                    var rootLine = getRootLine(line),
                        anchor = line.previousSibling;

                    if (!isLine(anchor)) {
                        anchor = createNewLine();
                        line.parentNode.insertBefore(anchor, line);
                    }

                    initList(anchor);
                    anchor.appendChild(line);
                    updateList(line, prefix, getIndentationIndex(line), refresh);

                    // Now make line's children it's peer.
                    var children = getChildren(line, isLine);
                    for (var i=0; i < children.length; i++) {
                      line.parentNode.insertBefore(children[i], line.nextSibling);
                    }
                }
                setSelection(selection);
            }
        };

        // Enable every root line to be list capable.
        var initList = function(line) {
            if (isEditor(line.parentNode)) {
                updateListStyle(line, defaultListClassName);
                return true;
            }

            line.classList.remove(defaultListClassName);
            return false;
        };

        var isBlankNode = function(node) {
            if (node) {
                var str = node.textContent;
                return (str.length == 0 || str == '\u200b');
            }
        };

        var isBlankLine = function(node) {
            return isLine(node) && isBlankNode(node);
        };

        var isBlankList = function(line) {
            return line.classList.contains(blankListClassName);
        };

        var isEditor = function(node) {
            return node && node.isSameNode(editor);
        };

        var isFormatKey = function(code) {
            return (code == 66 || code == 73 || code == 85);
        };

        var isLine = function(node) {
            return node &&
                node.tagName == autoLineTag.toUpperCase() &&
                !isEditor(node);
        };

        var isListIndenter = function(line) {
            return !isEditor(line.parentNode) &&
                !line.className.match(/(\w+(-\w+)*)-list(-.+)*/g);
        };

        var isRootList = function(line) {
            return line.classList.contains(defaultListClassName);
        };

        var isTag = function(node) {
            return node && node.tagName == autoWordTag.toUpperCase();
        };

        var insertTab = function(node, index, shifted) {
            var tag = isTextNode(node) ? node.parentNode : node;
            if (isTag(tag) && !shifted) {
                var content = tag.textContent,
                    parent = tag.parentNode,
                    sibling = tag.nextSibling;

                var tab = createTagNode('    ');
                if (index === 0) {
                    parent.insertBefore(tab, tag);
                    setCaret(tag.firstChild, 0);

                } else if (index === tag.firstChild.length) {
                    parent.insertBefore(tab, sibling);
                    if (sibling) {
                        setCaret(sibling.firstChild, 0);
                    } else {
                        setCaret(tab.firstChild, 1);
                    }

                } else {
                    tag.textContent = content.substring(0, index);
                    parent.insertBefore(tab, sibling);

                    var lastTag = createTagNode(content.substring(index));
                    parent.insertBefore(lastTag, tab.nextSibling);
                    setCaret(lastTag.firstChild, 0);
                }
                return true;
            }
            return false;
        };

        var outdentLine = function(line, refresh) {
            if(!isListIndenter(line)) {
                refresh = initObject(refresh, true);
                var parentLine = line.parentNode;

                if (!initList(line)) {
                    var selection = getRangeContainersAndOffsets(selectionRange);
                    prefix = getListPrefix(line);

                    // Now make line's children the anchor's children.
                    var children = getChildren(line, isLine);
                    if (children.length > 0) {
                        var anchor = createNewLine();
                        initList(anchor);

                        line.insertBefore(anchor, children[0]);
                        for (var i=0; i < children.length; i++) {
                          anchor.appendChild(children[i]);
                        }
                    }

                    while (line.nextSibling) {
                        line.appendChild(line.nextSibling);
                    }

                    parentLine.parentNode.insertBefore(line, parentLine.nextSibling);

                    var indentIndex = getIndentationIndex(parentLine),
                        level = updateList(line, prefix, indentIndex, refresh);

                    if ((getChildren(parentLine, isLine) +
                        getChildren(parentLine, isTag)) == 0) {
                        removeNode(parentLine);
                    }

                    setSelection(selection);
                }
            }
        };

        var performMenuAction = function(menu) {
            hideSubmenu();
            if (menu.dataset.autotagjsPalette) {
                createPalette(menu, menu.dataset.autotagjsPalette == 'fill');
            } else if (menu.dataset.autotagjsSelect) {
                activeSubmenu = menu.getElementsByClassName(submenuClassName)[0];
                toggleSubmenu();
            } else {
                formatSelection(menu.dataset);
            }
        };

        var processInput = function() {
            var range = getRange();
            var container = range.endContainer;

            if (isTextNode(container)) {
                var value = container.nodeValue;
                if (value.match(/^\u200b/)) {
                    range.startContainer.nodeValue =
                        range.startContainer.nodeValue.replace(/\u200b/g, '');
                    range = setCaret(container, range.endOffset + 1);
                }

                var offset = range.endOffset;
                var refTag = container.parentNode,
                    parts = splitter(container.nodeValue || '');

                // Trim empty values from the array.
                parts = parts && parts.filter(Boolean) || '';
                var numparts = parts.length;

                if (numparts > 1) {
                    // Prevent caret jump in Safari by hiding the original node.
                    // refTag.style.display = 'none';

                    var newTag, length;
                    for (var i = 0; i < numparts; i++) {
                        newTag = createTagNode(
                            parts[i], refTag.getAttribute('style'));
                        newTag.style.display = 'inline-block';

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
                    refTag.style.display = 'inline-block';
                    decorator(refTag, refTag.firstChild.nodeValue);
                }
            } else if (isTag(container) && isTextNode(container.firstChild)) {
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
                container = getRange().endContainer;
            }

            if (isTextNode(container)) {
                container.nodeValue = container.nodeValue + content;
                setCaret(container);
            } else {
                var textNode = document.createTextNode(content);
                container.insertBefore(textNode, container.firstChild);
                setCaret(textNode);
            }
            processInput();
        };

        var processReturnKey = function(range) {
            if (range.collapsed) {
                var newLine,
                    container = range.startContainer,
                    offset = range.startOffset,
                    line = getLine(container);

                var tag = getTag(container);

                if (isEndOfLine(tag, offset)) {
                    newLine = createNewLine(line, {
                        asSibling: true,
                        addPilotNode: true,
                        setCaret: true
                    });

                } else if (isBeginingOfLine(tag, offset)) {
                    newLine = createNewLine(line, {
                        asPreviousSibling: true,
                        addPilotNode: true,
                        setCaret: true
                    });

                } else {
                    var newNode = container.splitText(range.startOffset);
                    var newTag = createTagNode(removeNode(newNode));
                    newLine = createNewLine(line, {asSibling: true});
                    newLine.appendChild(newTag);
                    setCaret(newNode, 0);

                    // Collect remaining tags and append them to the new line.
                    var tags = [];
                    while ((tag = tag.nextSibling)) {
                        tags.push(tag);
                    }
                    appendNodes(newTag, tags);
                }
                newLine.style = line.style;
                newLine.className = line.className;
            }
        };

        var removeListStyle = function(line) {
            updateListStyle(line, '');
        };

        var saveSelectionRange = function() {
            var range = getRange();
            if (range && range.startContainer.nodeType != 9) {
                selectionRange = getRange() || selectionRange;
                return selectionRange;
            }
        };

        var setBlankList = function(line) {
            updateListStyle(line, blankListClassName);
        };

        // Takes in the current node and sets the cursor location
        // on the first child, if the child is a Text node.
        var setCaret = function(node, offset) {
            if (node) {
                if (isTag(node)) {
                    node = node.firstChild;
                }

                offset = initObject(offset, node.length);
                return setSelection({
                    startContainer: node,
                    startOffset: offset,
                    endContainer: node,
                    endOffset: offset
                });
            }
        };

        var setContinuingTagStyle = function() {
            var range = getRange();
            if (range) {
                var tag = getTagsInRange(range).pop();
                if (tag) {
                    continuingTagStyle = tag.getAttribute('style');
                }
            }
        };

        var setListStyle = function(line, prefix, level, force) {
            if (prefix && level && (force || !isBlankList(line))) {
                updateListStyle(line, prefix + "-list-" + level);
            }
        };

        var setListCounter = function(line, prefix, level) {
            line.parentNode.style.setProperty(
                'counter-reset', prefix + "-counter-" + level);
            line.style.setProperty(
                'counter-reset', prefix + "-counter-" + (level + 1));
        };

        var setSelection = function(obj) {
            var range,
                startNode = obj.startContainer,
                endNode = obj.endContainer;

            if (startNode && endNode) {
                var startOffset = initObject(obj.startOffset, 0),
                    endOffset = initObject(obj.endOffset, endNode.length);
                range = document.createRange();
                try {
                    range.setStart(startNode, startOffset);
                    range.setEnd(endNode, endOffset);
                    selectionRange = range;
                } catch (err) {
                    // Chrome does not like setting an offset of 1
                    // on an empty node.
                }
                resetRange(range);
            }
            return range;
        };

        var toggleSubmenu = function() {
            if (activeSubmenu) {
                var style = window.getComputedStyle(activeSubmenu);
                activeSubmenu.style.display =
                    style.display === 'none' ? '' : 'none';
            }
        };

        var updateIndentation = function(keyCode, line, shifted) {
            if (isTabKey(keyCode)) {
                if (shifted) {
                    outdentLine(line, false);
                } else {
                    indentLine(line, null, false);
                }
            } else if (isDeleteKey(keyCode)) {
                if (!isBlankList(line)) {
                    setBlankList(line);
                } else {
                    outdentLine(line, false);
                }
            } else {
                return false;
            }
            return true;
        };

        var isBeginingOfLine = function(tag, offset) {
            return (isBlankNode(tag) || offset == 0) && !tag.previousSibling;
        };

        var isEndOfLine = function(tag, offset) {
            return !tag.nextSibling && offset == tag.textContent.length;
        };

        var processTabOrDeleteKey = function(range, keyCode, shifted) {
            if (range.collapsed) {
                var node = range.startContainer,
                    offset = range.startOffset,
                    line = getActiveLine();

                if (isBeginingOfLine(getTag(node), offset) &&
                    getIndentationIndex(line)) {
                    return updateIndentation(keyCode, line, shifted);
                }

                if (isTabKey(keyCode)) {
                    return insertTab(node, offset, shifted);
                }
            }

            // Perform regular delete operation if above conditions fail to
            // satisfy.
            if (isDeleteKey(keyCode)) {
                processDelete(getRange());
            }
        };

        var deleteChar = function(tag, offset) {
            var str = tag.textContent,
                textNode = tag.firstChild;

            offset = initObject(offset, str.length);
            textNode.nodeValue = str.slice(0, offset - 1) + str.slice(offset);

            if (textNode.nodeValue.length == 0 && offset == 1) {
                if (!tag.previousSibling) {
                    textNode.nodeValue = '\u200b';
                    tag.style.display = 'inline';
                    setCaret(tag);
                } else {
                    setCaret(tag.previousSibling);
                    removeNode(tag);
                }
            } else {
                setCaret(textNode, offset - 1);
            }
        };

        var deleteLine = function(line) {
            var prevLine = line.previousSibling;
            if (prevLine && isLine(prevLine)) {

                var prevTags = getTagsInLine(prevLine, true);
                var lastPrevTag = prevTags[prevTags.length - 1];

                if (isBlankLine(prevLine)) {
                    removeNode(prevLine);
                } else if (isBlankLine(line)) {
                    setCaret(lastPrevTag);
                    removeNode(line);
                } else {
                    setCaret(lastPrevTag);
                    var curTags = getTagsInLine(line);
                    for(var i=0; i<curTags.length; i++) {
                        appendNode(lastPrevTag, curTags[i]);
                        lastPrevTag = curTags[i];
                    }

                    if (isBlankLine(line)) {
                        removeNode(line);
                    }
                }
            }
        };

        var deleteSelection = function(range) {
            removeNodesInList(getTagsInRange(range));
            var lines = getLinesInRange(range);
            for (var i=0; i<lines.length; i++) {
                if (isBlankLine(lines[i])) {
                    removeNode(lines[i]);
                }
            }
            fixEditor();
        };

        var processDelete = function(range) {
            var offset = range.startOffset,
                container = range.startContainer;

            if (range.collapsed) {
                var tag = getTag(container);
                var target = tag;

                if (offset == 0 || isBlankNode(tag)) {
                    target = target.previousSibling;
                }

                // The previous sibling may be a tag if this line
                // follows a list.
                if (target && isTag(target)) {
                    // If offset is zero, send null as argument so that
                    // offset is calculated to be the full length of the
                    // string value in tag.
                    deleteChar(target, offset || null);

                } else {
                    deleteLine(getLine(tag));
                }
            } else {
                deleteSelection(range);
            }
        };

        // Updates the list style and counter for the given line.
        var updateList = function(line, prefix, level, force) {
            force = initObject(force, true);
            if (!initList(line)) {
                setListCounter(line, prefix, level);
                setListStyle(line, prefix, level, force);
            }
        };

        var updateListStyle = function(line, klass) {
            line.className = line.className.replace(/(\w+(-\w+)*)-list(-.+)*/g, '');
            line.classList.add(klass);
        };

        editor.addEventListener('dblclick', function(e) {
            saveSelectionRange();
        });

        editor.addEventListener('click', function(e) {
            hideSubmenu();
            fixEditor();
            fixCaret();
        });

        editor.addEventListener('focus', function(e) {
            fixEditor();
        });

        editor.addEventListener('input', function() {
            processInput();
        });

        // Start handling events.
        editor.addEventListener('keydown', function(e) {
            fixCaret();
            inputLineNumber = getLineNumber();
            var range = getRange(),
                keyCode = getKeyCode(e);

            if (isDeleteKey(keyCode) || isTabKey(keyCode)) {
                processTabOrDeleteKey(range, keyCode, e.shiftKey);
                e.preventDefault();

            } else if (isReturnKey(keyCode)) {
                if (!ignoreReturnKey) {
                    processReturnKey(range);
                }
                e.preventDefault();

            } else if (e.metaKey && isFormatKey(keyCode)) {
                formatSelection({ autotagjsToggle: styleKeyMap[keyCode] });
                e.preventDefault();
            }
        });

        editor.addEventListener('keyup', function(e) {
        });

        editor.addEventListener('paste', function(e) {
            e.preventDefault();
            processPastedInput(e);
        });

        document.addEventListener('selectionchange', debounce(function(e) {
            if (saveSelectionRange()) {
                setContinuingTagStyle();
                doAfterSelection(getTagsInRange(selectionRange));
            }
        }, 200));

        return {
            attachMenubar: function(menubar) {
                if (menubar) {
                    editorMenubar = menubar;
                    editorMenubar.addEventListener('click', function(e) {

                        // Ensure that the selection does not disapper after we have
                        // applied formatting.
                        resetRange(selectionRange);

                        var target = e.target;
                        var parent = target.parentNode;
                        if (parent.classList.contains(menuClassName)) {
                            target = parent;

                        } else if (target.classList.contains(paletteCellClassName)) {
                            createPaletteCellAction( target,
                                activeSubmenu.parentNode.dataset.autotagjsPalette);
                        }
                        performMenuAction(target);
                    });
                }
            }
        };
    };
}());
