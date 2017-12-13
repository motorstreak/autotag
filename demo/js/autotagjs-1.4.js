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


    if (!String.prototype.splice) {
        /**
         * {JSDoc}
         *
         * The splice() method changes the content of a string by removing a range of
         * characters and/or adding new characters.
         *
         * @this {String}
         * @param {number} start Index at which to start changing the string.
         * @param {number} delCount An integer indicating the number of old chars to remove.
         * @param {string} newSubStr The String that is spliced in.
         * @return {string} A new string with the spliced substring.
         */
        String.prototype.splice = function(start, delCount, newSubStr) {
            return this.slice(0, start) + newSubStr + this.slice(start + Math.abs(delCount));
        };
    }

    // Map keeyboard controls to format options since we override them.
    var _styleKeyMap = {
        66: 'font-weight:bold',
        73: 'font-style:italic',
        85: 'text-decoration:underline'
    };

    // v3
    var _tab = '\u0009',
        _zeroWidthSpace = '\u00a0';

    var _fragmentTag = 'span',
        _lineTag = 'div',

        // v3
        _lineClassName = 'atg-line',
        _lineLeaderClassName = 'atg-line-leader',
        _lineBodyClassName = 'atg-line-body',
        _tabFragmentClassName = 'atg-tab',
        _textFragmentClassName = 'atg-text',
        _listFragmentClassName = 'atg-list',
        _pilotClassName = 'atg-pilot',

        // Reserved class names
        _anchorListClassName = 'atg-list-anchor',
        _blankListClassName = 'atg-list-blank',
        _rootListClassName = 'atg-list-root',
        _menuClassName = 'atg-menu',
        _paletteClassName = 'atg-palette',
        _paletteCellClassName = 'atg-palette-cell',
        _paletteRowClassName = 'atg-palette-row',
        _paletteCellCrossClassName = 'atg-crossed-cell',
        _submenuClassName = 'atg-submenu';

    function initObject(obj, toObj) {
        return ((typeof obj === 'undefined') || obj == null) ? toObj : obj;
    }

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
    function getKeyCode(e) {
        return (e.which || e.keyCode || 0);
    }

    function appendNode(node, toNode) {
        return toNode.parentNode.insertBefore(node, toNode.nextSibling);
    }

    function prependNode(node, toNode) {
        return toNode.parentNode.insertBefore(node, toNode);
    }

    function appendNodes(nodeList, toNode) {
        for (var i=0; i<nodeList.length; i++) {
            toNode = appendNode(nodeList[i], toNode);
        }
    }

    function createElement(tag, cName) {
        let element = document.createElement(tag);
        if (cName) {
            element.className = cName;
        }
        return element;
    }

    function toggleNodeVisibility(node) {
        var style = window.getComputedStyle(node);
        node.style.display = (style.display === 'none') ? '' : 'none';
    }

    function hideNode (node) {
        node.style.display = 'none';
    }

    function showNode (node) {
        if (window.getComputedStyle(node).display === 'none') {
            node.style.display = '';
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

    // function isDocumentNode(node) {
    //     return node && node.nodeType == Node.DOCUMENT_NODE;
    // }

    function isElementNode(node) {
        return node && node.nodeType == Node.ELEMENT_NODE;
    }

    function isTabKey(code) {
        return code == 9;
    }

    function isReturnKey(code) {
        return code == 13;
    }

    function isLeftArrowKey(code) {
        return code == 37;
    }

    function isRightArrowKey(code) {
        return code == 39;
    }

    function isDeleteKey(code) {
        return code == 8;
    }

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
        let selection, range;
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

    function resetRange(range) {
        if (range) {
            if (window.getSelection) {
                let selection = window.getSelection();
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

    function rangeIntersectsNode(range, node) {
        let nodeRange;
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

    function isFormatKey(code) {
        return (code == 66 || code == 73 || code == 85);
    }

    return function(editor, config) {
        // The latest selection made in the editor.
        var _range,

            // All selection is copied to the clipboard buffer.
            _copiedRange,
            _editorMenubar,

            // Continues the current text style to the next line and
            // across line breaks.
            _continuingStyle = '';

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

        // Returns the fragments under the selection.
        var doAfterSelection = config.afterSelection || function(fragments) {};

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
                        target.removeAttribute('style');

                    } else if (cmd.match(/^list(\s+\w+(-\w+)*){1}/)) {
                        var listPrefix = cmd.split(/\s+/)[1];

                        switch(listPrefix) {
                            case 'clear':
                                // clearList(target);
                                break;
                            case 'indent':
                                createOrIndentList(target, false);
                                break;
                            case 'outdent':
                                outdentList(target);
                                break;
                            default:
                                toggleList(target, listPrefix);
                                break;
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
        var createPalette = function(menu) {
            var palette = menu.getElementsByClassName(_submenuClassName)[0];
            if (palette) {
                palette.style.display = '';
            } else {
                palette = createElement('div',
                    _submenuClassName + ' ' + _paletteClassName);

                var type = menu.dataset.atgSubmenu.split('Palette')[0];
                palette.dataset.atgPalette = type;
                palette.dataset.atgScope = menu.dataset.atgScope;
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

        var emptyLineObserver = function(mutationList) {
            for(var mutation of mutationList) {
                let target = mutation.target;
                if (mutation.type == 'childList' &&
                        mutation.removedNodes.length > 0 &&
                        target.textContent.length == 0) {

                    // Disconnect the observer on this line so that it does not
                    // fire when we add the pilot node.
                    this.disconnect();
                    renewLineBody(target, false);

                    // Now connect it back.
                    this.observe(target, { childList: true, subtree: true });
                }
                //
                // if () {
                //     console.log('A child node has been added or removed.');
                // }
                // else if (mutation.type == 'attributes') {
                //     console.log('The ' + mutation.attributeName + ' attribute was modified.');
                // }
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
            let hsla = 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + '1.0)';

            // let cell = document.createElement('div');
            // cell.className = _paletteCellClassName;

            let cell = createElement('div', _paletteCellClassName);
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
            // var row = document.createElement('div');
            // row.className = _paletteRowClassName;
            return palette.appendChild(
                createElement('div', _paletteRowClassName));
        };

        var createLeaderLine = function(line) {
            // let leader = document.createElement(_lineTag);
            // leader.className = _lineLeaderClassName;

            let leader = createElement(_lineTag, _lineLeaderClassName);
            leader.setAttribute('contenteditable', 'false');

            // DEBUG -- REMOVE
            leader.appendChild(createListFragment('3.1.1.4'));

            line.insertBefore(leader, line.firstChild);
            return leader;
        };

        var createLine = function(refLine, options) {
            options = options || {};

            // Create the root line
            // let line = document.createElement(_lineTag);
            // line.className = _lineClassName;

            let line = createElement(_lineTag, _lineClassName),
                body = createElement(_lineTag, _lineBodyClassName);

            // // Now create the parts of the line (leader, body)
            // let body = document.createElement(_lineTag);
            // body.className = _lineBodyClassName;


            line.appendChild(body);

            var observer = new MutationObserver(emptyLineObserver);

            // Start observing the target node for configured mutations
            observer.observe(body, { childList: true, subtree: true });

            if (refLine) {

                // if (options.asChild) {
                //     refLine.appendChild(line);
                //
                // } else if (options.asPreviousSibling) {
                //     // refLine.parentNode.insertBefore(line, refLine);
                //     prependNode(line, refLine);
                //
                // } else {
                //     // By default, attach as sibling
                //     appendNode(line, refLine);
                // }

                switch (options.attachAs) {
                    case 'child':
                        refLine.appendChild(line);
                        break;
                    case 'next_sibling':
                        appendNode(line, refLine);
                        break;
                    case 'previous_sibling':
                        prependNode(line, refLine);
                        break;
                    default:
                        appendNode(line, refLine);
                        break;
                }

                if (options.addPilotNode) {
                    renewLineBody(body, options.setCaret);
                }
            }
            return line;
        };

        var renewLineBody = function(node, focus) {
            // Remove all content;
            while (node.firstChild) {
                node.removeChild(node.firstChild);
            }

            // Now create the pilot node.
            let pilot = createTextNode(_zeroWidthSpace);
            node.appendChild(pilot);
            node.classList.add(_pilotClassName);

            if (focus) {
                setCaret(pilot, 0);
            }

            return pilot;
        };

        // var createPilotFragment = function() {
        //     var pilot = createTextFragment(_zeroWidthSpace);
        //     pilot.classList.add(_pilotClassName);
        //     return pilot;
        // };

        // var createTabFragment = function() {
        //     var tab = createFragment(_tab);
        //     tab.classList.add(_tabFragmentClassName);
        //     tab.setAttribute('contenteditable', 'false');
        //     return tab;
        // };

        var createTextFragment = function(stringOrText, style) {
            var text = createFragment(stringOrText, null, style);
            text.classList.add(_textFragmentClassName);
            return text;
        };

        var createListFragment = function(stringOrText) {
            var text = createFragment(stringOrText);
            // text.classList.add(_listFragmentClassName);
            return text;
        };

        /**
         * Creates a node (Fragment Node) containing the provided string or Text
         * node and applies the provided style to it. If a style is not
         * provided, set style to the last applied one. Every text node in
         * the editor is wrapped in a Fragment node.
         * @param {Object} stringOrText - A string or Text node object to be
         * wrapped as a Fragment.
         * @param {string} style - A string containing CSS style declarations.
         * @returns {Node} - The newly create Fragment node.
         */
        var createFragment = function(stringOrText, cName, style) {
            // let fragment = document.createElement(_fragmentTag);
            let text,
                fragment = createElement(_fragmentTag, cName);

            if (typeof stringOrText === 'string') {
                text = createTextNode(stringOrText);
            }
            else if (isTextNode(stringOrText)) {
                text = stringOrText;
            }

            if (text) {
                fragment.appendChild(text);
            }

            fragment.setAttribute('style', style || _continuingStyle);
            return fragment;
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
         * a Fragment or Line node. If on a Fragment, set caret at the begining of the
         * text node. If on a Line, set caret on the last Fragment on the line, at
         * the end of the contained Text node.
         */
        var fixCaret = function() {
            var range = getRange();
            var container = range.endContainer,
                parent = container.parentNode;

            if (isEditor(container)) {
                // do something
            }
            else {
                return;
            }

            // console.log(node);
            // if (isTextNode(node) || isEditor(node)) {
            //     // // var target = node.querySelector('.' + _textFragmentClassName);
            //     // // setCaret(target);
            //     // let line = getFirstLine();
            //     // let walker = getTreeWalker(line, NodeFilter.SHOW_TEXT)
            //     // let nodes = getNodesFromTree(walker, isTextNode, 1);
            //     // if (nodes.length) {
            //     //     setCaret(nodes[0]);
            //     // } else {
            //     //     fixEditor();
            //     // }
            //     return;
            // }
            //
            // if (isPilotFragment(node)) {
            //     setCaret(node);
            //
            // } else if (isTabFragment(node)) {
            //     var next = node.nextSibling;
            //     if (isPilotFragment(next)) {
            //         setCaret(next, 1);
            //     } else {
            //         setCaret(next);
            //     }
            //
            // } else if (isLine(node) || isLineBody(node)) {
            //     var fragments =
            //         node.querySelectorAll('.' + _textFragmentClassName);
            //     // var fragments = getFragmentsInLine(node, true);
            //     // console.log(fragments);
            //     if (fragments.length > 0) {
            //         // var fragment = fragments[range.endOffset - 1] ||
            //         //     fragments[fragments.length - 1];
            //         setCaret(fragments[fragments.length - 1]);
            //     }
            // }
        };

        var fixEditor = function() {
            if (getChildren(editor, isLine).length == 0) {
                return createLine(editor, {
                    attachAs: 'child',
                    addPilotNode: true,
                    setCaret: true
                });
            }
        };

        var formatSelection = function(dataset, scope) {
            if (_range && dataset) {
                var nodes = getNodesInSelection(scope);

                for (var key in dataset) {
                    if (dataset.hasOwnProperty(key)) {
                        processInstruction(nodes, key,
                            dataset[key].split(/\s*;\s*/));
                    }
                }

                // Ensure that the selection does not disapper after we have
                // applied formatting.
                resetRange(_range);
            }
        };

        var getNodesInSelection = function(scope) {
            var nodes,
                lines = getLinesInRange(_range);

            switch (scope) {
                // Apply the formatting only to the lines in the selection or to
                // the current line where the caret rests.
                case 'line':
                    nodes = lines;
                    break;

                case 'tags':
                    createFragmentsInRange(_range);
                    nodes = getFragmentsInRange(_range);
                    break;
                // Return both Fragments and Lines if scope is not defined.
                default:
                    if (_range.collapsed) {
                        nodes = [];
                    } else {
                        createFragmentsInRange(_range);
                        let fragments = getFragmentsInRange(_range),
                            activeFragments = getFragmentsInLine(getActiveLine());
                        if (lines.length > 1 ||
                            fragments.length == activeFragments.length) {
                            nodes = fragments.concat(lines);
                        }
                        else {
                            nodes = fragments;
                        }
                    }

                    // Not required technically but helps in refactoring.
                    break;
            }

            nodes = nodes.filter(Boolean);
            return nodes;
        };

        var getActiveLine = function() {
            return _range && getLine(_range.startContainer, false);
        };

        var getFirstLine = function() {
            return editor.querySelector(_lineTag + ':first-child');
        };

        var getIndentationIndex = function(line, maxIndex) {
            maxIndex = initObject(maxIndex, 3);

            var level = 0;
            while ((line = line.parentNode) && !isEditor(line)) {
                level++;
            }
            return (level == 0 ? 0 : (level % maxIndex || maxIndex));
        };

        var getLine = function(node) {
            if (isEditor(node)) return getFirstLine();

            while (node && !isLine(node)) {
                node = node.parentNode;
            }
            return node;
        };

        var getLinesInRange = function(range) {
            return getNodesInRange(range, NodeFilter.SHOW_ELEMENT, isLine);
        };

        var getTextNodesInRange = function(range) {
            return getNodesInRange(range, NodeFilter.SHOW_TEXT, isTextNode);
        };

        var getListPrefix = function(line) {
            if (isEditor(line)) {
                return 'atg';
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

        var getParentMenu = function(node) {
            while(!node.classList.contains(_submenuClassName) &&
                !node.classList.contains(_menuClassName)) {
                node = node.parentNode;

                // Should not happen! Ever.
                if (isEditor(node)) return;
            }
            return node;
        };

        var extractAmount = function(value) {
            return parseInt(value && value.match(/^[-+]?\d*\.?\d+/)[0] || 0);
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
            ancestorFilter =  ancestorFilter || isFragment;
            var ancestor = range.commonAncestorContainer ;

            console.log(ancestor);
            while (!ancestorFilter(ancestor)) {
                if (!isEditor(ancestor) && !isLine(ancestor) &&
                        !isFragment(ancestor) && !isTextNode(ancestor)) {
                    break;
                }
                ancestor = ancestor.parentNode;
            }


            // while(!isEditor(ancestor) && !isLine(ancestor)  &&
            //     !ancestorFilter(ancestor)) {
            //
            //
            //
            //     ancestor = ancestor.parentNode;
            //
            //     if (ancestor == null) {
            //         console.log(ancestor);
            //
            //     }
            // }

            return getTreeWalker(ancestor, whatToShow, function(node) {
                return rangeIntersectsNode(range, node);
            });
        };

        var getRootLine = function(node) {
            node = initObject(node, _range && _range.endContainer);
            return getLine(node, true);
        };

        var getStylePropertyValue = function(node, property) {
            return node &&
                property &&
                window.getComputedStyle(node, null).getPropertyValue(property);
        };

        var getFragment = function(node) {
            if (isTextNode(node)) {
                return node.parentNode;
            }
            else if (isFragment(node)) {
                return node;
            }
            else if (isLine(node)) {
                return getFragmentsInLine(node)[0];
            }
        };

        var getFragmentsInLine = function(line, deep) {
            if (deep) {
                var walker = getTreeWalker(line, NodeFilter.SHOW_ELEMENT);
                return getNodesFromTree(walker, isFragment);
            }
            else {
                return getChildren(line, isFragment);
            }
        };

        var getFragmentsInRange = function(range) {
            return getNodesInRange(range, NodeFilter.SHOW_ELEMENT, isFragment);
        };

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

        var hideSubmenus = function() {
            var submenus = menubar.querySelectorAll('.' + _submenuClassName);
            for(var i=0; i<submenus.length; i++) {
                hideNode(submenus[i]);
            }
        };

        var toggleList = function(line, prefix) {
            if (isList(line) && !isAnonymousList(line)) {
                outdentList(line, false);
            }
            else {
                createOrIndentList(line, prefix);
            }
        };

        var createOrIndentList = function(line, prefix, refresh) {
            refresh = initObject(refresh, true);
            prefix = initObject(prefix, getListPrefix(line));

            // Store the current selection nodes and offsets so that we can
            // reinstate the selection after indentation.
            var selection = getRangeContainersAndOffsets(_range);

            // The second check is required to acomodate Firefox which
            // appends the current lines classname to the previous line on
            // delete.
            if (isAnonymousList(line) ||
                !isRootLine(line) && isListRoot(line)) {
                updateList(line, prefix, getIndentationIndex(line), refresh);
            }
            else {
                var anchor = line.previousSibling;
                if (!isList(anchor)) {
                    anchor = createLine();
                    line.parentNode.insertBefore(anchor, line);

                    // If the newly created line is not a root list, make it
                    // one. Else, make this an anchor list node.
                    initList(anchor, _anchorListClassName);
                }

                anchor.appendChild(line);
                updateList(line, prefix, getIndentationIndex(line), refresh);

                // Now make line's children it's peer.
                var children = getChildren(line, isLine);
                for (var i=0; i < children.length; i++) {
                  line.parentNode.insertBefore(children[i], line.nextSibling);
                }
            }

            // Reset the range to the original selection if possible.
            setSelection(selection);
        };

        var initList = function(line, klass) {
            if (isRootLine(line)) {
                updateListStyle(line, _rootListClassName);
                return true;
            }

            if (klass) {
                updateListStyle(line, klass);
            }
            return false;
        };

        var isBlankNode = function(node) {
            if (node) {
                var str = node.textContent;
                return (str.length == 0 || str == _zeroWidthSpace);
            }
        };

        var isBlankLine = function(line) {
            return isLine(line) && isBlankNode(line);
        };

        var isAnonymousList = function(line) {
            return line.classList.contains(_blankListClassName);
        };

        var isAnchorList = function(line) {
            return line.classList.contains(_anchorListClassName);
        };

        var isEditor = function(node) {
            return node && node.isSameNode(editor);
        };

        var isLine = function(node) {
            return isElementNode(node) &&
                node.classList.contains(_lineClassName);
        };

        var isLineBody = function(node) {
            return isElementNode(node) &&
                node.classList.contains(_lineBodyClassName);
        };

        var isList = function(line) {
            var className = line && line.className;
            return className &&
                className.match(/(\w+(-\w+)*)-list-(.+)*/g);
        };

        var isListHead = function(line) {
            var previousLine = line.previousSibling;
            return isList(line) && (
                !previousLine ||
                getIndentationIndex(line) == 1 &&
                    getIndentationIndex(previousLine) == 0
            );
        };

        var isRootLine = function(line) {
            return isLine(line) && isEditor(line.parentNode);
        };

        var isListRoot = function(line) {
            return line && line.classList.contains(_rootListClassName);
        };

        var isFragment = function(node) {
            return node && node.tagName == _fragmentTag.toUpperCase();
        };

        var isTabFragment = function(node) {
            return isFragment(node) &&
                node.classList.contains(_tabFragmentClassName);
        };

        var isTextFragment = function(node) {
            return isFragment(node) &&
                node.classList.contains(_textFragmentClassName);
        };

        var isPilotFragment = function(node) {
            return isTextFragment(node) &&
                node.classList.contains(_pilotClassName);
        };

        var insertTab = function(node, index) {
            if (isTextNode(node)){
                node.nodeValue = node.textContent.splice(index, 0, '\u0009');
                setCaret(node, index + 1);
            }
            processInputV2();
        };

        var outdentList = function(line, refresh) {
            refresh = initObject(refresh, true);

            if(isList(line)) {
                var parentLine = line.parentNode;
                if (!isEditor(parentLine)) {
                    var selection = getRangeContainersAndOffsets(_range);
                    prefix = getListPrefix(line);

                    // Now make line's children the anchor's children.
                    var children = getChildren(line, isLine);
                    if (children.length > 0) {
                        var anchor = createLine();
                        initList(anchor, _anchorListClassName);

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

                    var indentIndex = getIndentationIndex(parentLine);
                    updateList(line, prefix, indentIndex, refresh);

                    if ((getChildren(parentLine, isLine) +
                        getChildren(parentLine, isFragment)) == 0) {
                        removeNode(parentLine);
                    }

                    setSelection(selection);
                }
            }
        };

        var processInputV2 = function() {
            var container = _range.endContainer;
            var parent = container.parentNode;

            if (isTextNode(container)) {
                var value = container.nodeValue;

                // Remove the lead character as it is no longer required.
                if (value.match(/\u00a0/) &&
                    parent.classList.contains(_pilotClassName)) {
                    container.nodeValue = value.replace(/\u00a0/g, '');
                    // container.nodeValue = value.substr(1);
                    parent.classList.remove(_pilotClassName);
                    range = setCaret(container);
                }
            }
        };

        // var processInput = function() {
        //     var container = _range.endContainer;
        //
        //     if (isTextNode(container)) {
        //         var value = container.nodeValue;
        //         if (value.match(/^\u200b/)) {
        //             container.nodeValue = value.replace(/\u200b/g, '');
        //             range = setCaret(container, _range.endOffset + 1);
        //         }
        //
        //         // Note that the offset within the range object will update
        //         // on its own if the container's node value is changed.
        //         var offset = _range.endOffset;
        //
        //         var refFragment = container.parentNode,
        //             parts = splitter(container.nodeValue || '');
        //
        //         // Trim empty values from the array.
        //         parts = parts && parts.filter(Boolean) || '';
        //         var numparts = parts.length;
        //
        //         if (numparts > 1) {
        //             var newFragment, length;
        //             for (var i = 0; i < numparts; i++) {
        //                 newFragment = createTextFragment(
        //                     parts[i], refFragment.getAttribute('style'));
        //                 newFragment.style.removeProperty('display');
        //                 clearNodeStyle(newFragment);
        //
        //                 decorator(newFragment, newFragment.firstChild.nodeValue);
        //                 refFragment.parentNode.insertBefore(newFragment,
        //                     refFragment.nextSibling);
        //
        //                 length = parts[i].length;
        //                 if (offset > 0 && offset <= length) {
        //                     setCaret(newFragment.firstChild, offset);
        //                 }
        //
        //                 offset = offset - length;
        //                 refFragment = newFragment;
        //             }
        //             removeNode(container.parentNode);
        //         }
        //         else {
        //             refFragment.style.removeProperty('display');
        //             clearNodeStyle(refFragment);
        //             decorator(refFragment, refFragment.firstChild.nodeValue);
        //         }
        //     }
        //     else if (isFragment(container) && isTextNode(container.firstChild)) {
        //         decorator(container, container.firstChild.nodeValue);
        //     }
        // };

        var pasteClipboardContent = function(e) {
            var content;
            var container = _range.endContainer;
            if (!_copiedRange || _copiedRange.collapsed) {
                if (e.clipboardData) {
                    content = (e.originalEvent || e)
                        .clipboardData.getData('text/plain');
                }
                else if (window.clipboardData) {
                    content = window.clipboardData.getData('Text');
                }

                if (isTextNode(container)) {
                    container.nodeValue = container.nodeValue + content;
                    setCaret(container);
                }
                else {
                    var textNode = document.createTextNode(content);
                    container.insertBefore(textNode, container.firstChild);
                    setCaret(textNode);
                }
                processInputV2();
            }
            else {
                var fragment =
                    splitFragment(container.parentNode, _range.endOffset);
                appendNode(_copiedRange.cloneContents(), fragment);
                if (isBlankNode(fragment) && !isList(fragment.nextSibling)) {
                    removeNode(fragment);
                }
            }
        };

        var processArrowKeys = function(range, keyCode) {
            // var container = range.startContainer,
            //     offset = range.startOffset;
            //
            // var parent = container.parentNode;
            // if (isTextNode(container) && isPilotFragment(parent)) {
            //     // Node.nodeValue does not work correctly in FF 57.0.1.
            //     // Resorting to textContent.
            //     var target,
            //         value = container.textContent;
            //
            //     if (isRightArrowKey(keyCode)) {
            //         target = parent.nextSibling;
            //         if (isTabFragment(target)) {
            //             target = target.nextSibling;
            //         }
            //
            //         if (isPilotFragment(target)) {
            //             // When landing on a pilot node, ensure that the caret
            //             // is at the end.
            //             setCaret(target);
            //         } else {
            //             // ..else, set to the begining.
            //             setCaret(target, 0);
            //         }
            //
            //     } else if (isLeftArrowKey(keyCode)) {
            //         target = parent.previousSibling;
            //         if (isTabFragment(target)) {
            //             target = target.previousSibling;
            //         }
            //         setCaret(target);
            //     }
            //     return true;
            // }
        };

        var processReturnKey = function(range) {
            if (range.collapsed) {
                var newLine,
                    container = range.startContainer,
                    offset = range.startOffset,
                    line = getLine(container);

                var fragment = getFragment(container);

                if (isEndOfLine(fragment, offset)) {
                    newLine = createLine(line, {
                        addPilotNode: true,
                        setCaret: true
                    });
                }
                else if (isBeginingOfLine(fragment, offset)) {
                    newLine = createLine(line, {
                        attachAs: 'previous_sibling',
                        addPilotNode: true,
                        setCaret: true
                    });
                }
                else {
                    var newNode = container.splitText(range.startOffset);

                    if (newNode.nodeValue.length == 0) {
                        newNode.nodeValue = _zeroWidthSpace;
                        // newNode.setAttribute('contenteditable', true);
                    }

                    var newFragment = createTextFragment(removeNode(newNode));
                    newLine = createLine(line, {attachAs: 'next_sibling'});
                    newLine.appendChild(newFragment);
                    setCaret(newNode, 0);

                    // Collect remaining nodes (Fragments and Lines) and append
                    // them to the new line.
                    var nodes = [];
                    while ((fragment = fragment.nextSibling)) {
                        nodes.push(fragment);
                    }
                    appendNodes(nodes, newFragment);

                    // appendNodes(pilotTag, tags);
                    // setCaret(pilotTag, 0);
                }
                newLine.setAttribute('style', line.getAttribute('style'));
                newLine.className = line.className;
            } else {
                // If a selection, proceed to delete the selection.
                processDelete(range);
            }
        };

        var removeListStyle = function(line) {
            updateListStyle(line, '');
        };

        var saveSelectionRange = function() {
            var range = getRange();
            if (range && range.startContainer.nodeType != 9) {
                _range = getRange() || _range;
                return _range;
            }
        };

        var anonymizeList = function(line) {
            updateListStyle(line, _blankListClassName);
        };

        var setCaret = function(node, offset) {
            if (node) {
                if (isFragment(node)) {
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

        var setContinuingStyle = function() {
            if (_range) {
                var fragment = getFragmentsInRange(_range).pop();
                if (fragment) {
                    _continuingStyle = fragment.getAttribute('style');
                }
            }
        };

        var setListStyle = function(line, stylePrefix, indentIndex,
                overrideStyle) {
            if (indentIndex == 0) {
                updateListStyle(line, _rootListClassName);
            }
            else if (stylePrefix && indentIndex &&
                    (overrideStyle || (!isAnonymousList(line) && !isAnchorList(line)))) {
                updateListStyle(line, stylePrefix + "-list-" + indentIndex);
            }
        };

        var setListCounter = function(line, stylePrefix, indentIndex) {
            if (indentIndex > 0) {
                line.parentNode.style.setProperty(
                    'counter-reset', stylePrefix + "-counter-" + indentIndex);
            }

            line.style.setProperty(
                'counter-reset', stylePrefix + "-counter-" + (indentIndex + 1));
        };

        var setSelection = function(selection) {
            let range,
                startNode = selection.startContainer,
                endNode = selection.endContainer;

            if (startNode && endNode) {
                let startOffset = initObject(selection.startOffset, 0),
                    endOffset = initObject(selection.endOffset, endNode.length);

                range = document.createRange();

                try {
                    range.setStart(startNode, startOffset);
                    range.setEnd(endNode, endOffset);
                    _range = range;
                } catch (err) {
                    // Chrome does not like setting an offset of 1
                    // on an empty node.
                }
                resetRange(range);
            }
            return range;
        };

        var getAncestorLines = function(lines) {
            let ancestorNodes = [];
            for(var i=0; i<lines.length; i++) {
                let curNode = lines[i];
                while (lines.indexOf(curNode.parentNode) != -1) {
                    curNode = curNode.parentNode;
                }
                if (ancestorNodes.indexOf(curNode) == -1) {
                    ancestorNodes.push(curNode);
                }
            }
            return ancestorNodes;
        };

        var updateIndentation = function(range, increase) {
            var lines = getLinesInRange(range);
            var instruction = increase ? 'atgIncrement' : 'atgDecrement';

            // If multiple lines are selected, increase the indentation. Note
            // that the list indentation is unaffected.
            var ancestorLines;
            if (lines.length > 1) {
                ancestorLines = getAncestorLines(lines);
                for(i=0; i<ancestorLines.length; i++) {
                    applyStyle(ancestorLines[i], instruction,
                        ['margin-left:55px']);
                }
                return;
            }

            // If only one line or one or more tasgs in a single line
            // is selected..
            var node = range.startContainer,
                offset = range.startOffset,
                firstLine = lines[0];

            var isLineBegin = isBeginingOfLine(getFragment(node), offset);

            if (increase) {
                if (isLineBegin) {
                    if (isList(firstLine) && !isListHead(firstLine)) {
                        createOrIndentList(firstLine, null, true);
                        return;
                    }
                }
                insertTab(node, offset);
            }
            else if (isLineBegin && isList(firstLine)) {
                outdentList(firstLine, false);
            }
        };

        var isBeginingOfLine = function(node, offset) {
            return (isBlankNode(node) || offset == 0) &&
                !node.previousSibling;
        };

        var isEndOfLine = function(node, offset) {
            // return !isFragment(tag.nextSibling) && offset == tag.textContent.length;
            return !node.nextSibling && offset == node.textContent.length;
        };

        var deleteChar = function(text, offset) {



            // Delete if this is a tab
            // if (isTabFragment(fragment)) {
            //     // setCaret(fragment.nextSibling, 0);
            //     // removeNode(fragment);
            //
            // } else {
                // var str = fragment.textContent,
                //     textNode = fragment.firstChild;
                //
                // offset = initObject(offset, str.length);
                // textNode.nodeValue =
                //     str.slice(0, offset - 1) + str.slice(offset);
                //
                // if (textNode.nodeValue.length == 0 && offset == 1) {
                //     var previous = fragment.previousSibling;
                //     if (!isTextFragment(previous)) {
                //         textNode.nodeValue = _zeroWidthSpace;
                //         setCaret(fragment, 1);
                //
                //     } else {
                //         setCaret(previous);
                //         removeNode(fragment);
                //     }
                // } else {
                //     setCaret(textNode, offset - 1);
                // }
            // }
        };

        var deleteLine = function(line) {
            if (isList(line) && !isListRoot(line)) {
                if (isAnonymousList(line)) {
                    outdentList(line, false);
                }
                else {
                    anonymizeList(line);
                }
                return;
            }

            // If indented, remove the indentation and return.
            if (getStylePropertyValue(line, 'margin-left') !== '0px') {
                line.style.removeProperty('margin-left');
                return;
            }

            // None of the above, proceede with deleting the line.
            var prevLine = line.previousSibling;
            if (prevLine && isLine(prevLine)) {

                var fragments = getFragmentsInLine(prevLine, true);
                var lastFragment = fragments[fragments.length - 1];

                if (isBlankLine(prevLine)) {
                    removeNode(prevLine);
                }
                else if (isBlankLine(line)) {
                    setCaret(lastFragment);
                    removeNode(line);
                }
                else {
                    setCaret(lastFragment);
                    let fragment = lastFragment;
                    fragments = getFragmentsInLine(line);

                    for(var i=0; i<fragments.length; i++) {
                        fragment = appendNode(fragments[i], fragment);
                    }

                    if (isBlankLine(line)) {
                        removeNode(line);
                    }

                    if (isBlankNode(lastFragment)) {
                        removeNode(lastFragment);
                    }
                }
            }
        };

        var deleteSelection = function(range) {
            // var fragment =
            //     createFragmentsInRange(range).first.previousSibling;
            //
            // // Building Fragments resets the range. The latest range is stored in
            // // _range. Also, retrieve both Fragments and Lines before the range
            // // gets updated by any delete operation.
            // var fragments = getFragmentsInRange(_range),
            //     lines = getLinesInRange(_range);
            //
            // if (fragment) {
            //     lines.shift();
            // } else {
            //     var prevLine = lines[0].previousSibling;
            //     if (prevLine) {
            //         fragment = getFragmentsInLine(prevLine).pop();
            //     }
            // }
            // setCaret(fragment);
            // removeNodesInList(fragments.concat(lines));
            // fixEditor();
        };

        var processDelete = function(range) {
            // var offset = range.startOffset,
            //     container = range.startContainer;
            //
            // if (range.collapsed) {
            //     var fragment = getFragment(container);
            //     if (isTextNode(container)) {
            //         if (isPilotFragment(fragment)) {
            //             deleteLine(getLine(fragment));
            //         } else {
            //             deleteChar(container, offset || null);
            //         }
            //
            //     }
            //
            //
            //
            //     // var fragment = getFragment(container);
            //     // var target = fragment;
            //     //
            //     // if (offset == 0 || isBlankNode(fragment)) {
            //     //     target = target.previousSibling;
            //     // }
            //     //
            //     // // The previous sibling may be a fragment if this line
            //     // // follows a list.
            //     // if (target && isFragment(target)) {
            //     //     // If offset is zero, send null as argument so that
            //     //     // offset is calculated to be the full length of the
            //     //     // string value in fragment.
            //     //     deleteChar(target, offset || null);
            //     //
            //     // } else {
            //     //     deleteLine(getLine(fragment));
            //     // }
            // } else {
            //     deleteSelection(range);
            // }
        };

        var updateList = function(line, stylePrefix, indentIndex, overrideStyle) {
            overrideStyle = initObject(overrideStyle, true);
            if (!initList(line)) {
                setListCounter(line, stylePrefix, indentIndex);
                setListStyle(line, stylePrefix, indentIndex, overrideStyle);
            }
        };

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

        var splitFragment = function(fragment, offset) {
            // var text = fragment.firstChild;
            //
            // // Splitting at boundaries will result in blank nodes.
            // if (offset == 0 || offset == text.nodeValue.length) {
            //     return fragment;
            // }
            //
            // var newText = text.splitText(offset);
            // var newFragment = createTextFragment(removeNode(newText));
            // newFragment.setAttribute('style', fragment.getAttribute('style'));
            //
            // // Firefox hack to remove break nodes.
            // removeNode(fragment.querySelector('br'));
            //
            // return appendNode(newFragment, fragment);
        };

        var fragmentText = function(text, offset) {
            offset = initObject(offset, 0);
            if (isTextNode(text)) {
                let fragment = getFragment(text),
                    newFragment;

                // Splitting at boundaries will result in blank nodes.
                if (offset == 0 || offset == text.textContent.length) {
                    let parent = text.parentNode;
                    if (isTextFragment(parent)) {
                        newFragment = fragment;
                    }
                    else {
                        let nextSibling = text.nextSibling;
                        newFragment = createTextFragment(removeNode(text));
                        parent.insertBefore(newFragment , nextSibling);
                    }

                }
                else {
                    let newText = text.splitText(offset);
                    newFragment = createTextFragment(removeNode(newText));

                    // Firefox hack to remove break nodes.
                    removeNode(fragment.querySelector('br'));

                    let prevNode;
                    if (isTextFragment(fragment)) {
                        prevNode = fragment;
                        newFragment.setAttribute('style',
                            fragment.getAttribute('style'));
                    }
                    else {
                        prevNode = text;
                    }
                    appendNode(newFragment, prevNode);
                }
                return newFragment;
            }
        };

        var createFragmentsInRange = function(range) {
            if (!range.collapsed) {
                let selection = getRangeContainersAndOffsets(range);
                let container = selection.startContainer,
                    offset = selection.startOffset;

                // Split the start Text node. Note that if the offset is a
                // 0 or the length of the container, the container wrapped
                // as a fragment is returned.
                let newFragment = fragmentText(container, offset);

                // Now split the end Text node.
                if (container.isSameNode(selection.endContainer)) {
                    offset = selection.endOffset - offset;
                    container = newFragment.firstChild;
                }
                else {
                    offset = selection.endOffset;
                    container = selection.endContainer;
                }

                // Container here is the end node.
                fragmentText(container, offset);

                // Now collect all text nodes in the range and wrap them
                // in fragment.
                let nodes = getTextNodesInRange(range);
                for(let i=0; i<nodes.length; i++) {
                    if (isLineBody(nodes[i].parentNode)) {
                        fragmentText(nodes[i]);
                    }
                }

                // Rebuild original selection range for further processing.
                _range = setSelection({
                    startContainer: newFragment.firstChild,
                    startOffset: 0,
                    endContainer: container,
                    endOffset: container.length
                });

                return {first: newFragment, last: container};
            }
        };

        editor.addEventListener('dblclick', function(e) {
            saveSelectionRange();
        });

        editor.addEventListener('click', function(e) {
            hideSubmenus();
            if (!fixEditor()) {
               fixCaret();
            }
            // e.preventDefault();
        });

        editor.addEventListener('focus', function(e) {
            // fixEditor();
            // console.log(e.target);
        });

        editor.addEventListener('input', function() {
            // processInput();
            processInputV2();
        });

        // Start handling events.
        editor.addEventListener('keydown', function(e) {
            var keyCode = getKeyCode(e),
                shiftKey = e.shiftKey;

            if (!isDeleteKey(keyCode)) {
                fixCaret();
            }

            // Get the latest and greatest range since we cannot rely on
            // any buffered selection range (_range).
            let range = getRange();

            if (isDeleteKey(keyCode)) {
                if (processDelete(range)) {
                    e.preventDefault();
                }
            }
            else if (isTabKey(keyCode)) {
                updateIndentation(range, !shiftKey);
                e.preventDefault();
            }
            else if (isReturnKey(keyCode)) {
                if (!ignoreReturnKey) {
                    processReturnKey(range);
                }
                e.preventDefault();
            }
            else if (e.metaKey && isFormatKey(keyCode)) {
                formatSelection({ atgToggle: _styleKeyMap[keyCode] });
                e.preventDefault();
            }
            else if (isLeftArrowKey(keyCode) || isRightArrowKey(keyCode)){
                if (processArrowKeys(range, keyCode)) {
                     e.preventDefault();
                }
            }
        });

        editor.addEventListener('keyup', function(e) {
        });

        editor.addEventListener('copy', function(e) {
            // TODO: Remember to remove all \u200b chars from the copied text
            // from the clipboard to prevent the user from pasting unwanted
            // characters.
        });

        editor.addEventListener('paste', function(e) {
            pasteClipboardContent(e);
            e.preventDefault();
        });

        document.addEventListener('selectionchange', debounce(function(e) {
            console.log("Selection Change");
            if (saveSelectionRange()) {
                setContinuingStyle();
                doAfterSelection(getFragmentsInRange(_range));
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
                        resetRange(_range);

                        let target = e.target;
                        let menu = getParentMenu(target);
                        let submenu = menu.querySelector('.' + _submenuClassName);

                        // If a submenu already exists, just display it.
                        if (submenu) {
                            toggleNodeVisibility(submenu);

                        // If atg-submenu is specified (and no submenu exists),
                        // proceed to take action.
                        }
                        else if (menu.dataset.atgSubmenu) {
                            // If atg-submenu eludes to palette, create it and
                            // display the submenu.
                            if (menu.dataset.atgSubmenu.match(/Palette$/)) {
                                createPalette(menu);
                            }

                        }
                        else {

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
