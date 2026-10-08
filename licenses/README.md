# Third-party licenses

These notices cover the production dependency tree used to build Set Points story-page extraction. This directory covers all 16 installed production package instances in package-lock.json, including both versions of entities. Development and test packages are excluded.

License files were copied without modification from the installed npm packages, except boolbase 1.0.0: its npm archive declares ISC but omits the license file, so the original upstream [ISC license](https://github.com/fb55/boolbase/blob/be0bcd8a4e917a0a5895e95b523fbbed05a64871/LICENSE) is included. Readability source copyright and attribution comments are additionally preserved verbatim in SOURCE-NOTICES.txt; that file is an extracted source notice, not an upstream NOTICE file.

The [package inventory](packages.json) records package paths, versions, license declarations, repository URLs, npm archive URLs, archive integrity values, and copied files. Required dependency traversal was checked from both direct dependencies through the complete installed production tree.

| Package | Version | License | Included files | Source |
| --- | --- | --- | --- | --- |
| @mozilla/readability | 0.6.0 | Apache-2.0 | [LICENSE.md](mozilla-readability-0.6.0/LICENSE.md), [SOURCE-NOTICES.txt](mozilla-readability-0.6.0/SOURCE-NOTICES.txt) | [Repository](https://github.com/mozilla/readability) · [npm archive](https://registry.npmjs.org/@mozilla/readability/-/readability-0.6.0.tgz) |
| boolbase | 1.0.0 | ISC | [LICENSE](boolbase-1.0.0/LICENSE) | [Repository](https://github.com/fb55/boolbase) · [npm archive](https://registry.npmjs.org/boolbase/-/boolbase-1.0.0.tgz) |
| css-select | 5.2.2 | BSD-2-Clause | [LICENSE](css-select-5.2.2/LICENSE) | [Repository](https://github.com/fb55/css-select) · [npm archive](https://registry.npmjs.org/css-select/-/css-select-5.2.2.tgz) |
| css-what | 6.2.2 | BSD-2-Clause | [LICENSE](css-what-6.2.2/LICENSE) | [Repository](https://github.com/fb55/css-what) · [npm archive](https://registry.npmjs.org/css-what/-/css-what-6.2.2.tgz) |
| cssom | 0.5.0 | MIT | [LICENSE.txt](cssom-0.5.0/LICENSE.txt) | [Repository](https://github.com/NV/CSSOM) · [npm archive](https://registry.npmjs.org/cssom/-/cssom-0.5.0.tgz) |
| dom-serializer | 2.0.0 | MIT | [LICENSE](dom-serializer-2.0.0/LICENSE) | [Repository](https://github.com/cheeriojs/dom-serializer) · [npm archive](https://registry.npmjs.org/dom-serializer/-/dom-serializer-2.0.0.tgz) |
| entities | 4.5.0 | BSD-2-Clause | [LICENSE](entities-4.5.0/LICENSE) | [Repository](https://github.com/fb55/entities) · [npm archive](https://registry.npmjs.org/entities/-/entities-4.5.0.tgz) |
| domelementtype | 2.3.0 | BSD-2-Clause | [LICENSE](domelementtype-2.3.0/LICENSE) | [Repository](https://github.com/fb55/domelementtype) · [npm archive](https://registry.npmjs.org/domelementtype/-/domelementtype-2.3.0.tgz) |
| domhandler | 5.0.3 | BSD-2-Clause | [LICENSE](domhandler-5.0.3/LICENSE) | [Repository](https://github.com/fb55/domhandler) · [npm archive](https://registry.npmjs.org/domhandler/-/domhandler-5.0.3.tgz) |
| domutils | 3.2.2 | BSD-2-Clause | [LICENSE](domutils-3.2.2/LICENSE) | [Repository](https://github.com/fb55/domutils) · [npm archive](https://registry.npmjs.org/domutils/-/domutils-3.2.2.tgz) |
| entities | 7.0.1 | BSD-2-Clause | [LICENSE](entities-7.0.1/LICENSE) | [Repository](https://github.com/fb55/entities) · [npm archive](https://registry.npmjs.org/entities/-/entities-7.0.1.tgz) |
| html-escaper | 3.0.3 | MIT | [LICENSE.txt](html-escaper-3.0.3/LICENSE.txt) | [Repository](https://github.com/WebReflection/html-escaper) · [npm archive](https://registry.npmjs.org/html-escaper/-/html-escaper-3.0.3.tgz) |
| htmlparser2 | 10.1.0 | MIT | [LICENSE](htmlparser2-10.1.0/LICENSE) | [Repository](https://github.com/fb55/htmlparser2) · [npm archive](https://registry.npmjs.org/htmlparser2/-/htmlparser2-10.1.0.tgz) |
| linkedom | 0.18.12 | ISC | [LICENSE](linkedom-0.18.12/LICENSE) | [Repository](https://github.com/WebReflection/linkedom) · [npm archive](https://registry.npmjs.org/linkedom/-/linkedom-0.18.12.tgz) |
| nth-check | 2.1.1 | BSD-2-Clause | [LICENSE](nth-check-2.1.1/LICENSE) | [Repository](https://github.com/fb55/nth-check) · [npm archive](https://registry.npmjs.org/nth-check/-/nth-check-2.1.1.tgz) |
| uhyphen | 0.2.0 | ISC | [LICENSE](uhyphen-0.2.0/LICENSE) | [Repository](https://github.com/WebReflection/uhyphen) · [npm archive](https://registry.npmjs.org/uhyphen/-/uhyphen-0.2.0.tgz) |

Readability is bundled through its Readability.js / Readability-readerable.js entry points. Its separate JSDOMParser.js file is not bundled. The optional canvas peer for linkedom is not installed or bundled.
