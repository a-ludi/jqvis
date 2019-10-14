const { promisify } = require('util');
const child_process = require('child_process');
const execFile = promisify(child_process.execFile);
const isEmpty = require('lodash.isempty');
const hljs = require('highlight.js/lib/highlight');
hljs.registerLanguage('json', require('highlight.js/lib/languages/json'));
const $ = require('jquery');
const ace = require('ace-builds');

let editor;
let inputFile;
let query;
let jqOptions;
let isLoading;

const jqFlags = {
    compact: '--compact-output',
    slurp: '--slurp',
    'raw-output': '--raw-output',
};


async function callJq(file, query, options = {})
{
    if (isLoading)
        return;

    setLoading();

    let flags = Object
        .entries(options)
        .map(([optionName, isActive]) => isActive
            ? jqFlags[optionName]
            : null)
        .filter((flag) => flag !== null);

    try
    {
        let { stdout, stderr } = await execFile('jq', flags.concat([
            query,
            file,
        ]), { maxBuffer: 100 * 1024 * 1024 });

        if (stderr)
            throw new Error(stderr);

        unsetLoading();

        return stdout;
    }
    catch (err)
    {
        unsetLoading();

        throw err;
    }
}


function setLoading()
{
    isLoading = true;
    $('#query-form').addClass('loading');
}


function unsetLoading()
{
    $('#query-form').removeClass('loading');
    isLoading = false;
}



    return stdout;
}


function showError(message, timeout=3000)
{
    $('#error-message')
        .text(`Error: ${message}`)
        .fadeIn(1)
        .delay(timeout)
        .fadeOut(1000);
    console.error(message);
}

function showSuccess(message, timeout=3000)
{
    $('#success-message')
        .text(message)
        .fadeIn(1)
        .delay(timeout)
        .fadeOut(1000);
    console.log(message);
}

function setInputFile(filename)
{
    inputFile = filename;
    $('#file-name').val(filename);
    $('#query-input').focus();
}

function toogleOption(optionName)
{
    jqOptions[optionName] = !jqOptions[optionName];
    syncOptionCheckboxes();
}

function syncOptionCheckboxes()
{
    Object
        .entries(jqOptions)
        .forEach(([optionName, isActive]) => {
            $('#flags-' + optionName)[0].checked = isActive;
        });
}

function updateStoredQueries()
{
    const lsId = 'savedQueries';
    $('#saved-queries').html('');
    $('#saved-queries-delete').html('');

    for (let i = localStorage.length - 1; i >= 0; i--) {
        let lsKey = localStorage.key(i);

        if (lsKey.startsWith(lsId))
        {
            let saveName = lsKey.substring(lsId.length + 1, lsKey.length - 1);

            $('#saved-queries').append(
                $(document.createElement('button'))
                    .addClass('dropdown-item')
                    .text(saveName)
                    .click((event) => {
                        event.preventDefault();

                        query = localStorage.getItem(`savedQueries[${saveName}]`);
                        editor.setValue(query);
                        $('#save-name').val(saveName);
                    })
            );
            $('#saved-queries-delete').append(
                $(document.createElement('button'))
                    .addClass('dropdown-item')
                    .addClass('text-danger')
                    .text(saveName)
                    .click((event) => {
                        event.preventDefault();

                        if (!confirm(`Delete query ${saveName}?`))
                            return;

                        localStorage.removeItem(`savedQueries[${saveName}]`);
                        updateStoredQueries();
                    })
            );
        }
    }
}

function load() {
    setInputFile(localStorage.getItem('inputFile'));
    query = localStorage.getItem('lastQuery');
    jqOptions = JSON.parse(localStorage.getItem('jqOptions') || '{}');

    syncOptionCheckboxes();
    updateStoredQueries();

    // Register input file
    $('#file-name').click(function() {
        $('#input-file').click();
    });
    $('#input-file').on('input propertychange', function() {
        setInputFile(this.files[0].path);
    });

    ['compact', 'slurp', 'raw-output'].forEach((optionName) => {
        $('#flags-' + optionName).on('change', function() {
            jqOptions[optionName] = this.checked;
        });
    });

    editor = ace.edit("query-editor");
    // editor.session.setMode("ace/mode/jq");
    if (!isEmpty(query))
        editor.setValue(query);
    editor.on('change', function () {
        query = editor.getValue();
    });
    editor.focus();

    // Save query under name
    $('#save-form').submit(function(event) {
        event.preventDefault();

        let saveName = $('#save-name').val();

        if (isEmpty(saveName))
            return showError("Save name must not be empty.");

        let exists = !!localStorage.getItem(`savedQueries[${saveName}]`);
        localStorage.setItem(`savedQueries[${saveName}]`, query);

        if (exists)
            showSuccess(`Query '${saveName}' has been overwritten.`)
        else
            showSuccess(`Query has been saved under '${saveName}'.`)

        updateStoredQueries();
    });

    // Trigger jq execution on ctrl+enter
    $('#query-form, #query-editor').keyup(function (event) {
        if (event.ctrlKey && event.key == 'Enter')
        {
            $('#query-form').submit();
            event.preventDefault();
        }
    });

    // Execute jq
    $('#query-form').submit(async function(event) {
        event.preventDefault();

        if (isEmpty(inputFile))
            return showError('No file selected');

        if (isEmpty(query))
            return showError('Empty query');

        try
        {
            let result = await callJq(inputFile, query, jqOptions);

            $('#output').html(hljs.highlight('json', result).value);

            localStorage.setItem('inputFile', inputFile);
            localStorage.setItem('lastQuery', query);
            localStorage.setItem('jqOptions', JSON.stringify(jqOptions));
        }
        catch (err)
        {
            return showError(err, 10000);
        }
    });
}

load();