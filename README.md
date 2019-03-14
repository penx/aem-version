#  AEM component versioning

A Rhino script for AEM to make a component 'versionable' - i.e. to change the JCR structure of a previously published component and to run defined update tasks on old instances of the component.

Authored May 2015 by Alasdair McLeay.

---

## Making a component versionable

1. In the component's template, add a root property called 'version':

        <jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0" xmlns:nt="http://www.jcp.org/jcr/nt/1.0"
            jcr:primaryType="nt:unstructured"
            version="1">

    If you need to use a property name other than 'version', you can change this in the version settings (see below). This property should be an integer, starting at 1 for the first time a component is versioned and incrementing whenever there are template changes or updates needed.

2. Add the prerequisite to the component's use function:

        use(['aem-version/version.js'], function(versionUtil) { ...

3. Add the following to the start of the component's js:

        versionUtil.init({
            addMissingNodesAndProperties: false,        //defaults to false
            runVersionUpdateScripts: true,              //defaults to false
            templateVersionKey: 'version',              //not required, defaults to 'version'
            updateScriptLocation: '/version/updates/'   //not required, defaults to '/version/updates/'
        });

'addMissingNodesAndProperties' is a quick way of adding versioning without requiring much configuration.

'runVersionUpdateScripts' is a more advanced cases where e.g. you need to move or check for the existance of certain nodes.

Both can be used if needed, but scripts are run first so that nodes can be moved first before they are created via the template.

## Version update scripts

Scripted updates are performed via a JSON confuration file. By default they should be stored in '/version/updates/' in the component folder (/apps/*/components/*/version/updates). This path can be configured using the updateScriptLocation setting.

See 1.json for an example. Updates is an array of update objects. Each update object must contain an operation property to determine the operation type.

Current operations are as follows:

### ifExists
#### at
Checks for the existence of a node at this path, relative to the component.
#### ifUpdates (optional)
If it exists, runs these updates.
#### elseUpdates (optional)
If it doesn't exist, runs these updates.

### ifPropertyExists
#### at (optional)
Checks for the existence of a property on a node at this path, relative to the component. Defaults to the component's root node.
#### property
The name of the property to look for.
#### ifUpdates (optional)
If it exists, runs these updates.
#### elseUpdates (optional)
If it doesn't exist, runs these updates.

### ifPropertyEquals
#### at (optional)
Checks for the existence and equality of a property on a node at this path, relative to the component. Defaults to the component's root node.
#### property
The name of the property to look for.
#### val
The (string) value that the the property should equal.
#### ifUpdates (optional)
If it exists and the property matches, runs these updates.
#### elseUpdates (optional)
If it doesn't exist or the property doesn't match, runs these updates.

### moveNode
#### from
The path to a node that should be moved, relative to the current node of the resource.
#### to
The path that the node should be moved to, relative to the current node of the resource.
#### overwrite (optional)
Set to true if you want to overide any node currently at the 'to' location. Defaults to false.

### copyProperty
Copy the value of a property from one node to another node and property.
#### fromProperty
The property name to copy from.
#### fromNode (optional)
A relative path to the node that the property should be copied from. Defaults to the root node of the component instance.
#### toNode (optional)
A relative path to the node that the property should be copied to. Defaults to the root node of the component instance.
#### toProperty
The property name on the new node, where the value will be copied to.

### removeNode
Removes the node at the given location.
#### at
Relative path to the node to remove.

### removeProperty (not working, awaiting Java implementation)
Remove a property at a given location.
#### at
The node to alter.
#### property
The property to remove.

### addNode
#### at
The path to a node that should be added, relative to the current node of the resource.
#### jcr:primaryType (optional)
The primary type needs to be specified when a node is created. Defaults to nt:unstructured.
### properties
A key/value object of properties to add, other than jcr:primaryType.

### setProperties
#### at
The path to a node that should be modified, relative to the current node of the resource.
#### properties
An object of key-value pairs representing the properties that should be added to the node.
