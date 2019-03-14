/* globals use, wcmmode, properties, component, Packages, currentNode, resource */
use(['./templateProperties.js', './update.js'], function(templateUtil, updateUtil) {
    'use strict';

    var templateValueMap,
        templateResource,           //org.apache.sling.api.resource.Resource            http://docs.adobe.com/docs/en/aem/6-0/develop/ref/javadoc/org/apache/sling/api/resource/Resource.html
        resourceResolver,           //org.apache.sling.api.resource.ResourceResolver    http://docs.adobe.com/docs/en/aem/6-0/develop/ref/javadoc/org/apache/sling/api/resource/ResourceResolver.html
        currentJcrSession,          //javax.jcr.Session                                 http://www.day.com/specs/jsr170/javadocs/jcr-2.0/javax/jcr/Session.html
        lockManager,                //javax.jcr.lock.LockManager                        http://www.day.com/specs/jsr170/javadocs/jcr-2.0/javax/jcr/lock/LockManager.html
        templateVersionKey = 'version',
        lockableType = 'mix:lockable',
        updateScriptLocation = '/version/updates/';

    /**
     * Loads the cq:template node for the current resource from the apps directory in to private variables
     */
    function loadTemplate() {
        templateResource = templateUtil.get();
        templateValueMap = templateResource.adaptTo(Packages.java.util.Map);
    }

    /**
     * loads the given settings object and overrides default settings
     * current allows templateVersionKey and updateScriptLocation to be specified
     * @param  {Object} settings Settings passed through when initialised the utility
     */
    function loadSettings(settings) {
        if (settings.templateVersionKey) {
            templateVersionKey = settings.templateVersionKey;
        }
        if (settings.updateScriptLocation) {
            updateScriptLocation = settings.updateScriptLocation;
        }
    }

    /**
     * gets the version number of the cq:template
     * @return {number} template version
     */
    function getTemplateVersion() {
        // gets the version number for the current template
        return parseInt(templateValueMap.get(templateVersionKey), 10) || 0;
    }

    /**
     * gets the version number of the current content resource
     * @return {number} content resource version
     */
    function getInstanceVersion() {
        // gets the version number for the current instance
        return parseInt(properties.get(templateVersionKey, 0), 10) || 0;
    }

    /**
     * determines if the cq:template version number is newer than the content resource version number
     * @return {boolean} true if cq:template version number is newer than the content resource version number, otherwise false
     */
    function templateIsNewer() {
        // checks if the component instance requires a template update
        var instanceVersion = getInstanceVersion(),
            templateVersion = getTemplateVersion();
        return instanceVersion < templateVersion;
    }

    /**
     * Determines whether version updating is enabled (currently enabled when in edit mode)
     * @return {boolean} true if version updating is enabled
     */
    function versionUpdatingEnabled() {
        // determines whether we should perform a version check
        return wcmmode.edit;
    }

    /**
     * Looks for update scripts (JSON config files) in the component and runs them in turn from current version up to newest version
     */
    function runVersionUpdateScripts() {
        //read in JSON file from getInstanceTemplateVersion to getTemplateVersion
        var currentVersion = getInstanceVersion(),
            upgradeToVersion = getTemplateVersion();

        for (var scriptVersion = currentVersion + 1; scriptVersion <= upgradeToVersion; scriptVersion++) {
            var updateScriptResource = getResourceForUpdateScript(scriptVersion);
            if (updateScriptResource) {
                runUpdateScript(updateScriptResource);
            }
        }
    }

    /**
     * gets the resource for the update script for the given version number
     * @param  {number} version version number of resource script to get
     * @return {org.apache.sling.api.resource.Resource} update script resource
     */
    function getResourceForUpdateScript(version) {
        return resourceResolver.getResource(getPathForUpdateScript(version));
    }

    /**
     * runs the given update script
     * @param  {org.apache.sling.api.resource.Resource} scriptResource resource for the JSON update script
     */
    function runUpdateScript(scriptResource) {
        var jsonRaw = Packages.org.apache.commons.io.IOUtils.toString(scriptResource.adaptTo(Packages.java.io.InputStream)),
            script = JSON.parse(jsonRaw);

        updateUtil.run(script.updates, currentNode, currentJcrSession);
    }

    /**
     * gets the path in the JCR for an update script for a given version
     * @param  {number} version version number
     * @return {string} path
     */
    function getPathForUpdateScript(version) {
        return component.getPath() + updateScriptLocation + version + '.json';
    }

    /**
     * Recursively adds missing nodes and properties from the given fromResource to the given toNode.
     * We need an iterator for the from, so use a resource type.
     * We need to write properties and add children, so using a node type.
     * @param {org.apache.sling.api.resource.Resource} fromResource resource to copy from
     * @param {javax.jcr.Node} toNode node to copy to
     */
    function addMissingNodesAndProperties(fromResource, toNode) {
        var fromValueMap = fromResource.adaptTo(Packages.java.util.Map),
            fromPropertyArray = fromValueMap.keySet().toArray();

        for (var i = 0, l = fromPropertyArray.length; i < l; i++) {
            var key = fromPropertyArray[i];
            if (!toNode.hasProperty(key)) {
                toNode.setProperty(key, fromValueMap.get(key));
            }
        }
        var childIterator = resourceResolver.listChildren(fromResource);
        while (childIterator.hasNext()) {
            var child = childIterator.next(),
                childNode = child.adaptTo(Packages.javax.jcr.Node),
                childName = childNode.getName();
            if (toNode.hasNode(childName)) {
                addMissingNodesAndProperties(child, toNode.getNode(childName));
            } else {
                var newChildNode = toNode.addNode(childName);
                addMissingNodesAndProperties(child, newChildNode);
            }
        }
    }

    /**
     * updates the version number of the current content resource to the latest version given in the cq:template
     */
    function updateVersionNumber() {
        currentNode.setProperty(templateVersionKey, getTemplateVersion());
    }

    /**
     * loads the resource resolver from the current resource and store in a private variable
     */
    function loadResourceResolver() {
        resourceResolver = resource.getResourceResolver();
    }

    /**
     * loads the session from the current node and stores it in a private variable
     */
    function loadJcrSession() {
        currentJcrSession = currentNode.getSession();
    }

    /**
     * loads a lock manager from the current session and stores in a private variable
     */
    function loadLockManager() {
        lockManager = currentJcrSession.getWorkspace().getLockManager();
    }

    /**
     * Attempts to get a lock on a given node
     * @param  {javax.jcr.Node} node Node to get a lock on
     * @return {boolean} true if a lock has been received, otherwise false
     */
    function getLockOnNode(node) {
        if (!node.isNodeType(lockableType)) {
            if (node.canAddMixin(lockableType)) {
                node.addMixin(lockableType);
                // commit required to get lock
                // http://www.day.com/specs/jcr/2.0/17_Locking.html
                commit();
            } else {
                console.warn('Unable to get lock during component update - can\'t make node lockable');
                return false;
            }
        }
        if (!node.isLocked()) {
            var lockPath = currentNode.getPath();
            try {
                lockManager.lock(lockPath, false, false, Packages.java.lang.Long.MAX_VALUE, 'md - component versioning');
                return true;
            } catch (ex) {
                // TODO: I can't find any documentation on getting Rhino to catch specific Java exceptions - need to look in to this more and only catch LockException
                console.warn('Node was reported lockable but received exception when trying to get lock - probably due to multiple threads: ' + ex.message);
                return false;
            }
        } else {
            console.warn('Unable to get lock during component update - Node is already locked');
            return false;
        }
    }

    /**
     * Releases a lock on the given node
     * @param  {javax.jcr.Node} node the node to release
     */
    function releaseLockOnNode(node) {
        lockManager.unlock(node.getPath());
    }

    /**
     * Commit all changes to the JCR
     */
    function commit() {
        resourceResolver.commit();
    }

    return {
        /**
         * Main entry point for utility
         * @param  {Object} settings an Object containing the following settings
         *   addMissingNodesAndProperties - defaults to false
         *   runVersionUpdateScripts: - defaults to false
         *   templateVersionKey: - not required, defaults to 'version'
         *   updateScriptLocation: - not required, defaults to '/version/updates/'
         */
        init: function(settings) {
            if (versionUpdatingEnabled()) {
                loadSettings(settings);
                loadTemplate();
                if (templateIsNewer()) {
                    // We need to perform write actions, attempt to get a lock on the node and only make writes if we get a lock - otherwise multiple threads will try to write to the node at once
                    // (this is aparent in the author mode, as the component is loaded twice in quick succession for reasons unknown)
                    loadJcrSession();
                    loadResourceResolver();
                    loadLockManager();
                    //TODO: what would happen when a versioned component contains another versioned component, and the template contains new nodes on the contained component?
                    if (!getLockOnNode(currentNode)) {
                        return;
                    }
                    try {
                        // runVersionUpdateScripts - happens first so that nodes can be moved before creating templated nodes
                        if (settings.runVersionUpdateScripts) {
                            runVersionUpdateScripts();
                        }
                        if (settings.addMissingNodesAndProperties) {
                            addMissingNodesAndProperties(templateResource, currentNode);
                        }
                        // If custom scripts are needed after updating missing props, this should be added as a seperate feature - I can't think of a use case so not adding
                        updateVersionNumber();
                        commit();
                    } finally {
                        releaseLockOnNode(currentNode);
                    }
                }
            }
        }
    };
});
