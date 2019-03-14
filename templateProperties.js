/* globals use, component, Packages */
/**
 * Warning - this won't work on the publish server when logged in as an anonymous user, so please ensure your code only relies upon access to template properties on author.
 *
 * An alternative solution is to have a Java utility to get the properties you need using a service running as an authorised user.
 */
use(function() {
    'use strict';
    return {
        get: function(relativePath) {
            var path = component.getTemplatePath();
            if (relativePath) {
                path += '/' + relativePath;
            }
            return component.adaptTo(Packages.org.apache.sling.api.resource.Resource).getResourceResolver().resolve(path);
        }
    };
});
