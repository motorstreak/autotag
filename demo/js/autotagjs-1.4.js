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
    // decorator_:   A callback function that receives nodes for processing.
    //              Use the decorator_ to apply styles on the node or do whatever
    //              processing you wish to do. If one is not provided, the
    //              default decorator_ will be used.
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
    // ignoreReturnKey_: If set to true, return key presses will be
    //              ignored. False by default.
    //
    // onReturnKey: A callback function that gets invoked when a return key
    //              press is detected during the keydown event. The callback will
    //              only be made if the 'ignoreReturnKey_' flag is set to true.
    //
    // trace_:     Set this to true to see debug messages on the console.


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
            return this.slice(0, start) + newSubStr +
                this.slice(start + Math.abs(delCount));
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
    var StyleKeyMap = Object.freeze({
        66: 'font-weight:bold',
        73: 'font-style:italic',
        85: 'text-decoration:underline'
    });

    var List = Object.freeze({
        BLANK: 0,
        INDENT: 1,
        OUTDENT: 2
    });

    var TAB = '\u0009',
        PILOT_TEXT = '\u00a0';

    var LIST_INDENT_STYLE = 'margin-left:25px',
        LINE_INDENT_STYLE = 'margin-left:35px';

    var LINE_TAG = 'div',
        MARKED_FRAGMENT_TAG = 'span';

    var LINE_CLASSNAME = 'atg-line',
        LINE_HEADER_CLASSNAME = 'atg-line-leader',
        LINE_BODY_CLASSNAME = 'atg-line-body',
        MARKED_FRAGMENT_CLASSNAME = 'atg-text',
        LIST_FRAGMENT_CLASSNAME = 'atg-list',
        PILOT_CLASSNAME = 'atg-pilot',
        MENU_CLASSNAME = 'atg-menu',
        PALETTE_CLASSNAME = 'atg-palette',
        PALETTE_CELL_CLASSNAME = 'atg-palette-cell',
        PALETTE_ROW_CLASSNAME = 'atg-palette-row',
        PALETTE_CROSSED_CELL_CLASSNAME = 'atg-crossed-cell',
        SUBMENU_CLASSNAME = 'atg-submenu';

    function initObject(obj, toObj) {
        return ((typeof obj === 'undefined') || obj == null) ? toObj : obj;
    }

    function debounce(func, wait, immediate) {
        let timeout;
        return function() {
            let context = this;
            let args = arguments;
            let later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };

            let callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);

            if (callNow) func.apply(context, args);
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
        for (let i=0, node; (node = nodeList[i]); i++) {
            toNode = appendNode(node, toNode);
        }
    }

    function appendChildNodes(nodeList, toNode) {
        for (let i=0, node; (node = nodeList[i]); i++) {
            toNode.appendChild(node);
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

    function removeNodesInList(nodeList, filter) {
        for (let i=0, node; (node = nodeList[i]); i++) {
            if (!filter || filter(node)) removeNode(node);
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
            if (!filter || filter(node)) children.push(node);
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
        }
        else if ((selection = document.selection) &&
            selection.type != 'Control') {
            range = selection.createRange();
        }
        return range;
    }

    function resetRange(range) {
        if (range) {
            if (window.getSelection) {
                let selection = window.getSelection();
                if (selection.rangeCount > 0) selection.removeAllRanges();
                selection.addRange(range);
            }
            else if (document.createRange) {
                window.getSelection().addRange(range);
            }
            else if (document.selection) {
                range.select();
            }
        }
    }

    function rangeIntersectsNode(range, node) {
        let nodeRange;
        if (range.intersectsNode) {
            return range.intersectsNode(node);
        }
        else {
            nodeRange = node.ownerDocument.createRange();
            try {
                nodeRange.selectNode(node);
            }
            catch (e) {
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

    function wrapNode(node, wrapper) {
        if (node.parentNode) {
            node.parentNode.insertBefore(wrapper, node);
        }
        wrapper.appendChild(node);
    }

    return function(editor, config) {
        // The latest selection made in the editor.
        let savedRange_,

            // All selection is copied to the clipboard buffer.
            copiedRange_,
            editorMenubar_,

            // Continues the current text style to the next line and
            // across line breaks.
            continuingStyle_ = '';

        // Initialize configuration.
        config = config || {};

        let ignoreReturnKey_ = config.ignoreReturnKey || false;
        let trace_ = config.trace || false;

        // Callbacks
        let decorator_ = config.decorator || function(node, text) {};

        // The default splitter splits on words.
        let splitter_ = config.splitter || splitAtWord;

        // Event callbacks
        let doAfterKeypress_ = config.afterKeypress || function() {};

        // Returns the fragments under the selection.
        let doAfterSelection_ = config.afterSelection || function(fragments) {};

        let doOnMenuClick_ = config.onMenuClick || function() {};

        var applyCommand = function(target, commands) {
            if (Array.isArray(target)) {
                for (let i = 0, node; (node = target[i]); i++) {
                    applyCommand(node, commands);
                }
            }
            else {
                for (let j = 0, command; (command = commands[j]); j++) {
                    command = command.split(/ +/);
                    switch(command[0]) {
                        case 'indent':
                            updateLineIndentation(target, true);
                            break;
                        case 'outdent':
                            updateLineIndentation(target, false);
                            break;
                        case 'list':
                            updateListIndentation(target, true, command[1]);
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
                doOnMenuClick_(declarations, nodes);
            }
            else {
                applyStyle(nodes, instruction, declarations);
            }
        };

        var applyStyle = function(target, instruction, declarations) {
            if (Array.isArray(target)) {
                for (let i = 0, node; (node = target[i]); i++) {
                    applyStyle(node, instruction, declarations);
                }
            }
            else {
                target = isTextNode(target) ? target.parentNode : target;
                for (let j = 0; j < declarations.length; j++) {
                    let declaration = declarations[j].split(/\s*:\s*/);
                    let property = declaration[0];
                    let value = declaration[1];

                    let targetStyle = target.style;
                    let curValue = targetStyle.getPropertyValue(property);

                    if (curValue.length > 0 &&
                        instruction.match(/^atg(Unset|Toggle)/)) {
                        targetStyle.removeProperty(property);

                    }
                    else if (instruction.match(/^atg(Set|Initialize|Toggle)/)) {
                        targetStyle.setProperty(property, value);

                    }
                    else if (instruction.match(/^atg(Increment|Decrement)/)) {
                        curValue = curValue ||
                            getComputedStyle(target).getPropertyValue(property);

                        let amount = extractAmount(value);
                        let curAmount = extractAmount(curValue);

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
            let palette = menu.getElementsByClassName(SUBMENU_CLASSNAME)[0];
            if (palette) {
                palette.style.display = '';
            }
            else {
                palette = createElement('div',
                    SUBMENU_CLASSNAME + ' ' + PALETTE_CLASSNAME);

                let type = menu.dataset.atgSubmenu.split('Palette')[0];
                palette.dataset.atgPalette = type;
                palette.dataset.atgScope = menu.dataset.atgScope;
                menu.appendChild(palette);

                // Color palette
                let row, cell, maxCols = 10, maxRows = 5;

                let hueStep = Math.round(360 / maxCols),
                    saturationStep = Math.round(10 / maxRows),
                    luminosityStep = Math.round(90 / maxRows);

                for (let i = 0, s = 100, l = 94; i < maxRows;
                        i++, s -= saturationStep, l -= luminosityStep) {
                    row = createPaletteRow(palette);
                    for (let j = 0, h = 0; j < maxCols; j++, h += hueStep) {
                        createPaletteCell(row, h, s, l, type);
                    }
                }

                row = createPaletteRow(palette);
                luminosityStep = Math.round(100 / (maxCols-1));

                for (let i = 0, l = luminosityStep; i < maxCols-1;
                        i++, l += luminosityStep) {
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
            cell.classList.add(PALETTE_CROSSED_CELL_CLASSNAME);

            if (type === 'color') {
                cell.dataset.atgPaletteColor = '#000';
            }
            return cell;
        };

        var createPaletteCell = function(row, h, s, l, type) {
            let hsla = 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + '1.0)';
            let cell = createElement('div', PALETTE_CELL_CLASSNAME);

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
                createElement('div', PALETTE_ROW_CLASSNAME));
        };

        var generateLineHeader = function(line) {
            let header = getLineHeader(line);

            if (!header) {
                header = createElement(LINE_TAG, LINE_HEADER_CLASSNAME);
                header.setAttribute('contenteditable', 'false');
                line.insertBefore(header, line.firstChild);
            }

            // Now generate the content.
            let listId = line.dataset.atgListId;
            if (listId !== null) {
                removeAllChildNodes(header);
                header.appendChild(createTextNode(listId));
            }
            return header;
        };

        var createLine = function(refLine, options) {
            options = options || {};
            let line = createElement(LINE_TAG, LINE_CLASSNAME);
            let body = createElement(LINE_TAG, LINE_BODY_CLASSNAME);

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
            removeAllChildNodes(node);
            let fragment = markFragment(createTextNode(PILOT_TEXT));
            node.appendChild(fragment.parentNode);
            if (focus) setCaret(fragment, 0);
        };

        // Returns a marked fragment (<span>...</span>)
        var markFragment = function(fragment, cName, style) {
            if (isTextNode(fragment)) {
                if (!fragment.parentNode || isUnmarkedFragment(fragment)){
                    let wrapper = createElement(MARKED_FRAGMENT_TAG, cName);
                    wrapper.setAttribute('style', style || continuingStyle_);
                    wrapper.classList.add(MARKED_FRAGMENT_CLASSNAME);
                    wrapNode(fragment, wrapper);
                }
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

        var initializeEditor = function() {
            if (editor.children.length == 0) {
                return createLine(editor, {
                    attachAs: 'child',
                    addPilotNode: true,
                    setCaret: true
                });
            }
        };

        var formatSelection = function(dataset, scope) {
            if (savedRange_ && dataset) {
                let nodes = getNodesInSelection(scope);
                for (let key in dataset) {
                    if (dataset.hasOwnProperty(key)) {
                        processInstruction(nodes, key,
                            dataset[key].split(/\s*;\s*/));
                    }
                }

                // Ensure that the selection does not disapper after we have
                // applied formatting.
                resetRange(savedRange_);
            }
        };

        var getNodesInSelection = function(scope) {
            let nodes;
            switch (scope) {
                case 'line':
                    nodes = getLinesInRange(savedRange_);
                    break;
                default:
                    nodes = createMarkedFragmentsInRange(savedRange_);
                    break;
            }
            nodes = nodes || [];
            return nodes.filter(Boolean);
        };

        var getActiveLine = function() {
            return savedRange_ && getLine(savedRange_.startContainer, false);
        };

        var getFirstLine = function() {
            return editor.querySelector(LINE_TAG + ':first-child');
        };

        var getLineBody = function(node) {
            if (!isLine(node)) node = getLine(node);
            return node.querySelector('.' + LINE_BODY_CLASSNAME);
        };

        var getLineHeader = function(node) {
            if (!isLine(node)) node = getLine(node);
            return node.querySelector('.' + LINE_HEADER_CLASSNAME);
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

        var getFragmentsInLine = function(node) {
            node = isLine(node) ? node : getLine(node);
            return getNodesFromTree(
                getTreeWalker(getLineBody(node), NodeFilter.SHOW_TEXT),
                isTextNode);
        };

        var getNodesFromTree = function(walker, filter, limit) {
            let nodes = [];
            do {
                let node = walker.currentNode;
                if (!filter || filter(node)) nodes.push(node);
            } while (walker.nextNode() && (!limit || nodes.length <= limit));
            return nodes;
        };

        var getNodesInRange = function(range, nodeFilter, filter) {
            return getNodesFromTree(
                    getRangeWalker(range, nodeFilter, filter),
                    filter);
        };

        var getParentMenu = function(node) {
            while(node && !containsClass(node, SUBMENU_CLASSNAME) &&
                !containsClass(node, MENU_CLASSNAME)) {
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
            let submenus = menubar.querySelectorAll('.' + SUBMENU_CLASSNAME);
            for (let i=0, submenu; (submenu = submenus[i]); i++) {
                hideNode(submenu);
            }
        };

        var isEditor = function(node) {
            return node && node.isSameNode(editor);
        };

        var isLine = function(node) {
            return isElementNode(node) && containsClass(node, LINE_CLASSNAME);
        };

        var isLineBody = function(node) {
            return isElementNode(node) &&
                containsClass(node, LINE_BODY_CLASSNAME);
        };

        var isLineHeader = function(node) {
            return isElementNode(node) &&
                containsClass(node, LINE_HEADER_CLASSNAME);
        };

        var isFragment = function(node) {
            return node && isTextNode(node) &&
                (containsClass(node.parentNode, LINE_BODY_CLASSNAME) ||
                    containsClass(node.parentNode, MARKED_FRAGMENT_CLASSNAME));
        };

        var isMarkedFragment = function(node) {
            return isFragment(node) &&
                containsClass(node.parentNode, MARKED_FRAGMENT_CLASSNAME);
        };

        var isUnmarkedFragment = function(node) {
            return isFragment(node) &&
                containsClass(node.parentNode, LINE_BODY_CLASSNAME);
        };

        var isBlank = function(node) {
            return node &&
                (node.textContent.length ==0 ||
                    node.textContent == PILOT_TEXT);
        };

        var isPilot = function(node) {
            node = isTextNode(node) ? node.parentNode : node;
            return containsClass(node, PILOT_CLASSNAME);
        };

        var isList = function(node) {
            return isLine(node) && node.dataset.atgIndentPos !== '0';
        };

        var isBlankList = function(node) {
            return isList(node) && node.dataset.atgListId === '';
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
                        for (let i=0, id; i<indentIds.length; i++) {
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
            let container = savedRange_.endContainer;
            // let offset = savedRange_.endOffset;
            if (isTextNode(container)) {
                // Mark unmarked text nodes. This is not strictly required
                // but it helps by pre-empting the burden of doing so later.
                if (isUnmarkedFragment(container)) {
                    splitFragment(container, 0);
                    setCaret(container);
                }
            }
        };

        var pasteClipboardContent = function(e) {
            let content;
            let container = savedRange_.endContainer;
            if (!copiedRange_ || copiedRange_.collapsed) {
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
                    splitFragment(container.parentNode, savedRange_.endOffset);
                appendNode(copiedRange_.cloneContents(), fragment);
                if (isBlank(fragment) && !isList(fragment.nextSibling)) {
                    removeNode(fragment);
                }
            }
        };

        var processArrowKeys = function(range, keyCode) {

        };

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
                    var fragment = splitFragment(container, offset)[1];
                    newLine = createLine(line, {attachAs: 'next_sibling'});

                    // // Collect remaining nodes (Fragments and Lines) and append
                    // // them to the new line.
                    let node = fragment.parentNode, nodes = [];
                    do {
                        nodes.push(node);
                    } while ((node = node.nextSibling));

                    appendChildNodes(nodes, getLineBody(newLine));
                    setCaret(fragment, 0);
                }

                newLine.className = line.className;

                // A common line style is indentation set using CSS margins.
                // Carry this onto the new line.
                let style = line.getAttribute('style');
                if (style) newLine.setAttribute('style', style);

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
                savedRange_ = getRange() || savedRange_;
                return savedRange_;
            }
        };

        var setCaret = function(node, offset) {
            if (!isTextNode(node)) {
                node = getFragmentsInLine(node).pop();
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
            if (savedRange_) {
                let fragment = getMarkedFragmentsInRange(savedRange_).pop();
                if (fragment) {
                    continuingStyle_ = fragment.parentNode.getAttribute('style');
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
                    savedRange_ = range;
                }
                catch (err) {
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

        var updateListIndentation = function(line, indentType, type) {
            if (indentType == List.BLANK && isBlankList(line)) {
                indentType = List.OUTDENT;
            }

            let increaseIndent = (indentType == List.INDENT);
            let decreaseIndent = (indentType == List.OUTDENT);

            if (indentType !== List.BLANK) {
                applyStyle(line,
                    getIncrementDecrementInstruction(increaseIndent),
                    [LIST_INDENT_STYLE]);
            }

            var indentPos = parseInt(line.dataset.atgIndentPos);
            if (increaseIndent) {
                if (indentPos) setLineIndentPosition(line, indentPos + 1);
                else setLineIndentPosition(line, 1);
            }
            else if (decreaseIndent) {
                if (indentPos) setLineIndentPosition(line, indentPos - 1);
            }
            else {
                line.dataset.atgListId = '';
            }
            generateIndentationIdentifier(line);
        };

        var updateLineIndentation = function(line, increase, list) {
            applyStyle(line, getIncrementDecrementInstruction(increase),
                [LINE_INDENT_STYLE]);
        };

        var getIncrementDecrementInstruction = function(increase) {
            return increase ? 'atgIncrement' : 'atgDecrement';
        };

        var updateIndentationInRange = function(range, indentType, list) {
            let node = range.startContainer;
            let offset = range.startOffset;
            let isSelection = !range.collapsed;
            let increase = (indentType == List.INDENT);

            if (isSelection) {
                let lines = getLinesInRange(range);
                for(let i = 0, line; (line = lines[i]); i++) {
                    if (isList(line)) updateListIndentation(line, indentType);
                    else updateLineIndentation(line, increase);
                }
            }
            else {
                let line = getLine(node);
                if (isBeginingOfLine(node, offset)) {
                    if (isList(line)) updateListIndentation(line, indentType);
                    else if (increase) updateLineIndentation(line, increase);
                    else return false;
                }
                else {
                    if (increase) insertTab(node, offset);
                    else return false;
                }
            }
            return true;
        };

        var isIndented = function(node) {
            return window.getComputedStyle(getLine(node), null)
                .getPropertyValue("margin-left") !== '0px';
        };

        var isBeginingOfLine = function(node, offset) {
            let firstFragment = getFragmentsInLine(node).shift();
            return isTextNode(node) && node.isSameNode(firstFragment) &&
                (offset == 0 || isPilot(node.parentNode));
        };

        var isEndOfLine = function(node, offset) {
            let parent = node.parentNode;
            return isTextNode(node) &&
                ((offset == node.textContent.length &&
                    (isLineBody(parent) || !parent.nextSibling)) ||
                    isPilot(parent));
        };

        var deleteChar = function(node, offset) {
            let line = getLine(node);
            let fragments = getFragmentsInLine(line);
            let fragmentIndex = fragments.indexOf(node);
            node.nodeValue = node.textContent.splice(offset - 1, 1, '');

            if (isBlank(line)) {
                renewLineBody(getLineBody(line), true);
            }
            else {
                if (isBlank(node)) {
                    // By all counts this should be a marked fragment.
                    removeNode(node.parentNode);
                    node = fragments[fragmentIndex - 1];
                    setCaret(node);
                }
                else setCaret(node, offset - 1);
            }
        };

        var deleteLine = function(line) {
            let previousLine = line.previousSibling;
            if (previousLine) {
                let prevLineBody = getLineBody(previousLine);
                let lineBody = getLineBody(line);
                if (isPilot(lineBody)) {
                    setCaret(prevLineBody.lastChild);
                }
                else {
                    if (isPilot(prevLineBody)) {
                        removeAllChildNodes(prevLineBody);
                    }
                    let nodes = getChildren(lineBody);
                    if (nodes.length > 0) {
                        appendChildNodes(nodes, prevLineBody);
                        // setCaret(nodes[0], 0);
                    }
                }
                removeNode(line);
            }
        };

        var deleteSelection = function(range) {
            let fragments = createMarkedFragmentsInRange(range);
            for (let i=0, node; (node = fragments[i]); i++) {
                if (isMarkedFragment(node)) node = node.parentNode;
                removeNode(node);
            }
            removeNodesInList(getLinesInRange(range), function(line) {
                return isPilot(line) || isBlank(getLineBody(line));
            });
            initializeEditor();
        };

        var processDelete = function(range) {
            if (range.collapsed) {
                let container = range.startContainer;
                let offset = range.startOffset;

                let line = getLine(container);
                let updateSuccess = updateIndentationInRange(range, List.BLANK);
                if (!updateSuccess) {
                    if (isPilot(container) ||
                        isBeginingOfLine(container, offset)) {
                        deleteLine(line);
                    }
                    else deleteChar(container, offset);
                }
            }
            else deleteSelection(range);
        };

        var clearNodeStyle = function(node, force) {
            if (force || !node.getAttribute('style')) {
                node.removeAttribute('style');
            }
        };

        var splitFragment = function(fragment, offset) {
            offset = initObject(offset, 0);
            let firstFragment;
            let secondFragment;
            let fragments = getFragmentsInLine(getLine(fragment));
            let fragmentIndex = fragments.indexOf(fragment);

            if (isTextNode(fragment)) {
                if (offset == 0) {
                    firstFragment = markFragment(fragments[fragmentIndex - 1]);
                    secondFragment = markFragment(fragment);
                }
                else if (offset == fragment.length) {
                    firstFragment = markFragment(fragment);
                    secondFragment = markFragment(fragments[fragmentIndex + 1]);
                }
                else {
                    firstFragment = markFragment(fragment);
                    secondFragment = fragment.splitText(offset);
                    markFragment(removeNode(secondFragment), null,
                        firstFragment.parentNode.getAttribute('style'));
                    appendNode(secondFragment.parentNode,
                        firstFragment.parentNode);
                }
            }
            return [firstFragment, secondFragment];
        };

        var createMarkedFragmentsInRange = function(range) {
            let fragments;
            if (range.collapsed) {
                fragments = [range.startContainer];
            }
            else {
                let selection = getRangeContainersAndOffsets(range);
                let startContainer = selection.startContainer,
                    startOffset = selection.startOffset,
                    endContainer = selection.endContainer,
                    endOffset = selection.endOffset;

                // Split the start Text node. Note that if the offset is a
                // 0 or the length of the container, the container wrapped
                // as a fragment is returned.
                let startFragment = splitFragment(startContainer, startOffset)[1];

                let endFragment;
                if (startContainer.isSameNode(endContainer)) {
                    endOffset = endOffset - startOffset;
                    endContainer = startFragment;

                    if (startContainer.length == endOffset) {
                        endFragment = startFragment;
                    }
                }

                // Now split the end Text node if the first fragment does not
                // already include the content.
                if (!endFragment) {
                    endFragment = splitFragment(endContainer, endOffset)[0];
                }

                // Rebuild original selection range for further processing.
                savedRange_ = setSelection({
                    startContainer: startFragment,
                    startOffset: 0,
                    endContainer: endFragment,
                    endOffset: endOffset
                });

                // Now return all tghe fragments.
                fragments =  getFragmentsInRange(savedRange_);
            }
            // Ensure all fragment are marked. If not, mark them. Note that
            // unmarked fragments may show up when the selection covers
            // multiple lines in which an intermediate line contains
            // unmarked nodes.
            for (let i=0, node; (node = fragments[i]); i++) {
                if (isUnmarkedFragment(node)) {
                    let next = node.nextSibling;
                    let parent = node.parentNode;
                    let fragment = markFragment(node);
                    parent.insertBefore(fragment, next);
                }
            }
            return fragments;
        };

        editor.addEventListener('dblclick', function(e) {
            saveSelectionRange();
        });

        editor.addEventListener('click', function(e) {
            hideSubmenus();
            initializeEditor();
        });

        editor.addEventListener('focus', function(e) {
            hideSubmenus();
            initializeEditor();
        });

        editor.addEventListener('input', function() {
            processInput();
        });

        // Start handling events.
        editor.addEventListener('keydown', function(e) {
            let keyCode = getKeyCode(e);
            if (!isDeleteKey(keyCode)) fixCaret();

            // Get the latest and greatest range since we cannot rely on
            // any buffered selection range (savedRange_).
            let range = getRange();

            if (isDeleteKey(keyCode)) {
                processDelete(range);
                e.preventDefault();
            }
            else if (isTabKey(keyCode)) {
                updateIndentationInRange(range,
                    e.shiftKey ? List.OUTDENT : List.INDENT);
                e.preventDefault();
            }
            else if (isReturnKey(keyCode)) {
                if (!ignoreReturnKey_) processReturnKey(range, e.shiftKey);
                e.preventDefault();
            }
            else if (e.metaKey && isFormatKey(keyCode)) {
                formatSelection({ atgToggle: StyleKeyMap[keyCode] });
                e.preventDefault();
            }
            else if (isLeftArrowKey(keyCode) || isRightArrowKey(keyCode)) {
                if (processArrowKeys(range, keyCode)) e.preventDefault();
            }
            else {
                // if (!e.metaKey && !e.shiftKey) processInput();
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
                doAfterSelection_(getMarkedFragmentsInRange(savedRange_));
            }
        }, 200));

        return {
            attachMenubar: function(menubar) {
                if (menubar) {
                    editorMenubar_ = menubar;
                    editorMenubar_.addEventListener('click', function(e) {
                        hideSubmenus();

                        // The click event remove the text selection. Reinstate
                        // the selection so that we can format the content in
                        // the highlighted text.
                        resetRange(savedRange_);

                        let target = e.target;
                        let menu = getParentMenu(target);

                        if (!menu) return;
                        let submenu =
                            menu.querySelector('.' + SUBMENU_CLASSNAME);

                        // If a submenu already exists, just display it.
                        if (submenu) {
                            toggleNodeVisibility(submenu);
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
