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
    var _styleKeyMap = {
        66: 'font-weight:bold',
        73: 'font-style:italic',
        85: 'text-decoration:underline'
    };

    var _autoWordTag = 'span',
        _autoLineTag = 'div',

        // All selection is copied to the clipboard buffer.
        _clipboardBuffer,

        // Reserved class names
        _blankListClassName = 'atg-list-blank',
        _defaultListClassName = 'atg-list',
        _menuClassName = 'atg-menu',
        _paletteClassName = 'atg-palette',
        _paletteCellClassName = 'atg-palette-cell',
        _paletteRowClassName = 'atg-palette-row',
        _paletteCellCrossClassName = 'atg-crossed-cell',
        _submenuClassName = 'atg-submenu';

    /**
     * Callback for node selection.
     * @callback nodeFilterCallback
     * @param {Node} node - The node to be examined.
     * @returns {boolean} - Returns true or false based on the filter.
     */

    /**
     * Initializes the given object to a given value if it is undefined or null.
     * Returns the object as is otherwise.
     * @param {Object} obj - The object to initialize.
     * @param {Object} toObj - The value to initialize the object to.
     * @returns {Object} - The initialized object.
     */
    function initObject(obj, toObj) {
        return ((typeof obj === 'undefined') || obj == null) ? toObj : obj;
    }

    /**
     * A debounce function to damp event firing.
     * @param {Object} func - The callback function.
     * @param {number} wait - Milliseconds to wait between invocations.
     * @param {boolean=} immediate - Set to true to force invocation.
     */
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

    /**
     * Returns the code of the key event.
     * @param {Object} e - The captured event.
     * @return {number} - The numerical key value.
     */
    function getKeyCode(e) {
        return (e.which || e.keyCode || 0);
    }

    /**
     * Appends one node to another.
     * @param {Node} toNode - The node to append to.
     * @param {Node} node - The node being appended.
     * @return {Node} - The appended node.
     */
    function appendNode(toNode, node) {
        return toNode.parentNode.insertBefore(node, toNode.nextSibling);
    }

    /**
     * Appends the nodes in the list to the given node.
     * @param {Node} toNode - The node to append to.
     * @param {NodeList} nodeList - The list of nodes to append.
     */
    function appendNodes(toNode, nodeList) {
        for (var i=0; i<nodeList.length; i++) {
            toNode = appendNode(toNode, nodeList[i]);
        }
    }

    /**
     * Hides (if visible) or shows (if hidden) the given node.
     * @param {Node} node - The node to hide or show.
     */
    function toggleNodeVisibility(node) {
        var style = window.getComputedStyle(node);
        node.style.display = (style.display === 'none') ? '' : 'none';
    }

    /**
     * Hides the provided node.
     * @param {Node} node - The node to hide.
     */
    function hideNode (node) {
        node.style.display = 'none';
    }

    /**
     * Shows the provided node.
     * @param {Node} node - The node to make visible.
     */
    function showNode (node) {
        if (window.getComputedStyle(node).display === 'none') {
            node.style.display = '';
        }
    }

    /**
     * Removes the given node from the DOM and return it.
     * @param {Node} node - The node to be removed.
     * @returns {Node} - The removed node.
     */
    function removeNode(node) {
        return node && node.parentNode.removeChild(node);
    }

    /**
     * Removes the node in the NodeList from the DOM.
     * @param {NodeList} nodeList - The list of nodes to be removed.
     */
    function removeNodesInList(nodeList) {
        for (var i=0; nodeList && i<nodeList.length; i++) {
            removeNode(nodeList[i]);
        }
    }

    /**
     * Removes all immediate child nodes of the given node from the DOM.
     * @param {Node} node - The node whose children are to be removed.
     */
    function removeAllChildNodes (node) {
        while (node && node.hasChildNodes()) {
            node.removeChild(node.lastChild);
        }
    }

    /**
     * Validates if the given node is a TextNode.
     * @param {Node} node - The node to be validated.
     * @returns {boolean} - Returns true is the node is a Text Node, false
     * otherwise
     */
    function isTextNode(node) {
        return node && node.nodeType == Node.TEXT_NODE;
    }

    /**
     * Validates if the given key code is that of a Tab key.
     * @param {numbet} code - The key code to be validated.
     * @returns {boolean} - Returns true if it is a Tab key code, false
     * otherwise.
     */
    function isTabKey(code) {
        return code == 9;
    }

    /**
     * Validates if the given key code is that of a Return key.
     * @param {numbet} code - The key code to be validated.
     * @returns {boolean} - Returns true if it is a Return key code, false
     * otherwise.
     */
    function isReturnKey(code) {
        return code == 13;
    }

    /**
     * Validates if the given key code is that of a Delete key.
     * @param {numbet} code - The key code to be validated.
     * @returns {boolean} - Returns true if it is a Delete key code, false
     * otherwise.
     */
    function isDeleteKey(code) {
        return code == 8;
    }

    /**
     * Gets all the children of a node that satisfy the conditions in the
     * provided filter. If none match, an empty list is returned.
     * @param {Node} node - The node whose children are to be extracted.
     * @param {nodeFilterCallback} filter - A node filter callback that
     * determines if this node should be included in the list.
     * @returns {Array} - An Array containing the selected children.
     */
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

    /**
     * Returns all siblings of the given node.
     * @param {Node} node - the node whose siblings are requested.
     * @param {nodeFilterCallback} filter - A node filter callback that
     * determines if this node should be included in the list.
     * @returns {Array} - An Array containing sibling nodes.
     */
    function getSiblings(node, filter) {
        return getChildren(node.parentNode, filter);
    }

    /**
     * Returns the current Range for the selection.
     * @returns {Range} - The Range object for the current selection.
     */
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

    /**
     * Clears all existing ranges and sets it to the provided one.
     * @param {Range} - The new Range.
     */
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

    /**
     * Determines if the given node lies within the selection.
     * @param {Range} range - The Range to search within.
     * @param {Node} node - The node to search for.
     * @returns {boolean} - True if the node falls within the range, false
     * otherwise.
     */
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

    /**
     * Splits the provided string and tokenizes at word boundary.
     * Example:
     *    splitAtWord("This is a sentence.")
     *    => ["This", " ", "is", " ", "a", " ", "sentence", "."]
     * @param {string} str - The string to split.
     * @returns {Array} - Returns an array containing the parts of the string.
     */
    function splitAtWord(str) {
        return str.match(/([^,\s\.]+)|[,\s\.]+/ig);
    }

    /**
     * Checks if the keycode is a format key (B, I & U for Bold, Italic and
     * Underline).
     * @param {number} code - The key code.
     * @returns {boolean} - True if code is a format key.
     */
    function isFormatKey(code) {
        return (code == 66 || code == 73 || code == 85);
    }

    return function(editor, config) {
        // Stores the last selection made in the editor.
        var _selectionRange,
            _editorMenubar,

            // Continues the current text style to the next line and
            // across line breaks.
            _continuingTagStyle = '';

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

        /**
         * Processes one or more atg-command instructions on the targets
         * specified.
         * @param {Object} target - A single Node or an array of nodes.
         * @param {Array} commands - An array of autotag commands.
         */
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

        /**
         * Process the autotag instructions on the given set of nodes.
         * @param {Array} nodes - An array of nodes on which to apply the
         * instrcution.
         * @param {string} instruction - The autotag instruction to process.
         * @param {Array} declarations - An array of CSS declarations to apply.
         */
        var processInstruction = function(nodes, instruction, declarations) {
            if (instruction == 'atgCommand') {
                applyCommand(nodes, declarations);
            } else if (instruction == 'atgCallback') {
                doOnMenuClick(declarations, nodes);
            } else {
                applyStyle(nodes, instruction, declarations);
            }
        };

        /**
         * Apply the declarations specified in the autotag instruction.
         * @param {Object} target - A single Node or an array of nodes to apply
         * the css declarations on.
         * @param {string} instruction - The autotag instruction to process.
         * @param {Array} declarations - An array of CSS declarations to apply.
         */
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

                    if (instruction == 'atgUnset' ||
                        instruction == 'atgToggle' && curValue.length > 0) {
                        target.style.removeProperty(property);

                    } else if (instruction == 'atgSet' ||
                        (instruction == 'atgInitialize' ||
                        instruction == 'atgToggle') &&
                        curValue.length === 0) {
                        target.style.setProperty(property, value);

                    } else if (instruction.match(/^atg(Increment|Decrement)/)) {
                        curValue = curValue || getComputedStyle(target).getPropertyValue(property);
                        var amount = extractAmount(value),
                            curAmount = extractAmount(curValue);

                        if (instruction == 'atgIncrement') {
                            curAmount += amount;
                        } else if (instruction == 'atgDecrement') {
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

        /**
         * Creates the palette submenu.
         * @param {Node} menu - The menu to attach the submenu to.
         * @param {string} type - The kind of palette to show.
         */
        var createPalette = function(menu, type) {
            var palette = menu.getElementsByClassName(_submenuClassName)[0];
            if (palette) {
                palette.style.display = '';
            } else {
                palette = document.createElement('div');
                palette.classList.add(_submenuClassName);
                palette.classList.add(_paletteClassName);
                palette.dataset.atgPalette = type;
                menu.appendChild(palette);

                // Color palette
                var row, cell, maxCols = 10, maxRows = 5;

                var hueStep = Math.round(360 / maxCols),
                    saturationStep = Math.round(40 / maxRows),
                    luminosityStep = Math.round(80 / maxRows);

                for (var i = 0, s = 100, l = 94; i < maxRows; i++, s -= saturationStep, l -= luminosityStep) {
                    row = createPaletteRow(palette);
                    for (var j = 0, h = 0; j < maxCols; j++, h += hueStep) {
                        createPaletteCell(row, h, s, l, type);
                    }
                }

                row = createPaletteRow(palette);
                luminosityStep = Math.round(100 / (maxCols-1));

                for (i = 0, l = luminosityStep; i < maxCols-1; i++, l += luminosityStep) {
                    createPaletteCell(row, 0, 0, l, type);
                }
                createCrossedPaletteCell(row, type);
            }
            _activeSubmenu = palette;
        };

        /**
         * Create the style to apply on the selection and set it on the palette
         * cell.
         * @param {Node} cell - The palette cell to set the selected color.
         * @param {string} type - The palette type.
         */
        var createPaletteCellAction = function(cell, type) {
            var dataset = cell.dataset;
            if (!dataset.atgSet) {
                var style, color = dataset.atgPaletteColor;

                if (type === 'color') {
                    style = 'color: ' + color;

                } else if (type === 'highlight') {
                    style = 'background-color: ' + color;

                    var contrast = dataset.atgPaletteContrastColor;
                    if (contrast) {
                        style = style + '; color: ' + contrast;
                    }
                }
                dataset.atgSet = style;
            }
        };

        /**
         * Create the palette cell used to clear color/highlight formatting.
         * @param {Node} row - The node corresponing to the row in which to
         * create the 'clear' cell.
         * @param {string} type - The palette type.
         */
        var createCrossedPaletteCell = function(row, type) {
            var cell = createPaletteCell(row, 0, 0, 100);
            cell.classList.add(_paletteCellCrossClassName);
            if (type === 'color') {
                cell.dataset.atgPaletteColor = '#000';
            }
            return cell;
        };

        /**
         * Create the palette cell on the given row with the provided hsla
         * color values.
         * @param {Node} row - The node corresponing to the row in which to
         * create the cell.
         * @param {number} h - The hue value of the cell color.
         * @param {number} s - The saturaltion value of the cell color.
         * @param {number} l - The luminance value of the cell color.
         * @param {string} type - The palette type.
         */

        var createPaletteCell = function(row, h, s, l, type) {
            var cell = document.createElement('div'),
                hsla = 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + '1.0)';
            cell.className = _paletteCellClassName;
            cell.style.background = hsla;
            cell.dataset.atgPaletteColor = hsla;
            if (type === 'highlight') {
                cell.dataset.atgPaletteContrastColor =
                    generateContrastColor(cell.style.background);
            }
            return row.appendChild(cell);
        };

        /**
         * Generates and returns the contrast color value for a given RGB value.
         * The contrast color is used for the text color in the 'highlight'
         * palette.
         * @param {string} rgbStr - The RGB CSS color value.
         * @returns {string} - Color value of the contrast color.
         */
        var generateContrastColor = function(rgbStr) {
            var rgb = rgbStr.match(/[.?\d]+/g);
            for (var i=0; i < 3; i++) {
                rgb[i] = rgb[i]/255.0;
                rgb[i] =
                    (rgb[i] <= 0.03928) ? rgb[i]/12.92
                                        : Math.pow((rgb[i] + 0.055)/1.055, 2.4);
            }
            var lumin = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
            return (lumin > 0.179) ? '#000' : '#FFF';
        };

        /**
         * Creates the node corresponding to the palette row.
         * @param {Node} palette - The palette node to add the new row to.
         * @returns {Node} - The newly created palette row.
         */
        var createPaletteRow = function(palette) {
            var row = document.createElement('div');
            row.className = _paletteRowClassName;
            return palette.appendChild(row);
        };

        var createNewLine = function(refLine, options) {
            options = options || {};
            var line = document.createElement(_autoLineTag);
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

                    if (options.setCaret) {
                        setCaret(pilot);
                    }
                }
            }
            return line;
        };

        /**
         * Creates a node (Tag Node) containing the provided string or Text
         * node and applies the provided style to it. If a style is not
         * provided, set style to the last applied one. Every text node in
         * the editor is wrapped in a Tag node.
         * @param {Object} stringOrText - A string or Text node object to be
         * wrapped as a Tag.
         * @param {string} style - A string containing CSS style declarations.
         * @returns {Node} - The newly create Tag node.
         */
        var createTagNode = function(stringOrText, style) {
            var tag = document.createElement(_autoWordTag),
                text;
            if (typeof stringOrText === 'string') {
                text = createTextNode(stringOrText);
            } else if (isTextNode(stringOrText)) {
                text = stringOrText;
            }

            if (text) {
                tag.appendChild(text);
            }

            tag.setAttribute('style', style || _continuingTagStyle);
            return tag;
        };

        /**
         * Create a new Text Node with the provided string.
         * @param {string} str - The string to be converted to Text Node.
         * @returns {Node} - The newly created Text node.
         */
        var createTextNode = function(str) {
            // Firefox hack - without this, firefox will ignore the leading
            // space in the element causing all sorts of headache.
            str = str && str.replace(/ /g, '\u00a0') || '';
            return document.createTextNode(str);
        };

        /**
         * Corrects the range object to point to a text node if it is on
         * a Tag or Line node. If on a Tag, set caret at the begining of the
         * text node. If on a Line, set caret on the last Tag on the line, at
         * the end of the contained Text node.
         */
        var fixCaret = function() {
            var range = getRange();
            var node = range.endContainer;

            if (isTag(node)) {
                setCaret(node.lastChild, 0);
            } else if (isLine(node)) {
                var tags = node.querySelectorAll(_autoWordTag);
                if (tags.length > 0) {
                    var tag = tags[range.endOffset - 1] || tags[tags.length - 1];
                    setCaret(tag.lastChild);
                }
            }
        };

        /**
         * If the Editor Node has no Lines, create a new one. If there are one
         * or more lines, remove the empty ones.
         */
        var fixEditor = function() {
            if (getChildren(editor, isLine).length == 0) {
                createNewLine(editor, {addPilotNode: true, setCaret: true});
            }
        };

        /**
         * Formats selection based on the instructions provided.
         * @param {Dataset} dataset - Dataset containing autotagjs instructions.
         * @param {string} scope - The scope of the instrcution (line,
         * selection or other).
         */
        var formatSelection = function(dataset, scope) {
            if (_selectionRange && dataset) {
                var nodes = getSelectionNodes(scope);

                for (var key in dataset) {
                    if (dataset.hasOwnProperty(key)) {
                        processInstruction(nodes, key,
                            dataset[key].split(/\s*;\s*/));
                    }
                }

                // Ensure that the selection does not disapper after we have
                // applied formatting.
                resetRange(_selectionRange);
            }
        };

        /**
         * Returns the nodes (Tags and/or Lines) included in the current
         * selection, based on scope. The scope 'selection' may include both
         * Tags and Lines, while scope 'line' will only include lines. The
         * default is to include only Tags.
         * @param {string} scope - The scope of nodes to be returned.
         * @returns {Array} - Returns an array of nodes.
         */
        var getSelectionNodes = function(scope) {
            var nodes;
            var lines = getLinesInRange(_selectionRange);

            switch (scope) {
                // Apply the formatting only to the lines in the selection or to
                // the current line where the caret rests.
                case 'line':
                    // Exclude parent lines in selection if multiple lines
                    // are present.
                    if (lines.length >  1 &&
                        isLine(_selectionRange.commonAncestorContainer)) {
                        lines.shift();
                    }
                    nodes = lines;
                    break;

                // Apply formatting to both tags and lines.
                default:
                    if (_selectionRange.collapsed) {
                        nodes = [];
                    } else {
                        buildTags(_selectionRange);
                        var tags = getTagsInRange(_selectionRange),
                            activeTags = getTagsInLine(getActiveLine());
                        if (lines.length > 1 || tags.length == activeTags.length) {
                            nodes = tags.concat(lines);
                        } else {
                            nodes = tags;
                        }
                    }
                    break;

                // // Else, apply only to tags.
                // default:
                //     nodes = getTagsInRange(_selectionRange);
            }

            nodes = nodes.filter(Boolean);
            return nodes;
        };

        /**
         * The line on which the current selection starts (and ends if
         * collapsed).
         * @returns {Node} - The Line node.
         */

        var getActiveLine = function() {
            var range = _selectionRange;
            return range && getLine(range.startContainer, false);
        };

        /**
         * Returns the first line in the Editor.
         * @returns {Node} - The Line node.
         */
        var getFirstLine = function() {
            return editor.querySelector(_autoLineTag + ':first-child');
        };

        /**
         * Returns the index value of the indentation of the given line.. The
         * index value is a number between 0 & 2.
         * @param {Node} line - The Line node.
         * @returns {number} - The indentation index.
         */
        var getIndentationIndex = function(line) {
            var level = 0;
            while ((line = line.parentNode) && !isEditor(line)) {
                level++;
            }
            // Indentation index is only 3 levels deep.
            return (level == 0 ? null : (level % 3 || 3));
        };

        /**
         * Returns the line this node is on.
         * @param {Node} node - The node for which the line should be returned.
         * @param {boolean=} walkTree - If set to true, the outermost line
         *      is returned.
         */
        var getLine = function(node, walkTree) {
            while (node && !isEditor(node) && (walkTree || !isLine(node))) {
                node = node.parentNode;
            }
            return isLine(node) ? node : getFirstLine();
        };

        /**
         * Returns the lines in the given range.
         * @param {Range} range - A range object.
         * @returns {Array} - The Lines in the given range.
         */
        var getLinesInRange = function(range) {
            return getNodesInRange(range, NodeFilter.SHOW_ELEMENT, isLine);
        };

        /**
         * Gets the list style prefix for the given indented line. If no prefix
         * is found, check ancestors. The default Editor prefix is 'atg';
         * @param {Node} line - The Line node to get List prefix.
         * @returns {string} - The indentation style prefix.
         */
        var getListPrefix = function(line) {
            if (isEditor(line)) {
                return 'atg';
            }

            var names = line.className.match(/(\w+(-\w+)*)-list-\d+/);
            var prefix = names && names[1];
            return (prefix ? prefix : getListPrefix(line.parentNode));
        };

        /**
         * Gets the nodes collected by the TreeWalker after applying the
         * filter. If a limit value is provided, only that many nodes are
         * returned.
         * @param {TreeWalker} walker - The TreeWalker object.
         * @param {nodeFilterCallback=} filter - An optional callback filter.
         * @param {number=} limit - A number indicating the maximum number of
         * nodes to be returned.
         * @returns {Array} - The list of nodes from the TreeWalker.
         */
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

        /**
         * Returns nodes in a given range.
         * @param {Range} range - A Range object.
         * @param {NodeFilter} nodeFilter - NodeFilter determining what to show.
         * @param {nodeFilterCallback} filter - A filter to apply.
         * @return {Array} - Array of nodes.
         */
        var getNodesInRange = function(range, nodeFilter, filter) {
            var walker = getRangeWalker(range, nodeFilter, filter);
            return getNodesFromTree(walker, filter);
        };

        /**
         * Returns the parent menu this node belongs to. The parent may also
         * be a submenu.
         * @param {Node} node - A node in the menu.
         * @returns {Node} - The parent menu of the given node.
         */
        var getParentMenu = function(node) {
            while(!node.classList.contains(_submenuClassName) &&
                !node.classList.contains(_menuClassName)) {
                node = node.parentNode;

                // Should not happen! Ever.
                if (isEditor(node)) return;
            }
            return node;
        };

        /**
         * Returns the amount value from a string with amount and unit.
         * Example: extractAmount('32px') => 32
         * @param {string} value - The value from which to extract amount.
         * @returns {string} - The extracted amount.
         */
        var extractAmount = function(value) {
            return parseInt(value && value.match(/^[-+]?\d*\.?\d+/)[0] || 0);
        };

        /**
         * Returns the containers and offsets of the given range as an object.
         * @param {Range} range - A Range.
         * @returns {Object} - The start and end containers with their offsets.
         */
        var getRangeContainersAndOffsets = function(range) {
            return {
                startContainer : range.startContainer,
                endContainer : range.endContainer,
                startOffset : range.startOffset,
                endOffset : range.endOffset
            };
        };

        /**
         * Returns a TreeWalker object that traverses the nodes in a Range.
         * @param {Range} range - The Range object to walk.
         * @param {NodeFilter} whatToShow - NodeFilter determining what to show.
         * @param {nodeFilterCallback} ancestorFilter - A filter used to
         * identify the right common ancestor node. For example, use the
         * Line node if collecting Tag nodes.
         * @returns {TreeWalker} - The TreeWalker object for this traversal.
         */
        var getRangeWalker = function(range, whatToShow, ancestorFilter) {
            ancestorFilter =  ancestorFilter || isTag;
            var ancestor = range.commonAncestorContainer ;

            while(!ancestorFilter(ancestor) &&
                !isLine(ancestor) && !isEditor(ancestor)) {
                ancestor = ancestor.parentNode;
            }

            return getTreeWalker(ancestor, whatToShow, function(node) {
                return rangeIntersectsNode(range, node);
            });
        };

        /**
         * Returns the Line node that is a direct child of Editor and is an
         * ancestor of the given node.
         * @param {Node} node - The node to get the root Line for.
         * @returns {Node} - A Line which is the root.
         */
        var getRootLine = function(node) {
            // var range = getRange();
            var range = _selectionRange;
            node = initObject(node, range && range.endContainer);
            return getLine(node, true);
        };

        /**
         * Gets the property values of the CSS style declaration of the node.
         * @param {Node} node - The node to get the style property.
         * @param {string} property - The name of the css property whose value
         * needs to be extracted.
         * @returns {DOMString} - The value of the property.
         */
        var getStylePropertyValue = function(node, property) {
            return node &&
                property &&
                window.getComputedStyle(node, null).getPropertyValue(property);
        };

        /**
         * Returns the asscociated Tag for the given node. If the node is a
         * Text Node, return its parent node, which in all probabality is
         * a Tag. If the node is a Line, return the first Tag in the line.
         * @param {Node} node - A Node.
         * @returns {Node} - The Tag node.
         */
        var getTag = function(node) {
            if (isTextNode(node)) {
                return node.parentNode;
            } else if (isTag(node)) {
                return node;
            } else if (isLine(node)) {
                return getTagsInLine(node)[0];
            }
        };

        /**
         * Get all the Tags in the given line and optionally all descendant
         * lines.
         * @param {Node} line - A Line node.
         * @param {boolean=} deep - If set to true, get Tags from descendant
         * lines, else (default) only Tags on the given line.
         * @returns {Array} - An array of Tag nodes.
         */
        var getTagsInLine = function(line, deep) {
            if (deep) {
                var walker = getTreeWalker(line, NodeFilter.SHOW_ELEMENT);
                return getNodesFromTree(walker, isTag);
            } else {
                return getChildren(line, isTag);
            }
        };

        /**
         * Returns all the Tag nodes in the given range.
         * @param {Range} range - A Range object.
         * @returns {Array} - An array of Tag Nodes from the given Range.
         */
        var getTagsInRange = function(range) {
            return getNodesInRange(range, NodeFilter.SHOW_ELEMENT, isTag);
        };

        /**
         * Returns a TreeWalker object.
         * @param {Node} container - The root node for the traversal.
         * @param {unsigned long} whatToShow - Bitmask formed from combining
         * NodeFilter properties.
         * @param {nodeFilterCallback} filter - A filter to apply on node
         * selection.
         * @returns {TreeWalker} - The TreeWalker object.
         */
        var getTreeWalker = function(container, whatToShow, filter) {
            return document.createTreeWalker(
                container,
                whatToShow, {
                    acceptNode: function(node) {
                        return (!filter || filter(node)) ? NodeFilter.FILTER_ACCEPT
                                                     : NodeFilter.FILTER_REJECT;
                    }
                },
                false
            );
        };

        /**
         * Hides all submenus.
         */
        var hideSubmenus = function() {
            var submenus = menubar.querySelectorAll('.' + _submenuClassName);
            for(var i=0; i<submenus.length; i++) {
                hideNode(submenus[i]);
            }
        };

        /**
         * Indents the provided line by one point.
         *
         * @param {Node} line - The line to indent.
         * @param {string=} prefix - The list class prefix to apply.
         * @param {boolean=} refresh - If set to false, the list style will
         *   not be updated. Defaults to true.
         */
        var indentLine = function(line, prefix, refresh) {
            if(!isListIndenter(line)) {
                refresh = initObject(refresh, true);
                prefix = initObject(prefix, getListPrefix(line));

                var selection = getRangeContainersAndOffsets(_selectionRange);

                // The second check is required to acomodate Firefox which
                // appends the current lines classname to the previous line on
                // delete.
                if (isBlankList(line) ||
                    !isRootLine(line) && isListRoot(line)) {

                    updateList(line, prefix, getIndentationIndex(line),
                        refresh);
                } else {
                    var rootLine = getRootLine(line),
                        anchor = line.previousSibling;

                    if (!isLine(anchor)) {
                        anchor = createNewLine();
                        line.parentNode.insertBefore(anchor, line);
                    }

                    anchor.appendChild(line);
                    initList(anchor);
                    updateList(line, prefix, getIndentationIndex(line),
                        refresh);

                    // Now make line's children it's peer.
                    var children = getChildren(line, isLine);
                    for (var i=0; i < children.length; i++) {
                      line.parentNode.insertBefore(children[i], line.nextSibling);
                    }
                }
                setSelection(selection);
            }
        };

        /**
         * Prepares the given Line node for use.
         * @param {Node} line - The root line node.
         * @returns {boolean} - True if the list clas name was applied.
         */
        var initList = function(line) {
            if (isRootLine(line)) {
                updateListStyle(line, _defaultListClassName);
                return true;
            }

            if (line.classList.contains(_defaultListClassName)) {
                line.classList.remove(_defaultListClassName);
            }
            return false;
        };

        /**
         * Checks if the given node is a Blank Node. A Blank Node is one that
         * has no text content or has only zero length characters.
         * @param {Node} node - The node to check.
         * @returns {boolean} - True if node has no text content, or if it
         * contains zero length characters.
         */
        var isBlankNode = function(node) {
            if (node) {
                var str = node.textContent;
                return (str.length == 0 || str == '\u200b');
            }
        };

        /**
         * Checks if the given Line is a blank line. A blank line is a node
         * that is a Blank Node.
         * @param {Node} line - The Line node to check.
         * @returns {boolean} - True if the node is a line and is a Blank Node.
         */
        var isBlankLine = function(line) {
            return isLine(line) && isBlankNode(line);
        };

        /**
         * Checks if the line is a Blank List. A Blank List is one that does
         * not have a list indicator (e.g bullet, numbering etc) but is still
         * part of the List.
         * @param {Node} line - The Line node to check.
         * @returns {boolean} - True if the line is a Blank List.
         */
        var isBlankList = function(line) {
            return line && line.classList.contains(_blankListClassName);
        };

        /**
         * Checks if the node is the Editor.
         * @param {Node} node - The node to check.
         * @returns {boolean} - True if the node is the Editor node.
         */
        var isEditor = function(node) {
            return node && node.isSameNode(editor);
        };

        /**
         * Checks if the provided node is a Line.
         * @param {Node} node - The node to check.
         * @returns {boolean} - True if the ndoe is Line.
         */
        var isLine = function(node) {
            return node &&
                node.tagName == _autoLineTag.toUpperCase() &&
                !isEditor(node);
        };

        /**
         * Checks if the given Line is indented.
         * @param {Node} line - The Line to check for indentation.
         * @returns {boolean} - True if the Line is indented.
         */
        var isListIndenter = function(line) {
            return line && !isEditor(line.parentNode) &&
                !line.className.match(/(\w+(-\w+)*)-list(-.+)*/g);
        };

        /**
         * Checks if the provided Line is a direct child of Editor.
         * @param {Node} line - The Line to check.
         * @returns {boolean} - True if the Line is a Roor Line.
         */
        var isRootLine = function(line) {
            return isLine(line) && isEditor(line.parentNode);
        };

        /**
         * Checks if the given Line has is a list root. A line is a Root list
         * if it has the default List class name.
         * @param {Node} line - The Line to check.
         * @returns {boolean} - True if the Line is a Root Line.
         */
        var isListRoot = function(line) {
            return line && line.classList.contains(_defaultListClassName);
        };

        /**
         * Checks if the given node is a Tag node.
         * @param {Node} node - The node to check.
         * @returns {boolean} - True if the node is a Tag node.
         */
        var isTag = function(node) {
            return node && node.tagName == _autoWordTag.toUpperCase();
        };

        /**
         * Inserts a tab in a Text or Tag node at the provided offset.
         * @param {Node} node - The Text or Tag node to insert the Tab.
         * @param {number} index - The position to insert the Tab.
         * @returns {boolean} - Returns true on success (tab is inserted),
         * false otherwise.
         */
        var insertTab = function(node, index) {
            var tag = isTextNode(node) ? node.parentNode : node;
            if (isTag(tag)) {
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

        /**
         * Outdents the given line and updates its list.
         * @param {Node} line - The Line node to outdent.
         * @param {boolean=} refresh - If set to true, the lists's style
         * is overwritten.
         */
        var outdentLine = function(line, refresh) {
            if(!isListIndenter(line)) {
                refresh = initObject(refresh, true);
                var parentLine = line.parentNode;

                if (!isEditor(line.parentNode)) {
                    var selection = getRangeContainersAndOffsets(_selectionRange);
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

                    parentLine.parentNode.insertBefore(line,
                        parentLine.nextSibling);

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

        var processInputV2 = function() {
            // var range = getRange();
            var range = _selectionRange;
            var container = range.endContainer;

            if (isTextNode(container)) {
                var value = container.nodeValue;
                if (value.match(/^\u200b/)) {
                    container.nodeValue = value.replace(/\u200b/g, '');
                    range = setCaret(container, range.endOffset + 1);
                }
            }
        };

        var processInput = function() {
            // var range = getRange();
            var range = _selectionRange;
            var container = range.endContainer;

            if (isTextNode(container)) {
                var value = container.nodeValue;
                if (value.match(/^\u200b/)) {
                    container.nodeValue = value.replace(/\u200b/g, '');
                    range = setCaret(container, range.endOffset + 1);
                }

                // Note that the offset within the range object will update
                // on its own if the container's node value is changed.
                var offset = range.endOffset;

                var refTag = container.parentNode,
                    parts = splitter(container.nodeValue || '');

                // Trim empty values from the array.
                parts = parts && parts.filter(Boolean) || '';
                var numparts = parts.length;

                if (numparts > 1) {
                    var newTag, length;
                    for (var i = 0; i < numparts; i++) {
                        newTag = createTagNode(
                            parts[i], refTag.getAttribute('style'));
                        newTag.style.removeProperty('display');
                        clearNodeStyle(newTag);

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
                    refTag.style.removeProperty('display');
                    clearNodeStyle(refTag);
                    decorator(refTag, refTag.firstChild.nodeValue);
                }
            } else if (isTag(container) && isTextNode(container.firstChild)) {
                decorator(container, container.firstChild.nodeValue);
            }
        };

        /**
         * Inserts the pasted text into the Editor and formats it for editing.
         * @param {Event} e - The paste event.
         */
        var pasteClipboardContent = function(e) {
            var content;
            // if (_selectionRange.)
            if (e.clipboardData) {
                content = (e.originalEvent || e)
                    .clipboardData.getData('text/plain');

            } else if (window.clipboardData) {
                content = window.clipboardData.getData('Text');
            }

            var container = getRange().endContainer;

            if (isTextNode(container)) {
                container.nodeValue = container.nodeValue + content;
                setCaret(container);

            } else {
                var textNode = document.createTextNode(content);
                container.insertBefore(textNode, container.firstChild);
                setCaret(textNode);
            }
            // processInput();
        };

        /**
         * Captures the Return key and performs the requisite action. Note
         * that we override the default browser action ude to inconsistencies
         * the the way browsers process the return action.
         * @param {Range} range - The range to act on.
         */
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

                    // Collect remaining tags and append them to the
                    // new line.
                    var tags = [];
                    while ((tag = tag.nextSibling)) {
                        tags.push(tag);
                    }
                    appendNodes(newTag, tags);
                }
                newLine.style = line.style;
                newLine.className = line.className;
            } else {
                // If a selection, proceed to delete the selection.
                processDelete(range);
            }
        };

        var removeListStyle = function(line) {
            updateListStyle(line, '');
        };


        /**
         * Saves the current selection range.
         */
        var saveSelectionRange = function() {
            var range = getRange();
            if (range && range.startContainer.nodeType != 9) {
                _selectionRange = getRange() || _selectionRange;
                return _selectionRange;
            }
        };

        /**
         * Updates the Line's list to be a blank list (one without the list
         * indicator).
         * @param {Node} line - The Line to update to blank list.
         */
        var setBlankList = function(line) {
            updateListStyle(line, _blankListClassName);
        };

        /**
         * Takes in the current node and sets the cursor location
         * on the first child, if the child is a Text node.
         *
         * @param {Node} node - The node on which to set the caret.
         * @param {number=} offset - The offest at which to set the caret.
         */
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
            // var range = getRange();
            var range = _selectionRange;
            if (range) {
                var tag = getTagsInRange(range).pop();
                if (tag) {
                    _continuingTagStyle = tag.getAttribute('style');
                }
            }
        };

        /**
         * Generate the the list style CSS class name and updates the
         * Line with it. If 'overrideStyle' is true, overrides the line's
         * existing List style.
         * @param {Node} line - The Line to update list style.
         * @param {string} stylePrefix - The list's style prefix string.
         * @param {number} indentIndex - The indentation index of the line.
         * @param {boolean} overrideStyle - Overrides the list style of the
         */
        var setListStyle = function(line, stylePrefix, indentIndex,
                overrideStyle) {
            if (stylePrefix && indentIndex &&
                (overrideStyle || !isBlankList(line))) {
                updateListStyle(line, stylePrefix + "-list-" + indentIndex);
            }
        };

        /**
         * Generate the list counter style and updates the line with it.
         * @param {Node} line - The Line to update list style.
         * @param {string} stylePrefix - The list's style prefix string.
         * @param {number} indentIndex - The indentation index of the line.
         */
        var setListCounter = function(line, stylePrefix, indentIndex) {
            line.parentNode.style.setProperty(
                'counter-reset', stylePrefix + "-counter-" + indentIndex);
            line.style.setProperty(
                'counter-reset', stylePrefix + "-counter-" + (indentIndex + 1));
        };

        /**
         * Sets the selection range to the containers and offsets provided in
         * the selection object.
         * @param {Object} obj - The object with the containers and offsets.
         * @param {Node} obj.startContainer - The selection start container.
         * @param {Node} obj.endContainer - The selection end container.
         * @param {number=} obj.startOffset - The start container's offset. If
         * not provided, it is defaulted to 0 (i.e begining of container).
         * @param {number=} obj.endOffset - The end container's offset. If not
         * provided, it is defaulted to the length of the container.
         * @returns {Range} - The newly created Range.
         */
        var setSelection = function(selection) {
            var range,
                startNode = selection.startContainer,
                endNode = selection.endContainer;

            if (startNode && endNode) {
                var startOffset = initObject(selection.startOffset, 0),
                    endOffset = initObject(selection.endOffset, endNode.length);
                range = document.createRange();
                try {
                    range.setStart(startNode, startOffset);
                    range.setEnd(endNode, endOffset);
                    _selectionRange = range;
                } catch (err) {
                    // Chrome does not like setting an offset of 1
                    // on an empty node.
                }
                resetRange(range);
            }
            return range;
        };

        /**
         * Updates the indentation of the Line based on the key pressed.
         * @param {number} keyCode - The key pressed.
         * @param {Node} line - The Line to update indentation.
         * @param {boolean} shifted - Indicates if the Shift key is pressed.
         */
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

        /**
         * Checks if the given Tag is the first one on the line.
         * @param {Node} tag - The Tag to check.
         * @param {number} offset - The offset to check in addition.
         * @returns {boolean} - True if this is the first node in the line.
         */
        var isBeginingOfLine = function(tag, offset) {
            return (isBlankNode(tag) || offset == 0) &&
                !tag.previousSibling;
        };

        /**
         * Checks if the given tag is the last in the given line and the offset
         * points to the end of the line.
         * @param {Node} tag - The tag to check.
         * @param {number} offset - The offset within the tag.
         * @returns {boolean} - True if end of line, false otherwise.
         */
        var isEndOfLine = function(tag, offset) {
            return !tag.nextSibling && offset == tag.textContent.length;
        };

        /**
         * If a Tab or Delete key is pressed, either update the indendation
         * of the line (in case of a list) or process deletion as usual.
         * @param {Range} range - The range for deletion.
         * @param {number} keyCode - The numeric code of the key pressed.
         * @param {boolean} shifted - Indicates if the shift key is pressed.
         */
        var processTabOrDeleteKey = function(range, keyCode, shifted) {
            if (range.collapsed) {
                var node = range.startContainer,
                    offset = range.startOffset,
                    line = getActiveLine();

                if (isBeginingOfLine(getTag(node), offset) &&
                    getIndentationIndex(line)) {
                    return updateIndentation(keyCode, line, shifted);
                }

                if (isTabKey(keyCode) && !shifted) {
                    return insertTab(node, offset);
                }
            }

            // Perform regular delete operation if above conditions fail
            // to satisfy.
            if (isDeleteKey(keyCode)) {
                // processDelete(getRange());
                processDelete(_selectionRange);
            }
        };

        /**
         * Deletes the character proceeeding the caret.
         * @param {Node} tag - The Tag node from which to delete the character.
         * @param {number} offset - The location of the character.
         */
        var deleteChar = function(tag, offset) {
            var str = tag.textContent,
                textNode = tag.firstChild;

            offset = initObject(offset, str.length);
            textNode.nodeValue =
                str.slice(0, offset - 1) + str.slice(offset);

            if (textNode.nodeValue.length == 0 && offset == 1) {
                if (!tag.previousSibling) {
                    textNode.nodeValue = '\u200b';
                    setCaret(tag);

                } else {
                    setCaret(tag.previousSibling);
                    removeNode(tag);
                }
            } else {
                setCaret(textNode, offset - 1);
            }
        };

        /**
         * Deletes the given Line.
         * @param {Node} line - The line to delete.
         */
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

        /**
         * Deletes the Tags and Lines in the current selection.
         * @param {Range} range - The selection range.
         */
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

        /**
         * Proceeds with performing a delete operation.
         * @param {Range} range - The Range on which to perform the delete.
         */
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

        /**
         * Updates the list style and counter for the given line. If
         * 'overrideStyle' is true, overrides the line's existing List style.
         * @param {Node} line - The Line whose list is to be updated.
         * @param {string} stylePrefix - The list's style prefix string.
         * @param {number} indentIndex - The indentation index of the line.
         * @param {boolean=} overrideStyle - Overrides the list style of the
         * given line if true (default).
         */
        var updateList = function(line, stylePrefix, indentIndex, overrideStyle) {
            overrideStyle = initObject(overrideStyle, true);
            if (!initList(line)) {
                setListCounter(line, stylePrefix, indentIndex);
                setListStyle(line, stylePrefix, indentIndex, overrideStyle);
            }
        };

        /**
         * Updates the list by replacing the existing list class with the
         * one provided.
         * @param {Node} line - The Line node whose list style to update.
         * @param {string} klass - The list style CSS classname to update with.
         */
        var updateListStyle = function(line, klass) {
            line.className =
                line.className.replace(/(\w+(-\w+)*)-list(-.+)*/g, '');
            line.classList.add(klass);
        };

        var clearNodeStyle = function(node, force) {
            // Clear up the style attribute.
            if (force || !node.getAttribute('style')) {
                node.removeAttribute('style');
            }
        };

        var splitTag = function(tag, offset) {
            var text = tag.firstChild;

            // Splitting at boundaries will result in blank nodes.
            if (offset == 0 || offset == text.nodeValue.length) {
                return tag;
            }

            var newText = text.splitText(offset);
            var newTag = createTagNode(removeNode(newText));
            newTag.setAttribute('style', tag.getAttribute('style'));

            // Firefox hack to remove break nodes.
            removeNode(tag.querySelector('br'));

            return appendNode(tag, newTag);
        };

        var buildTags = function(range) {
            if (!range.collapsed) {
                var selection = getRangeContainersAndOffsets(range);
                var container = selection.startContainer;
                var offset = selection.startOffset;

                // Split the start Text node.
                var newTag = splitTag(container.parentNode, offset);

                // Now split the end Text node.
                if (container.isSameNode(selection.endContainer)) {
                    offset = selection.endOffset - offset;
                    container = newTag.firstChild;
                } else {
                    offset = selection.endOffset;
                    container = selection.endContainer;
                }
                splitTag(container.parentNode, offset);

                // Rebuild original selection range for further processing.
                _selectionRange = setSelection({
                    startContainer: newTag.firstChild,
                    startOffset: 0,
                    endContainer: container,
                    endOffset: container.length
                });
            }
        };

        editor.addEventListener('dblclick', function(e) {
            saveSelectionRange();
        });

        editor.addEventListener('click', function(e) {
            hideSubmenus();
            fixEditor();
            fixCaret();
        });

        editor.addEventListener('focus', function(e) {
            fixEditor();
        });

        editor.addEventListener('input', function() {
            // processInput();
            // processInputV2();
        });

        // Start handling events.
        editor.addEventListener('keydown', function(e) {
            var keyCode = getKeyCode(e);
            if (!isDeleteKey(keyCode)) {
                fixCaret();
            }

            var range = getRange();

            if (isDeleteKey(keyCode) || isTabKey(keyCode)) {
                processTabOrDeleteKey(range, keyCode, e.shiftKey);
                e.preventDefault();

            } else if (isReturnKey(keyCode)) {
                if (!ignoreReturnKey) {
                    processReturnKey(range);
                }
                e.preventDefault();

            } else if (e.metaKey && isFormatKey(keyCode)) {
                formatSelection({ atgToggle: _styleKeyMap[keyCode] });
                e.preventDefault();
            }
        });

        editor.addEventListener('keyup', function(e) {
        });

        editor.addEventListener('copy', function(e) {
            saveSelectionRange();
            e.preventDefault();
        });

        editor.addEventListener('paste', function(e) {
            pasteClipboardContent(e);
            e.preventDefault();
        });

        document.addEventListener('selectionchange', debounce(function(e) {
            if (saveSelectionRange()) {
                setContinuingTagStyle();
                doAfterSelection(getTagsInRange(_selectionRange));
            }
        }, 200));

        return {
            attachMenubar: function(menubar) {
                if (menubar) {
                    _editorMenubar = menubar;
                    _editorMenubar.addEventListener('click', function(e) {
                        hideSubmenus();

                        // The click event remove the text selection. Reinstate
                        // the selection so that we can format the content in
                        // the highlighted text.
                        resetRange(_selectionRange);

                        var target = e.target;
                        var menu = getParentMenu(target);
                        var submenu = menu.querySelector('.' + _submenuClassName);

                        // If a submenu already exists, just display it.
                        if (submenu) {
                            toggleNodeVisibility(submenu);

                        // If atg-submenu is specified (and no submenu exists),
                        // proceed to take action.
                        } else if (menu.dataset.atgSubmenu) {
                            submenu = menu.dataset.atgSubmenu;
                            // If atg-submenu eludes to palette, create it and
                            // display the submenu.
                            if (submenu.match(/Palette$/)) {
                                createPalette(menu, submenu.split('Palette')[0]);
                            }

                        } else {

                            // If the submenu alludes to atg-palette, extract
                            // the color properties into the target (a palette
                            // cell in this case).
                            if (menu.dataset.atgPalette) {
                                createPaletteCellAction(target,
                                    menu.dataset.atgPalette);
                            }

                            /** @type {{atgScope}} **/
                            var scope = menu.dataset.atgScope;
                            formatSelection(target.dataset, scope);
                            hideSubmenus();
                        }
                    });
                }
            }
        };
    };
}());
