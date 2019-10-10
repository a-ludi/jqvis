jqVis
=====

![jqVis](./icon.png?sanitize=true&raw=true)

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> A simplistic GUI wrapper for `jq`.


Table of Contents
-----------------

- [Install](#install)
- [Usage](#usage)
- [Maintainer](#maintainer)
- [Contributing](#contributing)
- [License](#license)


Install
--------

Be sure to install [`jq`](https://stedolan.github.io/jq/). Then install and
start with

```
git clone https://github.com/a-ludi/jqvis.git
cd jqvis
npm install
npm start
```

Usage
-----

1. Start with `npm start`.
2. Select a file by clicking "Select JSON file…".
3. Enter a `jq` query into the editor
4. Optionally, select `jq` options to control input and output.
5. Execute by clicking "Send" or pressing <kbd>Ctrl</kbd> + <kbd>Enter</kbd>.
6. The result will be shown in the output area below.


### Persistence


The current file, query and `jq` options will be automatically saved after every
successful execution.

In addition to that, you may save your queries by name in local storage. Make
sure to manually save your most precious queries in a file, though. The local
storage **may be deleted unexpectedly!**


### Example

![jqVis screenshot](./examples/screenshot.png?sanitize=true&raw=true)


Maintainer
----------

Arne Ludwig &lt;<arne.ludwig@posteo.de>&gt;


License
-------

This project is licensed under MIT License (see license in [LICENSE](./LICENSE)).
