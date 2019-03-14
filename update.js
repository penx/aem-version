/* globals use, java, Packages */
use(['./toStringArray.js'], function(toStringArray) {
    'use strict';
    var node, currentJcrSession;

    /**
     * runs a set of updates on a given node using a given session
     * @param  {Array} updatesArr
     * @param  {javax.jcr.Node} onNode
     * @param  {javax.jcr.Session} jcrSession
     */
    function run(updatesArr, onNode, jcrSession) {
        node = onNode;
        currentJcrSession = jcrSession;
        updates(updatesArr);
    }

    /**
     * runs an array of updates
     * @param  {Array} updatesArr
     */
    function updates(updatesArr) {
        for (var i = 0; i < updatesArr.length; i++) {
            update(updatesArr[i]);
        }
    }

    /**
     * runs an update
     * @param  {Object} updateObj
     */
    function update(updateObj) {
        var fn = api[updateObj.operation];
        if (fn) {
            fn(updateObj, node);
        } else {
            console.warn('Version update script type not found: ' + updateObj.operation);
        }
    }

    /**
     * if the current node has a child specified at updateObj.at then run updateObj.ifUpdates else run updateObj.elseUpdates
     * @param  {Object} updateObj
     */
    function ifExists(updateObj) {
        if (node.hasNode(updateObj.at)) {
            if (updateObj.ifUpdates) {
                updates(updateObj.ifUpdates);
            }
        } else if (updateObj.elseUpdates) {
            updates(updateObj.elseUpdates);
        }
    }

    /**
     * if a property exists on a given node then run updateObj.ifUpdates else run updateObj.elseUpdates
     * @param  {Object} updateObj
     */
    function ifPropertyExists(updateObj) {
        var nodeToCheck;

        if (updateObj.at) {
            if (node.hasNode(updateObj.at)) {
                nodeToCheck = node.getNode(updateObj.at);
            } else {
                updates(updateObj.elseUpdates);
            }
        } else {
            nodeToCheck = node;
        }
        if (nodeToCheck.hasProperty(updateObj.property)) {
            if (updateObj.ifUpdates) {
                updates(updateObj.ifUpdates);
            }
        } else if (updateObj.elseUpdates) {
            updates(updateObj.elseUpdates);
        }
    }

    /**
     * if a property exists on a given node and equals a given value then run updateObj.ifUpdates else run updateObj.elseUpdates
     * TODO: only supports strings at the moment, extend to support booleans and other types
     * @param  {Object} updateObj
     */
    function ifPropertyEquals(updateObj) {
        var nodeToCheck;

        if (updateObj.at) {
            if (node.hasNode(updateObj.at)) {
                nodeToCheck = node.getNode(updateObj.at);
            } else {
                updates(updateObj.elseUpdates);
            }
        } else {
            nodeToCheck = node;
        }

        if (nodeToCheck.hasProperty(updateObj.property) && nodeToCheck.getProperty(updateObj.property).getValue().getString().equals(updateObj.val)) {
            if (updateObj.ifUpdates) {
                updates(updateObj.ifUpdates);
            }
        } else if (updateObj.elseUpdates) {
            updates(updateObj.elseUpdates);
        }
    }



    /**
     * adds a node at updateObj.at with an optional type given by updateObj['jcr:primaryType']
     * @param  {Object} updateObj
     */
    function addNode(updateObj) {
        var type, newnode;
        if (updateObj['jcr:primaryType']) {
            type = updateObj['jcr:primaryType'];
            newnode = node.addNode(updateObj.at, type);
        } else {
            newnode = node.addNode(updateObj.at);
        }

        if (updateObj.properties) {
            setProperties(updateObj);
        }
    }

    /**
     * move a node from updateObj.from to updateObj.to and overrwite only if updateObj.overwrite is set to true
     * @param  {Object} updateObj
     */
    function moveNode(updateObj) {
        var from = node.getPath() + '/' + updateObj.from,
            to = node.getPath() + '/' + updateObj.to;
        if (!updateObj.overwrite && node.hasNode(updateObj.to)) {
            console.warn('Node already exists, not moving: ' + to);
        } else {
            currentJcrSession.move(from, to);
        }
    }

    /**
     * Copy the value of a property (updateObj.fromProperty) from one node (updateObj.fromNode) to another node (updateObj.toNode) and property (updateObj.toProperty)
     * @param  {Object} updateObj
     */
    function copyProperty(updateObj) {
        var nodeFrom,
            nodeTo,
            propVal;

        if (updateObj.fromNode) {
            nodeFrom = node.getNode(updateObj.fromNode);
        } else {
            nodeFrom = node;
        }

        if (updateObj.toNode) {
            nodeTo = node.getNode(updateObj.toNode);
        } else {
            nodeTo = node;
        }

        if (nodeFrom.hasProperty(updateObj.fromProperty)) {
            propVal = nodeFrom.getProperty(updateObj.fromProperty).getValue();
            nodeTo.setProperty(updateObj.toProperty, propVal);
        }
        //TODO: what should we do if the property to copy from doesn't exist? Just ignoring for now, as can't get delete to work with Rhino
    }

    /**
     * Remove a node at a given location
     * @param  {Object} updateObj
     */
    function removeNode(updateObj) {
        if (node.hasNode(updateObj.at)) {
            node.getNode(updateObj.at).remove();
        }
    }

    /**
     * Remove a property at a given location
     * @param  {Object} updateObj
     */
    function removeProperty(updateObj) {
        //TODO: revist this as it currently doesn't work - Rhino can't figure out which function to call
        if (updateObj.at) {
            node.getNode(updateObj.at).setProperty(updateObj.property, Packages.java.lang.String.valueOf(null));
        } else {
            node.setProperty(updateObj.property, Packages.java.lang.String.valueOf(null));
        }
    }

    /**
     * sets an array of properties, specified by updateObj.properties, on a node, specified by updateProperties.at
     * @param  {Object} updateObj
     */
    function setProperties(updateObj) {
        var keys = Object.keys(updateObj.properties),
            nodeToUpdate;

        if (updateObj.at) {
            nodeToUpdate = node.getNode(updateObj.at);
        } else {
            nodeToUpdate = node;
        }

        for (var i = 0, l = keys.length; i < l; i++) {
            var key = keys[i],
                value = updateObj.properties[key];

            if (value instanceof Array) {
                nodeToUpdate.setProperty(key, toStringArray(value), Packages.javax.jcr.PropertyType.STRING);
            } else if (value instanceof Boolean) {
                value = value === true ? java.lang.Boolean.TRUE.booleanValue() : java.lang.Boolean.FALSE.booleanValue();
                nodeToUpdate.setProperty(key, value, Packages.javax.jcr.PropertyType.BOOLEAN);
            } else {
                nodeToUpdate.setProperty(key, value);
            }
        }
    }


    /**
     * a set of functions that can be accessed via JSON configuration scripts
     * @type {Object}
     */
    var api = {
        ifExists: ifExists,
        ifPropertyExists: ifPropertyExists,
        ifPropertyEquals: ifPropertyEquals,
        addNode: addNode,
        moveNode: moveNode,
        setProperties: setProperties,
        copyProperty: copyProperty,
        removeNode: removeNode,
        removeProperty: removeProperty
    };

    return {
        run: run
    };
});
