Rye.define('Query', function(){

    var util = Rye.require('Util')
      , _slice = Array.prototype.slice
      , selectorRE = /^([.#]?)([\w\-]+)$/
      , selectorType = {
            '.': 'getElementsByClassName'
          , '#': 'getElementById'
          , '' : 'getElementsByTagName'
          , '_': 'querySelectorAll'
        }
      , dummyDiv = document.createElement('div')

    function matches(element, selector) {
        var matchesSelector, match
        if (!element || !util.isElement(element) || !selector) {
            return false
        }

        if (selector.nodeType) {
            return element === selector
        }

        if (selector instanceof Rye) {
            return selector.elements.some(function(selector){
                return matches(element, selector)
            })
        }

        if (element === document) {
            return false
        }

        matchesSelector = util.prefix('matchesSelector', dummyDiv)
        if (matchesSelector) {
            return matchesSelector.call(element, selector)
        }

        // fall back to performing a selector:
        if (!element.parentNode) {
            dummyDiv.appendChild(element)
        }
        match = qsa(element.parentNode, selector).indexOf(element) >= 0
        if (element.parentNode === dummyDiv) {
            dummyDiv.removeChild(element)
        }
        return match
    }

    function qsa (element, selector) {
        var method
        
        element = element || document

        // http://jsperf.com/getelementbyid-vs-queryselector/11
        if (!selector.match(selectorRE) || (RegExp.$1 === '#' && context !== document)) {
            method = selectorType._
        } else {
            method = selectorType[RegExp.$1]
            selector = RegExp.$2
        }

        var result = element[method](selector)

        if (util.isNodeList(result)){
            return _slice.call(result)
        }

        if (util.isElement(result)){
            return [result]
        }

        return []
    }

    // Walks the DOM tree using `method`, returns
    // when an element node is found
    function getClosestNode(element, method, selector){
        do {
            element = element[method]
        } while (element && ((selector && !matches(element, selector)) || !util.isElement(element)))
        return element
    }

    return {
        matches        : matches
      , qsa            : qsa
      , getClosestNode : getClosestNode
    }

})

Rye.implement(function(exports){

    var util = Rye.require('Util')
      , query = Rye.require('Query')
      , _slice = Array.prototype.slice

    // Creates a new Rye instance applying a filter if necessary
    function create(elements, selector) {
        return selector == null ? new Rye(elements) : new Rye(elements).filter(selector)
    }

    exports.qsa = query.qsa

    exports.find = function(selector) {
        var elements
        if (this.length === 1) {
            elements = query.qsa(this.elements[0], selector)
        } else {
            elements = this.elements.reduce(function(elements, element){
                return elements.concat(query.qsa(element, selector))
            }, [])
        }
        return create(elements)
    }

    exports.filter = function(selector, inverse){
        if (typeof selector === 'function') {
            var fn = selector
            return create(this.elements.filter(function(element, index){
                return fn.call(element, element, index) == !inverse
            }))
        }
        return create(this.elements.filter(function(element){
            return query.matches(element, selector) == !inverse
        }))
    }

    exports.has = function(selector){
        var matches
        return create(this.elements.reduce(function(elements, element){
            matches = query.qsa(element, selector)
            return elements.concat(matches.length ? element : null)
        }, []))
    }

    exports.is = function(selector){
        return this.length > 0 && this.filter(selector).length > 0
    }

    exports.not = function(selector){
        return this.filter(selector, true)
    }

    exports.add = function(selector, context){
        var elements = selector
        if (typeof selector === 'string') {
            elements = new Rye(selector, context).elements
        }
        return this.concat(elements)
    }

    // Extract a list with the provided property for each value.
    // This works like underscore's pluck, with the added
    // getClosestNode() method to avoid picking up non-html nodes.
    exports.pluckNode = function(property){
        return this.map(function(element){
            return query.getClosestNode(element, property)
        })
    }

    exports.pluck = function(property){
        return util.pluck(this.elements, property)
    }

    exports.next = function(){
        return create(this.pluckNode('nextSibling'))
    }

    exports.prev = function(){
        return create(this.pluckNode('previousSibling'))
    }

    exports.first = function(){
        return create(this.get(0))
    }

    exports.last = function(){
        return create(this.get(-1))
    }

    exports.siblings = function(selector){
        var siblings = []
        this.each(function(element){
            _slice.call(element.parentNode.childNodes).forEach(function(child){
                if (util.isElement(child) && child !== element){
                    siblings.push(child)
                }
            })
        })
        return create(siblings, selector)
    }

    exports.parent = function(selector){
        return create(this.pluck('parentNode'), selector)
    }

    // borrow from zepto
    exports.parents = function(selector){
        var ancestors = []
          , elements = this.elements

        while (elements.length > 0 && elements[0] !== undefined) {
            elements = elements.map(function(element){
                if ((element = element.parentNode) && element !== document && ancestors.indexOf(element) < 0) {
                    ancestors.push(element)
                    return element
                }
            })
        }
        return create(ancestors, selector)
    }

    exports.closest = function (selector) {
        return this.map(function(element){
            if (query.matches(element, selector)) {
                return element
            }
            return query.getClosestNode(element, 'parentNode', selector)
        })
    }

    exports.children = function(selector){
        return create(this.elements.reduce(function(elements, element){
            var childrens = _slice.call(element.children)
            return elements.concat(childrens)
        }, []), selector)
    }

})