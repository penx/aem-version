/* globals use, java */
// jscs:disable
use(function () {
    'use strict';

    return function(srcArr) {
        var arr = java.lang.reflect.Array.newInstance(java.lang.String, srcArr.length);

        for (var i = 0; i < srcArr.length; i++) {
            arr[i] = srcArr[i];
        }

        return arr;
    };
});
