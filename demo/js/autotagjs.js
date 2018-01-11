/*! autotagjs.js v1.5 https://github.com/motorstreak/autotag */
/*
 Version: 1.5
 Author: Navin Samuel
 Web: https://github.com/motorstreak/autotag
 Licensed under MIT License http://www.opensource.org/licenses/mit-license
*/

// var Autotag = Autotag || {};
var AutotagJS = (function() {
    // Configuration options
    //
    // splitter: A callback function that can receive a Text Node and returns
    //           the offset at which to split the text. Offsets equivalent to
    //           null, zero or the length of the text content are ignored. Note
    //           that splitting text unwantedly increses the size of your
    //           note and therefore slowdown note load and processing,
    //           especially if the note is large.
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
    // trace_:     Set this to true to see debug message s on the console.


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

    var Indent = Object.freeze({
        CLEAR_LIST: 0,
        INCREASE: 1,
        DECREASE: 2
    });

    var Direction = Object.freeze({
        START_TO_END: 1,
        END_TO_START: -1
    });

    var List = {
        'numbered-period': {
            styles: [ 'decimal', 'lower-alpha', 'lower-roman' ],
            suffix: '.'
        },
        'numbered-bracket': {
            styles: [ 'decimal', 'lower-alpha', 'lower-roman' ],
            suffix: ')'
        },
        'numbered-collated': {
            styles: [ 'decimal'],
            suffix: '. ',
            seperator: '.'
        },
        'bulletted': {
            styles: [ 'disc', 'circle', 'square', 'white-square', 'diamond',
                'white-diamond']
        }
    };

    // Map keeyboard controls to format options since we override them.
    var StyleKeyMap = Object.freeze({
        66: 'font-weight:bold',
        73: 'font-style:italic',
        85: 'text-decoration:underline'
    });

    // var LINE_MARKER = '';
    var LINE_MARKER = '\u200b\u200b';
    // Having space as the pilot indicator allows the highlighting
    // of empty lines.
    // var LINE_MARKER = '\u00a0';
    var TAB_TEXT = '\u0009';

    var LIST_INDENT_STYLE = 'margin-left:25px',
        LINE_INDENT_STYLE = 'margin-left:35px';

    var LINE_TAG = 'p',
        MARKED_FRAGMENT_TAG = 'span';

    var LINE_CNAME = 'atg-line',
        LINE_HEADER_CNAME = 'atg-line-leader',
        LINE_BODY_CNAME = 'atg-line-body',
        // PILOT_CNAME = 'atg-pilot',
        BOL_CNAME = 'atg-bol',
        EOL_CNAME = 'atg-eol',
        MENU_CNAME = 'atg-menu',
        MARKER_CNAME = 'atg-text',
        PALETTE_CNAME = 'atg-palette',
        PALETTE_CELL_CNAME = 'atg-palette-cell',
        PALETTE_ROW_CNAME = 'atg-palette-row',
        PALETTE_CROSSED_CELL_CNAME = 'atg-crossed-cell',
        SUBMENU_CNAME = 'atg-submenu';

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
        for (let i=0, node; (node = nodeList[i]); i++) {
            toNode = appendNode(node, toNode);
        }
    }

    function setStyle(node, style) {
        if (isElementNode(node) && style && style.length) {
            node.setAttribute('style', style);
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
            if (!filter || filter(node)) {
                removeNode(node);
            }
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

    function isUpArrowKey(code) {
        return code == 38;
    }

    function isDownArrowKey(code) {
        return code == 40;
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
                if (selection.rangeCount > 0) {
                    selection.removeAllRanges();
                }
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

    function isFormatKey(code) {
        return (code == 66 || code == 73 || code == 85);
    }

    function wrapNode(node, wrapper) {
        if (node.parentNode) {
            node.parentNode.insertBefore(wrapper, node);
        }
        wrapper.appendChild(node);
    }

    function romanize(num) {
        let i, roman = '';
        let lookup = {
            M:1000, CM:900, D:500, CD:400, C:100, XC:90,
            L:50, XL:40, X:10,IX:9,V:5,IV:4,I:1 };

        for (i in lookup) {
            while (num >= lookup[i]) {
              roman += i;
              num -= lookup[i];
          }
        }
        return roman;
    }

    // 'position' is a circular offset that allows the function to return
    // character codes in a circular fashion.
    function getCharCode(type, position) {
        // Get the Ascii character offset.
        let offset = (type == 'lower') ? 97 : 65;
        return String.fromCharCode((offset + (26 + position - 1) % 26));
    }

    function generateListNumbering(listType, listId) {
        // This is a blank/clear list.
        // There is no need to generate the list marker.
        if (listId.length == 0) {
            return '';
        }

        // Continue otherwise..
        let suffix = listType.suffix || '';
        let seperator = listType.seperator || '';

        let markers = [];
        let positions = listId.split('.');
        let stylesCount = listType.styles.length;

        let hpos = (seperator) ? 0 : positions.length - 1;
        for(let vpos; (vpos = parseInt(positions[hpos])); hpos++) {
            let marker;
            let styleIndex = (stylesCount + hpos) % stylesCount;
            switch(listType.styles[styleIndex]) {
                case 'decimal':
                    marker = vpos;
                    break;
                case 'lower-alpha':
                    marker = getCharCode('lower', vpos);
                    break;
                case 'upper-alpha':
                    marker = getCharCode('upper', vpos);
                    break;
                case 'lower-roman':
                    marker = romanize(vpos).toLowerCase();
                    break;
                case 'upper-roman':
                    marker = romanize(vpos);
                    break;
                case 'disc':
                    marker = '\u25cf';
                    break;
                case 'circle':
                    marker = '\u25cb';
                    break;
                case 'square':
                    marker = '\u25a0';
                    break;
                case 'white-square':
                    marker = '\u25a1';
                    break;
                case 'diamond':
                    marker = '\u25c6';
                    break;
                case 'white-diamond':
                    marker = '\u25c7';
                    break;
                default:
                    marker = vpos;
                    break;
            }
            markers.push(marker);
        }
        return markers.join(seperator) + suffix;
    }

    return function(editor, config) {
        // The latest selection made in the editor.
        let keyCode_;

        let savedRange_;
        let savedNode_;

        // All selection is copied to the clipboard buffer.
        let editorMenubar_;

        // Continues the current text style to the next line and
        // across line breaks.
        let continuingStyle_ = '';

        // Initialize configuration.
        config = config || {};

        let ignoreReturnKey_ = config.ignoreReturnKey || false;
        let trace_ = config.trace || false;

        // Callbacks
        let decorator_ = config.decorator || function(nodes) {};

        // The default splitter does not split.
        let splitter_ = config.splitter || function(str) {};

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
                for (let j = 0, cmd; (cmd = commands[j]); j++) {
                    cmd = cmd.split(/ +/);
                    switch(cmd[0]) {
                        case 'indent':
                            updateIndentation(target, Indent.INCREASE);
                            break;
                        case 'outdent':
                            updateIndentation(target, Indent.DECREASE);
                            break;
                        case 'list':
                            updateListIndentation(
                                target, Indent.INCREASE, cmd[1]);
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
                // if (isBlankNode(target)) return;
                target = isTextNode(target) ? target.parentNode : target;
                for (let j = 0; j < declarations.length; j++) {
                    let declaration = declarations[j].split(/\s*:\s*/);
                    let property = declaration[0], value = declaration[1];
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
            let palette = menu.getElementsByClassName(SUBMENU_CNAME)[0];
            if (palette) {
                palette.style.display = '';
            }
            else {
                palette = createElement('div',
                    SUBMENU_CNAME + ' ' + PALETTE_CNAME);

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
                    /**
                        Uncomment to enable generation of contrast color
                        let contrast = dataset.atgPaletteContrastColor;
                        if (contrast) {
                            style = style + '; color: ' + contrast;
                        }
                    */
                }
                dataset.atgSet = style;
            }
        };

        var createCrossedPaletteCell = function(row, type) {
            let cell = createPaletteCell(row, 0, 0, 100);
            cell.classList.add(PALETTE_CROSSED_CELL_CNAME);

            if (type === 'color') {
                cell.dataset.atgPaletteColor = '#000';
            }
            return cell;
        };

        var createPaletteCell = function(row, h, s, l, type) {
            let hsla = 'hsla(' + h + ', ' + s + '%, ' + l + '%, ' + '1.0)';
            let cell = createElement('div', PALETTE_CELL_CNAME);

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
                createElement('div', PALETTE_ROW_CNAME));
        };

        var generateLineHeader = function(line, listType) {
            let header = getLineHeader(line);

            if (!header) {
                header = createElement(LINE_TAG, LINE_HEADER_CNAME);
                header.setAttribute('contenteditable', 'false');
                line.insertBefore(header, line.firstChild);
            }

            // Set the listType from the header if not provided.
            listType = listType || header.dataset.atgListType;
            header.dataset.atgListType = listType;

            // Now generate the content.
            let listId = line.dataset.atgListId;
            if (listId !== null) {
                removeAllChildNodes(header);
                let marker = generateListNumbering(List[listType], listId);
                header.appendChild(createTextNode(marker));
            }
            return header;
        };

        var createLineBody = function(line, options) {
            let body = createElement(LINE_TAG, LINE_BODY_CNAME);
            body.setAttribute('contenteditable', true);
            line.appendChild(body);
            if (options.addPilotNode) {
                renewLineBody(body, options.setCaret);
            }
        };

        var createLine = function(refLine, options) {
            options = options || {};
            let line = createElement(LINE_TAG, LINE_CNAME);
            line.setAttribute('contenteditable', true);

            // Set the identation position
            line.dataset.atgIndentPos = 0;

            if (refLine) {
                switch (options.attachAs) {
                    case 'child':
                        refLine.appendChild(line);
                        break;
                    case 'next-sibling':
                        appendNode(line, refLine);
                        break;
                    case 'previous-sibling':
                        prependNode(line, refLine);
                        break;
                    default:
                        appendNode(line, refLine);
                        break;
                }

                if (options.attachAs !== 'child' && isList(refLine)) {
                    line.dataset.atgIndentPos = refLine.dataset.atgIndentPos;
                }

                createLineBody(line, options);
            }
            return line;
        };

        var renewLineBody = function(node, focus) {
            node = isLine(node) ? getLineBody(node) : node;
            removeAllChildNodes(node);
            let fragment = markFragment(createTextNode(LINE_MARKER));
            let bolWrapper = fragment.parentNode;
            node.appendChild(bolWrapper);

            // let eolWrapper = markedFragment.cloneNode(true);
            // node.appendChild(eolWrapper);

            bolWrapper.classList.add(BOL_CNAME);
            // eolWrapper.classList.add(EOL_CNAME);

            setStyle(bolWrapper, continuingStyle_);
            if (focus) setCaret(fragment, 2);
        };

        // Wraps the fragment in a span tag and returns the same
        // fragment (text node).
        var markFragment = function(fragment, cName, style) {
            if (isTextNode(fragment)) {
                if (!fragment.parentNode || isUnmarkedFragment(fragment)){
                    let wrapper = createElement(MARKED_FRAGMENT_TAG, cName);
                    wrapper.classList.add(MARKER_CNAME);
                    setStyle(wrapper, style || continuingStyle_);
                    wrapNode(fragment, wrapper);
                }
                return fragment;
            }
        };

        var createTextNode = function(str) {
            // Replace all shitespaces w/ non-breaking spaces.
            str = str && str.replace(/ /g, '\u00a0') || '';
            return document.createTextNode(str);
        };

        var fixCaret = function(range) {
            range = initObject(range, getRange());
            if (range.collapsed) {
                let container = range.endContainer;
                let offset = range.endOffset;
                if (isEdgeMarker(container.parentNode) && offset < 2) {
                    offset = 2;
                }
                setCaret(container, offset);
            }
        };

        var resetEdgeMarker = function(line) {
            let edgeMarker = getLineBody(line).firstChild;
            edgeMarker.firstChild.nodeValue = LINE_MARKER;
        };

        var initializeEditor = function() {
            if (editor.textContent.length == 0) {
                return createLine(editor, {
                    attachAs: 'child',
                    addPilotNode: true,
                    setCaret: true
                });
            }
        };

        var formatSelection = function(dataset, scope) {
            if (dataset) {
                // Allow users to chose formatting on empty lines and apply
                // style to following text.
                // if (!savedRange_.collapsed || isBlankNode(savedRange_.endContainer)) {
                    let nodes = getNodesInSelection(scope);
                    for (let key in dataset) {
                        if (dataset.hasOwnProperty(key)) {
                            processInstruction(nodes, key,
                                dataset[key].split(/\s*;\s*/));
                        }
                    }
                    // Ensure that the selection does not disapper after we have
                    // applied formatting.
                    setSelection({
                        startContainer: nodes.shift(),
                        endContainer: nodes.pop(),
                    });
                // }
            }
        };

        var getNodesInSelection = function(scope) {
            let nodes;
            let range = getRange();
            switch (scope) {
                case 'line':
                    nodes = getLinesInRange(range);
                    break;
                default:
                    nodes = createMarkedFragmentsInRange(range);
                    break;
            }
            nodes = nodes || [];
            return nodes.filter(Boolean);
        };

        var getActiveLine = function(range) {
            range = initObject(range, getRange());
            return getLine(range.startContainer, false);
        };

        var getFirstLine = function() {
            return editor && editor.querySelector(LINE_TAG + ':first-child');
        };

        var getLineBody = function(node) {
            if (node && !isLine(node)) node = getLine(node);
            return node && node.querySelector('.' + LINE_BODY_CNAME);
        };

        var getLineHeader = function(node) {
            if (node && !isLine(node)) node = getLine(node);
            return node && node.querySelector('.' + LINE_HEADER_CNAME);
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
            if (walker) {
                do {
                    let node = walker.currentNode;
                    if (!filter || filter(node)) {
                        nodes.push(node);
                    }
                } while (walker.nextNode() && (!limit || nodes.length <= limit));
            }
            return nodes;
        };

        var getNodesInRange = function(range, nodeFilter, filter) {
            return getNodesFromTree(
                getRangeWalker(range, nodeFilter, filter),
                filter);
        };

        var getParentMenu = function(node) {
            while(node && !containsClass(node, SUBMENU_CNAME) &&
                !containsClass(node, MENU_CNAME)) {
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
            if (range) {
                ancestorFilter =  ancestorFilter || isFragment;

                let ancestor = range.commonAncestorContainer ;
                while (ancestor && !ancestorFilter(ancestor) &&
                    !isEditor(ancestor) && !isDocumentNode(ancestor)) {
                    ancestor = ancestor.parentNode;
                }

                return getTreeWalker(ancestor, whatToShow, function(node) {
                    return rangeIntersectsNode(range, node);
                });
            }
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
            let submenus = menubar.querySelectorAll('.' + SUBMENU_CNAME);
            for (let i=0, submenu; (submenu = submenus[i]); i++) {
                hideNode(submenu);
            }
        };

        var isEditor = function(node) {
            return node && node.isSameNode(editor);
        };

        var isLine = function(node) {
            return isElementNode(node) && containsClass(node, LINE_CNAME);
        };

        var isLineBody = function(node) {
            return isElementNode(node) && containsClass(node, LINE_BODY_CNAME);
        };

        var isLineHeader = function(node) {
            return isElementNode(node) && containsClass(node, LINE_HEADER_CNAME);
        };

        var isFragment = function(node) {
            return node && isTextNode(node) &&
                (isLineBody(node.parentNode) || isLineBody(node.parentNode.parentNode));
        };

        var isMarkedFragment = function(node) {
            return isFragment(node) && isMarker(node.parentNode);
        };

        var isUnmarkedFragment = function(node) {
            return isFragment(node) && isLineBody(node.parentNode);
        };

        var isBlankNode = function(node) {
            return node && (node.textContent.length == 0);
        };

        var isBlankLine = function(node) {
            let body = getLineBody(node);
            return body && body.textContent.length <= 2;
        };

        var isMarker = function(node) {
            return node && containsClass(node, MARKER_CNAME);
        };

        var isEdgeMarker = function(node) {
            return isMarker(node) && containsClass(node, BOL_CNAME);
        };

        var isEdgeFragment = function(node) {
            return isEdgeMarker(node.parentNode);
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

        var generateIndentationIdentifier = function(line, listType) {
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
                        if (curPos > indentPos) indentIds[curPos - 1] = 0;
                        indentIds[curPos - 1] += 1;
                        indentPos = curPos;

                        // Fill in for skipped positions
                        for (let i=0, id; i<indentIds.length; i++) {
                            if (!indentIds[i]) indentIds[i] = 1;
                        }
                        line.dataset.atgListId =
                            indentIds.slice(0, parseInt(indentPos)).join('.');
                    }
                    generateLineHeader(line, listType);

                } while (isList(line.nextSibling) && (line = line.nextSibling));
            }

            if (curLine && !isList(curLine)){
                let header = getLineHeader(curLine);
                if (header) {
                    removeNode(header);
                }
            }
        };

        var insertTab = function(node, index) {
            if (isTextNode(node)){
                node.nodeValue = node.textContent.splice(index, 0, TAB_TEXT);
                setCaret(node, index + 1);
            }
            processInput();
        };

        // Returns the next or previous fragment across line boundaries.
        var getFragmentSibling = function(fragment, direction, spanLines) {
            if (isFragment(fragment)) {
                // limit direction value to (-1, 0, 1)
                direction = direction % 2;

                // Nothing to do ...
                if (direction == 0) return fragment;

                // span search for next node to next/previous line by default.
                spanLines = initObject(spanLines, true);

                if (spanLines) {
                    let line = getLine(fragment);
                    let fragments = getFragmentsInLine(line);
                    let index = fragments.indexOf(fragment);

                    if (index === 0 && direction === -1) {
                        let previous = line.previousElementSibling;
                        return previous && getFragmentsInLine(previous).pop();
                    }
                    else if ((index === fragments.length - 1) && direction === 1) {
                        let next = line.nextElementSibling;
                        return next && getFragmentsInLine(next).shift();
                    }
                    else {
                        return fragments[index + direction];
                    }
                }
                else {
                    let parent = fragment.parentNode;
                    let sibling = (direction === 1) ? parent.nextSibling
                                                    : parent.previousSibling;
                    return sibling && sibling.firstChild;
                }
            }
        };

        var processInput = function() {
            let range = getRange();
            let container = range.endContainer;
            if (isTextNode(container)) {
                // Mark unmarked text nodes. This is not strictly required
                // but it helps by pre-empting the burden of doing so later.
                if (isUnmarkedFragment(container)) {
                    splitFragment(container, 0);
                    setCaret(container);
                }
            }
            splitAndDecorate(container);
        };

        var wordTokenizer = function(container) {
            let match;
            let text = container.textContent;
            if ((match = text.match(/(^\u200b{2}(?=.))|(\w+(?=\W)|\W+(?=\w))/))) {
                return match[0].length;
            }
        };

        // Recursively splits a long string into marked fragments.
        var splitAndDecorate = function(container) {
            let splitOffset = wordTokenizer(container);
            if (!isNaN(splitOffset)) {
                let fragment =
                    splitFragment(container, splitOffset, true).pop();
                splitAndDecorate(fragment);
                setCaret(fragment, 1);
                fixCaret();
            }
        };

        var pasteClipboardContent = function(e) {
            let range = getRange();
            if (!range.collapsed) {
                deleteSelection(range);
                range = getRange();
            }

            let pastedContent;
            let startFgmt = range.endContainer;
            let curLine = getLine(startFgmt);

            if (e.clipboardData) {
                pastedContent = (e.originalEvent || e)
                    .clipboardData.getData('text/plain');
            }
            else if (window.clipboardData) {
                pastedContent = window.clipboardData.getData('Text');
            }

            // If the pasted text is too large, do not apply the splitter
            // and proceed to decorate as it will take a long time and the
            // browser may become unresponsive.
            let proceedWithSplit = (pastedContent.length < 10000);

            // Split pasted content into Lines
            let segments = pastedContent.split('\n');

            // If there are multiple lines in the pasted text, breakup the
            // current line at the piont of insertion.
            if (segments.length > 1) {
                processReturnKey(range);
            }

            let fragment = startFgmt;
            for(let i=0; i < segments.length; i++) {
                let segment = segments[i];

                // DO NOT REMOVE
                // Chunks large segments for performance. Keep this code in
                // place for future use.
                //
                // if (segment.length > 1024) {
                //     let subSegments = segment.match(/(.|[\r\n]){1,1024}/g);
                //     segments[i] = subSegments.shift();
                //     for (let j=0, sub; (sub = subSegments[j]); j++) {
                //         segments.splice(i+j, 0, sub);
                //     }
                // }

                if (segment.length > 0) {
                    let pastedFragment = markFragment(createTextNode(segment));
                    appendNode(pastedFragment.parentNode, fragment.parentNode);

                    // If the line was empty before, it is highly possible that
                    // we appended to a pilot node. Remove it if so.
                    // if (isBlankNode(fragment)) {
                    //     removeNode(fragment.parentNode);
                    // }

                    // Pasting content creates one large fragment. Break this up
                    // based on splitter and apply decoration as configured.

                    let index = 1;
                    let content = pastedFragment.textContent;
                    let contentLength = content.length;

                    do  {
                        let splitOffset = splitter_(content.slice(0, index));
                        if (isNaN(splitOffset)) {
                            index += 1;
                        }
                        else {
                            pastedFragment =
                                splitFragment(pastedFragment, splitOffset, true).pop();
                            content = pastedFragment.textContent;
                            contentLength = content.length;
                            index = 1;
                        }
                    } while (index <= contentLength && proceedWithSplit);
                }

                if (segments[i+1] !== null) {
                    curLine = createLine(curLine, {addPilotNode: true});
                    fragment = getFragmentsInLine(curLine).shift();
                }
            }

            //  Make sure that the pasted text remains highlighted.
            setSelection({
                startContainer: startFgmt,
                endContainer: fragment
            });
        };

        var processRightArrowKey = function(range) {
            let content = range.endContainer.textContent;
            return (range.endOffset < content.length &&
                content[range.endOffset] === '\u200b');
        };

        var processLeftArrowKey = function(range) {
            return (range.endOffset == 2 &&
                isEdgeMarker(range.endContainer.parentNode));
        };

        var processReturnKey = function(range, shifted) {
            let container = range.startContainer;
            let offset = range.startOffset;

            fixCaret(range);

            if (range.collapsed && isTextNode(container)) {
                let line = getLine(container);

                if (isEdgeMarker(container)) {
                    return createLine(line, {
                        addPilotNode: true,
                        setCaret: true
                    });
                }

                let newLine;
                if (isEndOfLine(container, offset)) {
                    newLine = createLine(line, {
                        addPilotNode: true,
                        setCaret: true
                    });
                }
                else if (isBeginingOfLine(container, offset)) {
                    newLine = createLine(line, {
                        attachAs: 'previous-sibling',
                        addPilotNode: true,
                        setCaret: false
                    });
                }
                else {
                    let fragment = splitFragment(container, offset)[1];
                    newLine = createLine(line, { addPilotNode: true });

                    let nodes = [];
                    let node = fragment.parentNode;
                    do {
                        nodes.push(node);
                    } while ((node = node.nextSibling));

                    appendChildNodes(nodes, getLineBody(newLine));
                    setCaret(fragment, 0);
                }

                newLine.className = line.className;

                // A common line style is indentation set using CSS margins.
                // Carry this onto the new line.
                setStyle(newLine, line.getAttribute('style'));

                // Shift + Return allows creating new lines without the list
                // numbering while retaining the same indentation and allowing
                // the list to continue as usual in the folllowing lines.
                if (isList(newLine) && shifted) {
                    newLine.dataset.atgListId = '';
                }

                let listType;
                if (isList(line)) {
                    listType = getLineHeader(line).dataset.atgListType;
                }
                generateIndentationIdentifier(newLine, listType);
            }
        };

        var setCaret = function(node, offset) {
            if (node && !isTextNode(node)) {
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
                }
                catch (err) {
                    // Chrome does not like setting an offset of 1
                    // on an empty node.
                }
                resetRange(range);
            }

            // Note that the range object will sometimes be null in Edge and
            // therefore it is safer to call getRange() as opposed to returning
            // 'range'.
            return getRange();
        };

        var setLineIndentPosition = function(line, pos) {
            line.dataset.atgIndentPos = pos;
        };

        var updateListIndentation = function(line, indentType, listType) {
            if (indentType == Indent.CLEAR_LIST && isBlankList(line)) {
                indentType = Indent.DECREASE;
            }

            if (indentType !== Indent.CLEAR_LIST) {
                applyStyle(line,
                    getIndentationInstruction(indentType),
                    [LIST_INDENT_STYLE]);
            }

            let indentPos = parseInt(line.dataset.atgIndentPos);
            if (indentType == Indent.INCREASE) {
                if (indentPos) setLineIndentPosition(line, indentPos + 1);
                else setLineIndentPosition(line, 1);
            }
            else if (indentType == Indent.DECREASE) {
                if (indentPos) setLineIndentPosition(line, indentPos - 1);
            }
            else {
                line.dataset.atgListId = '';
            }
            generateIndentationIdentifier(line, listType);
        };

        var updateIndentation = function(line, indentType) {
            if (isList(line)) updateListIndentation(line, indentType);
            else updateLineIndentation(line, indentType);
        };

        var updateLineIndentation = function(line, indentType) {
            applyStyle(line,
                getIndentationInstruction(indentType),
                [ LINE_INDENT_STYLE ]);
        };

        var getIndentationInstruction = function(indentType) {
            return (indentType == Indent.INCREASE) ? 'atgIncrement'
                                                   : 'atgDecrement';
        };

        var updateIndentationInRange = function(range, indentType) {
            let node = range.startContainer;
            let offset = range.startOffset;
            let isSelection = !range.collapsed;
            let increase = (indentType == Indent.INCREASE);

            if (isSelection) {
                let lines = getLinesInRange(range);
                for(let i = 0, line; (line = lines[i]); i++) {
                    if (isList(line)) {
                        updateListIndentation(line, indentType);
                    }
                    else updateLineIndentation(line, Indent.INCREASE);
                }
            }
            else {
                let line = getLine(node);
                if (isBeginingOfLine(node, offset)) {
                    if (isList(line)) {
                        updateListIndentation(line, indentType);
                    }
                    else {
                        if (increase || isIndented(line)) {
                            updateLineIndentation(line, indentType);
                        }
                        else return false;
                    }
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
            node = (offset == 0) ? getFragmentSibling(node, -1, false) : node;
            return isEdgeFragment(node);
        };

        var isEndOfLine = function(node, offset) {
            return isFragment(node) &&
                (offset == node.textContent.length) &&
                !getFragmentSibling(node, 1, false);
        };

        var deleteLine = function(line) {
            let previousLine = line.previousElementSibling;
            let lineBody = getLineBody(line);

            if (isLine(previousLine)) {
                let prevLineBody = getLineBody(previousLine);
                let caretNode = prevLineBody.lastChild;

                let nodes = getChildren(lineBody);

                // Remove the edge marker node from the list
                nodes.shift();

                appendChildNodes(nodes, prevLineBody);

                setTimeout(function(){
                    removeNode(line);
                    setCaret(caretNode.firstChild);
                    // Set the  focus and click to ensure that the soft
                    // keyboard does not hide.
                    caretNode.focus();
                    caretNode.click();
                }, 0);
            }
            else { renewLineBody(lineBody, true); }
        };

        var deleteSelection = function(range) {
            let fragments = createMarkedFragmentsInRange(range);
            let nextFragment = getFragmentSibling(fragments[0], -1) ||
                getFragmentSibling(fragments[fragments.length - 1], 1);

            for (let i=0, node; (node = fragments[i]); i++) {
                if (isMarkedFragment(node)) node = node.parentNode;
                removeNode(node);
            }

            if (nextFragment) { setCaret(nextFragment); }

            removeNodesInList(getLinesInRange(range), function(line) {
                return isBlankNode(line) || isBlankNode(getLineBody(line));
            });

            // ..just in case all lines were deleted, including the line on
            // which we set the caret.
            initializeEditor();
        };

        var clearNodeStyle = function(node, force) {
            if (force || !node.getAttribute('style')) {
                node.removeAttribute('style');
            }
        };

        var splitFragment = function(fragment, offset, decorate) {
            offset = initObject(offset, 0);
            let firstFgmt, secondFgmt;
            let fragments = getFragmentsInLine(getLine(fragment));
            let fragmentIndex = fragments.indexOf(fragment);

            if (isTextNode(fragment)) {
                if (offset == 0) {
                    firstFgmt = markFragment(fragments[fragmentIndex - 1]);
                    secondFgmt = markFragment(fragment);
                }
                else if (offset == fragment.length) {
                    firstFgmt = markFragment(fragment);
                    secondFgmt = markFragment(fragments[fragmentIndex + 1]);
                }
                else {
                    firstFgmt = markFragment(fragment);
                    secondFgmt = fragment.splitText(offset);
                    markFragment(removeNode(secondFgmt), null,
                        firstFgmt.parentNode.getAttribute('style'));
                    appendNode(secondFgmt.parentNode,
                        firstFgmt.parentNode);
                }
            }

            if (decorate) {
                decorator_([firstFgmt, secondFgmt]);
            }
            return [firstFgmt, secondFgmt];
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
                let startFgmt = splitFragment(startContainer, startOffset)[1];

                let endFgmt;
                if (startContainer.isSameNode(endContainer)) {
                    endOffset = endOffset - startOffset;
                    endContainer = startFgmt;

                    if (startContainer.length == endOffset) {
                        endFgmt = startFgmt;
                    }
                }

                // Now split the end Text node if the first fragment does not
                // already include the content.
                if (!endFgmt) {
                    endFgmt = splitFragment(endContainer, endOffset)[0];
                }

                // Rebuild original selection range for further processing.
                let newRange = setSelection({
                    startContainer: startFgmt,
                    startOffset: 0,
                    endContainer: endFgmt,
                    endOffset: endOffset
                });

                // Now return all tghe fragments.
                fragments =  getFragmentsInRange(newRange);
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
        });

        editor.addEventListener('click', function(e) {
            hideSubmenus();
            initializeEditor();
            fixCaret();
        });

        editor.addEventListener('focus', function(e) {
            hideSubmenus();
        });

        editor.addEventListener('input', function(e) {
            // This seems to be the only way to capture the delete key
            // event in Chrome on Android and stop the browser from proceeding
            // with deleeting the empty fragment nodes. Note that we are opting
            // to fix dom inconsistancies post delete.
            if (e.inputType == 'deleteContentBackward' || isDeleteKey(keyCode_)) {

                // Remove unwanted break nodes inserted by browsers,
                // especially Firefox.
                removeNodesInList(editor.querySelectorAll('br'));

                let range = getRange();
                let container = range.endContainer;
                let marker = container.parentNode;
                let line = getActiveLine();

                // If the caret is on the line marker, it means that the user
                // has already deleted the first zero width character without
                // the curosor moving, indicating that we should now dcelete the
                // current line.
                if (isEdgeMarker(marker) && range.endOffset == 1) {
                    resetEdgeMarker(line);
                    setCaret(marker.firstChild);
                    if (isList(line)) {
                        updateListIndentation(line, Indent.CLEAR_LIST);
                    }
                    else if (isIndented(line)) {
                        updateLineIndentation(line, Indent.DECREASE);
                    }
                    else {
                        deleteLine(line);
                    }
                    e.preventDefault();
                }

                // Deletion leaves empty marked fragments oin Firefox.
                // Remove the blank node and move the cursor up.
                else if (range.endOffset == 0 && isMarker(container)) {
                    setCaret(container.previousSibling.firstChild);
                    removeNode(container);
                }
                else {
                    let lineBody = getLineBody(line);

                    if (isBlankLine(lineBody)) {
                        renewLineBody(lineBody);
                    }
                    else if (getLineHeader(line) && lineBody == null){
                        createLineBody(line, { addPilotNode: true });
                    }
                    else {
                        initializeEditor();
                    }
                }
            }
            else {
                processInput();
            }
        });

        // Start handling events.
        editor.addEventListener('keydown', function(e) {
            keyCode_ = getKeyCode(e);

            if (!isDeleteKey(keyCode_)) {
                fixCaret();
            }

            // Get the latest and greatest range since we cannot rely on
            // any buffered selection range (savedRange_).
            let range = getRange();

            if (range) {
                if (isDeleteKey(keyCode_)) {
                    // Processed under the event 'input'
                }
                else if (isTabKey(keyCode_)) {
                    updateIndentationInRange(range,
                        e.shiftKey ? Indent.DECREASE : Indent.INCREASE);
                    e.preventDefault();
                }
                else if (isReturnKey(keyCode_)) {
                    if (!ignoreReturnKey_) {
                        processReturnKey(range, e.shiftKey);
                    }
                    e.preventDefault();
                }
                else if (e.metaKey && isFormatKey(keyCode_)) {
                    formatSelection({ atgToggle: StyleKeyMap[keyCode_] });
                    e.preventDefault();
                }
                else if (isRightArrowKey(keyCode_)) {
                    if (processRightArrowKey(range)) e.preventDefault();
                }
                else if (isLeftArrowKey(keyCode_)) {
                    if (processLeftArrowKey(range)) e.preventDefault();
                }
                else {
                    savedNode_ = getRange().endContainer;

                    // Uncomment to handle up/down keys manually. Note that
                    // the manual intervention is required for IE/Edge
                    // browsers because the cursor does not respond when the
                    // text spans multiple lines.
                    //
                    // if (isUpArrowKey(keyCode_) || isDownArrowKey(keyCode_)) {
                    //     e.preventDefault();
                    // }
                }
            }
        });

        var getEdgeMarker = function(fragment) {
            let marker = fragment.parentNode;
            let next;
            while((next = marker.previousSibling) &&
                    next.offsetLeft <= marker.offsetLeft) {
                marker = next;
            }
            return marker;
        };

        var getFragmentOffsetPosition = function(fragment, offset) {
            let marker = fragment.parentNode;
            let rect = marker.getBoundingClientRect();
            let charWidth = (rect.right - rect.left) / marker.textContent.length;
            return rect.left + charWidth * offset;
        };

        var getFragmentAndOffsetAtPosition = function(line, position, direction) {
            direction = initObject(direction, Direction.START_TO_END);
            let lineBody = getLineBody(line);

            let marker =
                (direction == Direction.START_TO_END) ?
                    lineBody.firstChild :
                        getEdgeMarker(lineBody.lastChild.firstChild);

            let nextMarker = marker;
            do {
                let rect = nextMarker.getBoundingClientRect();
                if (rect.right > position) {
                    let charWidth =
                        (rect.right - rect.left) / nextMarker.textContent.length;
                    let offset = Math.round((position - rect.left) / charWidth);
                    return [nextMarker.firstChild, offset];
                }
                marker = nextMarker;
            } while((nextMarker = nextMarker.nextSibling));

            return [marker.firstChild, marker.textContent.length];
        };

        editor.addEventListener('keyup', function(e) {
            let range = getRange();
            let container = range.endContainer;

            // Darn IE does not move the cursor across lines.
            // The code below calculates the approximate column
            // at which to place the caret in such an event.
            if (container.isSameNode(savedNode_)) {
                let line = getLine(container);
                let targetLine =
                    (isUpArrowKey(keyCode_) && line.previousSibling) ||
                    (isDownArrowKey(keyCode_) && line.nextSibling) || null;

                if (targetLine) {
                    let direction = isUpArrowKey(keyCode_) ?
                            Direction.END_TO_START :
                                isDownArrowKey(keyCode_) ?
                                    Direction.START_TO_END :
                                        Direction.END_TO_START;

                    let position =
                        getFragmentOffsetPosition(container, range.endOffset);
                    let fgmtInfo = getFragmentAndOffsetAtPosition(
                        targetLine, position, direction);

                    setCaret(fgmtInfo[0], fgmtInfo[1]);
                }
            }
        });

        editor.addEventListener('copy', function(e) {
        });

        editor.addEventListener('paste', function(e) {
            pasteClipboardContent(e);
            e.preventDefault();
        });

        document.addEventListener('selectionchange', function(e) {
            doAfterSelection_(getMarkedFragmentsInRange(savedRange_));
        });

        return {
            attachMenubar: function(menubar) {
                if (menubar) {
                    editorMenubar_ = menubar;
                    editorMenubar_.addEventListener('mousedown', function(e) {
                        savedRange_ = getRange();
                        hideSubmenus();

                        let target = e.target;
                        let menu = getParentMenu(target);

                        if (!menu) return;
                        let submenu =
                            menu.querySelector('.' + SUBMENU_CNAME);

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

                    editorMenubar_.addEventListener('mouseup', function(e) {
                        resetRange(savedRange_);
                    });
                }
            }
        };
    };
}());
