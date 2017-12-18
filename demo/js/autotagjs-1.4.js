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

    var _lists = {
        numbered: {
            segments: [{
                type: 'number',
                suffix: '',
                startAt: 1,
                endAt: 100,
                seperator: '.'
            }]
        }
    };

    // Map keeyboard controls to format options since we override them.
    var _styleKeyMap = {
        66: 'font-weight:bold',
        73: 'font-style:italic',
        85: 'text-decoration:underline'
    };

    var _tab = '\u0009',
        _zeroWidthSpace = '\u00a0';

    var _listIndentCssStyle = 'margin-left:55px',
        _lineIndentCssStyle = 'margin-left:55px';

    var _lineTag = 'div',
        _markedFragmentTag = 'span';

    var _lineClassName = 'atg-line',
        _lineHeaderClassName = 'atg-line-leader',
        _lineBodyClassName = 'atg-line-body',
        _markedFragmentClassName = 'atg-text',
        _listFragmentClassName = 'atg-list',
        _pilotClassName = 'atg-pilot',
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
        let timeout;
        return function() {
            let context = this,
                args = arguments;

            let later = function() {
                timeout = null;
                if (!immediate) {
                    func.apply(context, args);
                }
            };

            let callNow = immediate && !timeout;
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
        for (let i=0; i<nodeList.length; i++) {
            toNode = appendNode(nodeList[i], toNode);
        }
    }

    function containsClass(node, cName) {
        return node && node.classList && node.classList.contains(cName);
    }

    function createElement(tag, cName) {
        let element = document.createElement(tag);
        if (cName) {
            element.className = cName;
        }
        return element;
    }

    function toggleNodeVisibility(node) {
        let style = window.getComputedStyle(node);
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
        for (let i=0; nodeList && i<nodeList.length; i++) {
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

    function isDocumentNode(node) {
        return node && node.nodeType == Node.DOCUMENT_NODE;
    }

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
        let children = [];
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
        let _range,

            // All selection is copied to the clipboard buffer.
            _copiedRange,
            _editorMenubar,

            // Continues the current text style to the next line and
            // across line breaks.
            _continuingStyle = '';

        // Initialize configuration.
        config = config || {};

        let ignoreReturnKey = config.ignoreReturnKey || false;
        let trace = config.trace || false;

        // Callbacks
        let decorator = config.decorator || function(node, text) {};

        // The default splitter splits on words.
        let splitter = config.splitter || splitAtWord;

        // Event callbacks
        let doAfterKeypress = config.afterKeypress || function() {};

        // Returns the fragments under the selection.
        let doAfterSelection = config.afterSelection || function(fragments) {};

        let doOnMenuClick = config.onMenuClick || function() {};

        var applyCommand = function(target, commands) {
            if (Array.isArray(target)) {
                for (let i = 0; i < target.length; i++) {
                    applyCommand(target[i], commands);
                }
            } else {
                for (let j = 0; j < commands.length; j++) {
                    let cmd = commands[j].split(/ +/);
                    switch(cmd[0]) {
                        case 'indent':
                            updateLineIndentation(target, true);
                            break;
                        case 'outdent':
                            updateLineIndentation(target, false);
                            break;
                        case 'list':
                            updateListIndentation(target, true, cmd[1]);
                            break;
                    }
                }
            }
        };

        var processInstruction = function(nodes, instruction, declarations) {
            if (instruction == 'atgCommand') {
                applyCommand(nodes, declarations);
            }
            else if (instruction == 'atgCallback') {
                doOnMenuClick(declarations, nodes);
            }
            else {
                applyStyle(nodes, instruction, declarations);
            }
        };

        var applyStyle = function(target, instruction, declarations) {
            if (Array.isArray(target)) {
                for (let i = 0; i < target.length; i++) {
                    applyStyle(target[i], instruction, declarations);
                }
            } else {
                target = isTextNode(target) ? target.parentNode : target;
                for (let j = 0; j < declarations.length; j++) {
                    let declaration = declarations[j].split(/\s*:\s*/),
                        property = declaration[0],
                        value = declaration[1];

                    let targetStyle = target.style;
                    let curValue = targetStyle.getPropertyValue(property);

                    if (curValue.length > 0 &&
                        instruction.match(/^atg(Unset|Toggle)/)) {
                        targetStyle.removeProperty(property);

                    }
                    else if (curValue.length === 0 &&
                        instruction.match(/^atg(Set|Initialize|Toggle)/)) {
                        targetStyle.setProperty(property, value);

                    }
                    else if (instruction.match(/^atg(Increment|Decrement)/)) {
                        curValue = curValue ||
                            getComputedStyle(target).getPropertyValue(property);

                        let amount = extractAmount(value),
                            curAmount = extractAmount(curValue);

                        switch(instruction) {
                            case 'atgIncrement':
                                curAmount += amount;
                                break;
                            case 'atgDecrement':
                                curAmount -= amount;
                                break;
                        }

                        if (curAmount <= 0) {
                            targetStyle.removeProperty(property);
                        }
                        else {
                            targetStyle.setProperty(property, curAmount + 'px');
                        }
                    }
                }
            }
        };

        var createPalette = function(menu) {
            let palette = menu.getElementsByClassName(_submenuClassName)[0];
            if (palette) {
                palette.style.display = '';
            }
            else {
                palette = createElement('div',
                    _submenuClassName + ' ' + _paletteClassName);

                let type = menu.dataset.atgSubmenu.split('Palette')[0];
                palette.dataset.atgPalette = type;
                palette.dataset.atgScope = menu.dataset.atgScope;
                menu.appendChild(palette);

                // Color palette
                let row, cell, maxCols = 10, maxRows = 5;

                let hueStep = Math.round(360 / maxCols),
                    saturationStep = Math.round(10 / maxRows),
                    luminosityStep = Math.round(90 / maxRows);

                for (let i = 0, s = 100, l = 94; i < maxRows; i++, s -= saturationStep, l -= luminosityStep) {
                    row = createPaletteRow(palette);
                    for (let j = 0, h = 0; j < maxCols; j++, h += hueStep) {
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

        var createPaletteCellAction = function(cell, type) {
            let dataset = cell.dataset;
            if (!dataset.atgSet) {
                let style, color = dataset.atgPaletteColor;
                if (type === 'color') {
                    style = 'color: ' + color;
                }
                else if (type === 'highlight') {
                    style = 'background-color: ' + color;
                    let contrast = dataset.atgPaletteContrastColor;
                    if (contrast) {
                        style = style + '; color: ' + contrast;
                    }
                }
                dataset.atgSet = style;
            }
        };

        // var emptyLineObserver = function(mutationList) {
        //     for(let mutation of mutationList) {
        //         let target = mutation.target;
        //         if (mutation.type == 'characterData' &&
        //                 target.textContent.length == 0) {
        //
        //             // Disconnect the observer on this line so that it does not
        //             // fire when we add the pilot node.
        //             this.disconnect();
        //             renewLineBody(target.parentNode, true);
        //
        //             // Now connect it back.
        //             this.observe(target, { childList: true, subtree: true });
        //         }
        //     }
        // };

        var createCrossedPaletteCell = function(row, type) {
            let cell = createPaletteCell(row, 0, 0, 100);
            cell.classList.add(_paletteCellCrossClassName);

            if (type === 'color') {
                cell.dataset.atgPaletteColor = '#000';
            }
            return cell;
        };

        var createPaletteCell = function(row, h, s, l, type) {
            let hsla = 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + '1.0)';
            let cell = createElement('div', _paletteCellClassName);

            cell.style.background = hsla;
            cell.dataset.atgPaletteColor = hsla;

            if (type === 'highlight') {
                cell.dataset.atgPaletteContrastColor =
                    generateContrastColor(cell.style.background);
            }
            return row.appendChild(cell);
        };

        var generateContrastColor = function(rgbStr) {
            let rgb = rgbStr.match(/[.?\d]+/g);
            for (let i=0; i < 3; i++) {
                rgb[i] = rgb[i]/255.0;
                rgb[i] =
                    (rgb[i] <= 0.03928) ? rgb[i]/12.92
                                        : Math.pow((rgb[i] + 0.055)/1.055, 2.4);
            }
            let lumin = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
            return (lumin > 0.179) ? '#000' : '#FFF';
        };

        var createPaletteRow = function(palette) {
            return palette.appendChild(
                createElement('div', _paletteRowClassName));
        };

        var generateLineHeader = function(line) {
            let header = getLineHeader(line);

            if (!header) {
                header = createElement(_lineTag, _lineHeaderClassName);
                header.setAttribute('contenteditable', 'false');
                line.insertBefore(header, line.firstChild);
            }

            // Now generate the content.
            let listId = line.dataset.atgListId;
            if (listId) {
                removeAllChildNodes(header);
                header.appendChild(createTextNode(listId));
            }
            return header;
        };

        var createLine = function(refLine, options) {
            options = options || {};

            let line = createElement(_lineTag, _lineClassName),
                body = createElement(_lineTag, _lineBodyClassName);

            line.appendChild(body);

            // Set the identation position
            line.dataset.atgIndentPos = 0;

            // Start observing the body for empty lines so that we can
            // replenish it with the pilot node.
            // let observer = new MutationObserver(emptyLineObserver);
            // observer.observe(body, { characterData: true, childList: true, subtree: true });

            if (refLine) {
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

                if (options.attachAs !== 'child' && isList(refLine)) {
                    line.dataset.atgIndentPos = refLine.dataset.atgIndentPos;
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

        // Returns a marked fragment (<span>...</span>)
        var createMarkedFragment = function(text, cName, style) {
            if (typeof text === 'string') {
                text = createTextNode(text);
            }

            if (isTextNode(text)) {
                let fragment = createElement(_markedFragmentTag, cName);
                fragment.appendChild(text);
                fragment.setAttribute('style', style || _continuingStyle);
                fragment.classList.add(_markedFragmentClassName);
                return fragment;
            }
        };

        var createTextNode = function(str) {
            // Firefox hack - without this, firefox will ignore the leading
            // space in the element causing all sorts of headache.
            str = str && str.replace(/ /g, '\u00a0') || '';
            return document.createTextNode(str);
        };

        var fixCaret = function(range) {
            range = initObject(range, getRange());
            if (range.collapsed) {
                setCaret(range.endContainer, range.endOffset);
            }
        };

        var fixEditor = function() {
            if (editor.textContent.length == 0) {
                return createLine(editor, {
                    attachAs: 'child',
                    addPilotNode: true,
                    setCaret: true
                });
            }
        };

        var formatSelection = function(dataset, scope) {
            if (_range && dataset) {
                let nodes = getNodesInSelection(scope);
                for (let key in dataset) {
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
            let nodes;
            switch (scope) {
                case 'line':
                    nodes = getLinesInRange(_range);
                    break;
                default:
                    nodes = createFragmentsInRange(_range);
                    break;
            }
            return nodes.filter(Boolean);
        };

        var getActiveLine = function() {
            return _range && getLine(_range.startContainer, false);
        };

        var getFirstLine = function() {
            return editor.querySelector(_lineTag + ':first-child');
        };

        var getLineBody = function(node) {
            if (!isLine(node)) {
                node = getLine(node);
            }
            return node.querySelector('.' + _lineBodyClassName);
        };

        var getLineHeader = function(node) {
            if (!isLine(node)) {
                node = getLine(node);
            }
            return node.querySelector('.' + _lineHeaderClassName);
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

        var getFragmentsInLine = function(line) {
            let walker = getTreeWalker(getLineBody(line), NodeFilter.SHOW_TEXT);
            return getNodesFromTree(walker, isTextNode);
        };

        var getNodesFromTree = function(walker, filter, limit) {
            let nodes = [];
            do {
                let node = walker.currentNode;
                if (!filter || filter(node)) { nodes.push(node); }
            } while (walker.nextNode() && (!limit || nodes.length <= limit));
            return nodes;
        };

        var getNodesInRange = function(range, nodeFilter, filter) {
            let walker = getRangeWalker(range, nodeFilter, filter);
            return getNodesFromTree(walker, filter);
        };

        var getParentMenu = function(node) {
            while(node && !containsClass(node, _submenuClassName) &&
                !containsClass(node, _menuClassName)) {
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

            let ancestor = range.commonAncestorContainer ;
            while (ancestor && !ancestorFilter(ancestor) &&
                !isEditor(ancestor) && !isDocumentNode(ancestor)) {
                ancestor = ancestor.parentNode;
            }

            return getTreeWalker(ancestor, whatToShow, function(node) {
                return rangeIntersectsNode(range, node);
            });
        };

        // var getFragment = function(node) {
        //     if (isTextNode(node)) {
        //         node = node.parentNode;
        //     }
        //
        //     if (isFragment(node)) {
        //         return node;
        //     }
        //     else if (isLine(node)) {
        //         return getFragmentsInLine(node)[0];
        //     }
        // };

        // var getFragmentsInLine = function(line) {
        //
        //     if (deep) {
        //         let walker = getTreeWalker(line, NodeFilter.SHOW_ELEMENT);
        //         return getNodesFromTree(walker, isFragment);
        //     }
        //     else {
        //         return getChildren(line, isFragment);
        //     }
        // };

        var getFragmentsInRange = function(range) {
            return getNodesInRange(range, NodeFilter.SHOW_TEXT, isFragment);
        };

        // Return all text nodes that are wrapped.
        var getMarkedFragmentsInRange = function(range) {
            return getNodesInRange(range, NodeFilter.SHOW_TEXT,
                isMarkedFragment);
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
            let submenus = menubar.querySelectorAll('.' + _submenuClassName);
            for(let i=0; i<submenus.length; i++) {
                hideNode(submenus[i]);
            }
        };

        var isEditor = function(node) {
            return node && node.isSameNode(editor);
        };

        var isLine = function(node) {
            return isElementNode(node) &&
                containsClass(node, _lineClassName);
        };

        var isLineBody = function(node) {
            return isElementNode(node) &&
                containsClass(node, _lineBodyClassName);
        };

        var isLineHeader = function(node) {
            return isElementNode(node) &&
                containsClass(node, _lineHeaderClassName);
        };

        var isFragment = function(node) {
            // return containsClass(node, _markedFragmentClassName);
            return node && isTextNode(node) &&
                (containsClass(node.parentNode, _lineBodyClassName) ||
                    containsClass(node.parentNode, _markedFragmentClassName));
        };

        var isMarkedFragment = function(node) {
            return isFragment(node) &&
                containsClass(node.parentNode, _markedFragmentClassName);
        };

        var isUnmarkedFragment = function(node) {
            return isFragment(node) &&
                containsClass(node.parentNode, _lineBodyClassName);
        };

        var isPilotNode = function(node) {
            node = isTextNode(node) ? node.parentNode : node;
            return containsClass(node, _pilotClassName);
        };

        var isList = function(node) {
            return isLine(node) && node.dataset.atgIndentPos !== '0';
        };

        var getFirstLineInList = function(line) {
            while (isList(line.previousSibling)) {
                line = line.previousSibling;
            }
            return line;
        };

        var generateIndentationIdentifier = function(line) {
            let curLine = line;

            line = getFirstLineInList(line);
            if (isList(line)) {
                let indentIds = [];
                let indentPos = 0, curPos;
                do {
                    let listId = line.dataset.atgListId;

                    // If the listId is blank, do not consider this line
                    // as a part of the list. However, proceed with generating
                    // the Line header as usual since we want to maintain the
                    // the same indentation as the previous line.
                    if (isNaN(listId) || listId.length > 0) {
                        curPos = parseInt(line.dataset.atgIndentPos);
                        if (curPos > indentPos) {
                            indentIds[curPos - 1] = 0;
                        }
                        indentIds[curPos - 1] += 1;
                        indentPos = curPos;

                        // Fill in for skipped positions
                        for(let i=0; i<indentIds.length; i++) {
                            if (!indentIds[i]) indentIds[i] = 1;
                        }

                        line.dataset.atgListId =
                            indentIds.slice(0, parseInt(indentPos)).join('.');
                    }
                    generateLineHeader(line);

                } while (isList(line.nextSibling) && (line = line.nextSibling));
            }

            if (!isList(curLine)){
                let header = getLineHeader(curLine);
                if (header) removeNode(header);
            }

        };

        var insertTab = function(node, index) {
            if (isTextNode(node)){
                node.nodeValue = node.textContent.splice(index, 0, '\u0009');
                setCaret(node, index + 1);
            }
            processInput();
        };

        var processInput = function() {
            let container = _range.endContainer;

            if (isTextNode(container)) {
                let value = container.nodeValue;
                let parent = container.parentNode;

                // Remove the lead character as it is no longer required.
                if (value.match(/\u00a0/) &&
                    containsClass(parent, _pilotClassName)) {

                    container.nodeValue = value.replace(/\u00a0/g, '');
                    parent.classList.remove(_pilotClassName);
                    range = setCaret(container);
                }

                // Mark unmarked text nodes. This is not strictly required
                // but it helps by pre-empting the burden of doing so later.
                else if (isUnmarkedFragment(container)) {
                    fragmentText(container, 0);
                    setCaret(container);
                }
            }
        };

        var pasteClipboardContent = function(e) {
            let content;
            let container = _range.endContainer;

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
                    let textNode = document.createTextNode(content);
                    container.insertBefore(textNode, container.firstChild);
                    setCaret(textNode);
                }
                processInput();
            }
            else {
                let fragment =
                    splitFragment(container.parentNode, _range.endOffset);
                appendNode(_copiedRange.cloneContents(), fragment);

                if (isBlankNode(fragment) && !isList(fragment.nextSibling)) {
                    removeNode(fragment);
                }
            }
        };

        var processArrowKeys = function(range, keyCode) {};

        var processReturnKey = function(range, shifted) {
            let container = range.startContainer;
            let offset = range.startOffset;

            fixCaret(range);

            if (range.collapsed && isTextNode(container)) {
                let newLine;
                let line = getLine(container);

                if (isEndOfLine(container, offset)) {
                    newLine = createLine(line, {
                        addPilotNode: true,
                        setCaret: true
                    });
                }
                else if (isBeginingOfLine(container, offset)) {
                    newLine = createLine(line, {
                        attachAs: 'previous_sibling',
                        addPilotNode: true,
                        setCaret: false
                    });
                }
                else {
                    var fragment = fragmentText(container, offset)[1];
                    newLine = createLine(line, {attachAs: 'next_sibling'});

                    // // Collect remaining nodes (Fragments and Lines) and append
                    // // them to the new line.
                    let node = fragment, nodes = [];
                    while ((node = node.nextSibling)) {
                        nodes.push(node);
                    }

                    getLineBody(newLine).appendChild(fragment);
                    appendNodes(nodes, fragment);
                    setCaret(fragment.firstChild, 0);
                }

                newLine.className = line.className;

                // A common line style is indentation set using CSS margins.
                // Carry this onto the new line.
                let style = line.getAttribute('style');
                if (style) {
                    newLine.setAttribute('style', style);
                }

                // Shift + Return allows creating new lines without the list
                // numbering while retaining the same indentation and allowing
                // the list to continue as usual in the folllowing lines.
                if (isList(newLine) && shifted) {
                    newLine.dataset.atgListId = '';
                }

                generateIndentationIdentifier(newLine);
            }
        };

        var saveSelectionRange = function() {
            let range = getRange();
            if (range && range.startContainer.nodeType != 9) {
                _range = getRange() || _range;
                return _range;
            }
        };

        var setCaret = function(node, offset) {
            if (!isTextNode(node)) {
                node = getFragmentsInRange(range).pop();
                offset = 0;
            }

            if (node) {
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
                let fragment = getMarkedFragmentsInRange(_range).pop();
                if (fragment) {
                    _continuingStyle = fragment.parentNode.getAttribute('style');
                }
            }
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

        var setLineIndentPosition = function(line, pos) {
            line.dataset.atgIndentPos = pos;
        };

        var updateListIndentation = function(line, increase, type) {
            applyStyle(line, getIncrementDecrementInstruction(increase),
                [_listIndentCssStyle]);

            var indentPos = parseInt(line.dataset.atgIndentPos);
            if (increase) {
                if (indentPos) {
                    setLineIndentPosition(line, indentPos + 1);
                }
                else {
                    setLineIndentPosition(line, 1);
                }
            }
            else if (indentPos) {
                setLineIndentPosition(line, indentPos - 1);
            }
            generateIndentationIdentifier(line);
        };

        var updateLineIndentation = function(line, increase, list) {
            applyStyle(line, getIncrementDecrementInstruction(increase),
                [_lineIndentCssStyle]);
        };

        var getIncrementDecrementInstruction = function(increase) {
            return increase ? 'atgIncrement' : 'atgDecrement';
        };

        var updateIndentationInRange = function(range, increase, list) {
            let node = range.startContainer,
                offset = range.startOffset,
                isCaret = range.collapsed;

            let line = getLine(node);
            let isCaretAtBeginning = isCaret &&
                    isBeginingOfLine(node, offset);

            if (isCaretAtBeginning || !isCaret) {
                if (isList(line)) {
                    updateListIndentation(line, increase);
                }
                else if (!isCaret){
                    updateLineIndentation(line, increase);
                }
                else if (increase){
                    insertTab(node, offset);
                } else {
                    return false;
                }
            }
            else {
                if (increase && isCaret) {
                    insertTab(node, offset);
                } else {
                    return false;
                }
            }
            return true;
        };

        var isIndented = function(node) {
            return window.getComputedStyle(getLine(node), null)
                .getPropertyValue("margin-left") !== '0px';
        };

        var isBeginingOfLine = function(node, offset) {
            let line = getLine(node);
            let firstFragment = getFragmentsInLine(line).shift();
            return isTextNode(node) && node.isSameNode(firstFragment) &&
                (offset == 0 || isPilotNode(node.parentNode));
        };

        var isEndOfLine = function(node, offset) {
            let parent = node.parentNode;
            return isTextNode(node) &&
                ((offset == node.textContent.length &&
                    (isLineBody(parent) || !parent.nextSibling)) ||
                    isPilotNode(parent));
        };

        var deleteChar = function(node, offset) {
            node.nodeValue = node.textContent.splice(offset - 1, 1, '');
            var body = getLineBody(node);
            if (body.textContent.length == 0) {
                renewLineBody(body, true);
            }
            else {
                setCaret(node, offset - 1);
            }
        };

        var deleteLine = function(line) {
            let previousLine = line.previousSibling;
            if (previousLine) {
                // let children = getChildren(getLineBody(line));
                let prevLineBody = getLineBody(previousLine);
                setCaret(prevLineBody.lastChild.firstChild);

                let lineBody = getLineBody(line);
                let firstChild;
                while ((firstChild = lineBody.firstChild) &&
                    !isPilotNode(firstChild)) {
                    prevLineBody.appendChild(firstChild);
                }
                removeNode(line);
            }
        };

        var deleteSelection = function(range) { };

        var processDelete = function(range) {
            if (range.collapsed) {
                let container = range.startContainer,
                    offset = range.startOffset;
                let line = getLine(container);

                if (!updateIndentationInRange(range, false)) {
                    if (isBeginingOfLine(container, offset)) {
                        deleteLine(line);
                    }
                    else {
                        deleteChar(container, offset);
                    }
                }
            } else {

            }
        };

        var clearNodeStyle = function(node, force) {
            // Clear up the style attribute.
            if (force || !node.getAttribute('style')) {
                node.removeAttribute('style');
            }
        };

        var splitFragment = function(fragment, offset) {
        };

        var fragmentText = function(text, offset) {
            offset = initObject(offset, 0);
            if (isTextNode(text)) {
                let newFragment;
                let fragment = text.parentNode;
                if (isMarkedFragment(text)) {
                    if (offset == 0) {
                        newFragment = fragment;
                    }
                    else {
                        let newText = text.splitText(offset);
                        let style = fragment.getAttribute('style');
                        newFragment = createMarkedFragment(
                            removeNode(newText), null, style);
                        appendNode(newFragment, fragment);
                    }
                    return [fragment, newFragment];
                }
                else {
                    let next = text.nextSibling;
                    newFragment = createMarkedFragment(removeNode(text));
                    fragment.insertBefore(newFragment, next);
                    return fragmentText(text, offset);
                }
            }
        };

        var createFragmentsInRange = function(range) {
            if (!range.collapsed) {
                let selection = getRangeContainersAndOffsets(range);
                let startContainer = selection.startContainer,
                    startOffset = selection.startOffset,
                    endContainer = selection.endContainer,
                    endOffset = selection.endOffset;

                // Split the start Text node. Note that if the offset is a
                // 0 or the length of the container, the container wrapped
                // as a fragment is returned.
                let startFragment = fragmentText(startContainer, startOffset)[1];

                let endFragment;
                if (startContainer.isSameNode(endContainer)) {
                    endOffset = endOffset - startOffset;
                    endContainer = startFragment.firstChild;

                    if (startContainer.length == endOffset) {
                        endFragment = startFragment;
                    }
                }

                // Now split the end Text node if the first fragment does not
                // already include the content.
                if (!endFragment) {
                    endFragment = fragmentText(endContainer, endOffset)[0];
                }

                // Rebuild original selection range for further processing.
                _range = setSelection({
                    startContainer: startFragment.firstChild,
                    startOffset: 0,
                    endContainer: endFragment.firstChild,
                    endOffset: endOffset
                });

                // Now return all tghe fragments.
                var fragments =  getFragmentsInRange(_range);

                // Ensure all fragment are marked. If not, mark them. Note that
                // unmarked fragments may show up when the selection covers
                // multiple lines in which an intermediate line contains
                // unmarked nodes.
                for (let i=0; i<fragments.length; i++) {
                    if (isUnmarkedFragment(fragments[i])) {
                        let next = fragments[i].nextSibling;
                        let parent = fragments[i].parentNode;
                        let fragment = createMarkedFragment(fragments[i]);
                        parent.insertBefore(fragment, next);
                    }
                }

                return fragments;
            }
        };

        editor.addEventListener('dblclick', function(e) {
            saveSelectionRange();
        });

        editor.addEventListener('click', function(e) {
            hideSubmenus();
            fixEditor();
        });

        editor.addEventListener('focus', function(e) {
        });

        editor.addEventListener('input', function() {
            processInput();
        });

        // Start handling events.
        editor.addEventListener('keydown', function(e) {
            let keyCode = getKeyCode(e),
                shiftKey = e.shiftKey;

            if (!isDeleteKey(keyCode)) {
                fixCaret();
            }

            // Get the latest and greatest range since we cannot rely on
            // any buffered selection range (_range).
            let range = getRange();

            if (isDeleteKey(keyCode)) {
                processDelete(range);
                // if (processDelete(range)) {
                    e.preventDefault();
                // }
            }
            else if (isTabKey(keyCode)) {
                updateIndentationInRange(range, !shiftKey);
                e.preventDefault();
            }
            else if (isReturnKey(keyCode)) {
                if (!ignoreReturnKey) {
                    processReturnKey(range, shiftKey);
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
            if (saveSelectionRange()) {
                // setContinuingStyle();
                doAfterSelection(getMarkedFragmentsInRange(_range));
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

                            let scope = menu.dataset.atgScope;
                            formatSelection(target.dataset, scope);
                            hideSubmenus();
                        }
                    });
                }
            }
        };
    };
}());
