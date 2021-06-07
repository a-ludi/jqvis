const { promisify } = require('util');
const { ipcRenderer } = require('electron');
const fsSync = require('fs');
const fs = require('fs').promises;
const temp = require('temp');
const process = require('process');
const os = require('os');
const { dirname } = require('path');
const child_process = require('child_process');
const isEmpty = require('lodash.isempty');
const hljs = require('highlight.js');
hljs.registerLanguage('json', require('highlight.js/lib/languages/json'));
const $ = require('jquery');
const ace = require('ace-builds');

let editor;
let inputFile;
let query;
let jqOptions;
let alertsInitialized;
let isLoading;
let lastResult = null;
let tempInput = false;

const jqFlags = [
    'compact-output',
    'slurp',
    'raw-output',
    'sort-keys',
    'ascii-output',
    'join-output',
    'exit-status',
];


let jqProcess = null;


async function callJq(file, query, options = {})
{
    if (isLoading)
        return;

    let flags = Object
        .entries(options)
        .map(([optionName, isActive]) => isActive
            ? "--" + optionName
            : null)
        .filter((flag) => flag !== null);

    try
    {
        setLoading();
        let { stdout, stderr } = await new Promise((resolve, reject) => {
            jqProcess = child_process.execFile('jq', flags.concat([
                query,
                file,
            ]), { maxBuffer: 100 * 1024 * 1024 }, (error, stdout, stderr) => {
                if (error)
                    reject(error);
                else
                    resolve({ stdout, stderr });
            });
        });

        if (stderr)
            throw new Error(stderr);

        jqProcess = null;
        unsetLoading();

        return stdout;
    }
    catch (err)
    {
        unsetLoading();

        if (jqProcess === null)
            return showWarning("JQ has been cancelled.");

        jqProcess = null;

        throw err;
    }
}


function cancelJq()
{
    if (!isLoading || jqProcess === null)
        return;

    if (jqProcess.kill()) {
        jqProcess = null;
        unsetLoading();
    } else {
        throw new Error("Could not stop the JQ process.");
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


function initAlerts()
{
    if (alertsInitialized)
        return;

    $('.alert .dismiss-alert')
        .click(function (event) {
            console.error($(event.target).parents('.alert'));

            $(event.target)
                .parents('.alert')
                .clearQueue()
                .fadeOut(200);

            event.preventDefault();
        });

    alertsInitialized = true;
}


function showError(message, timeout=3000)
{
    showAlert('danger', message, timeout);
}

function showSuccess(message, timeout=3000)
{
    showAlert('success', message, timeout);
}

function showWarning(message, timeout=3000)
{
    showAlert('warning', message, timeout);
}


function showAlert(level, message, timeout=3000)
{
    initAlerts();
    $('#alert-message')
        .text(message)
        .parents('.alert')
        .removeClass(
            "alert-primary alert-secondary alert-success alert-danger " +
            "alert-warning alert-info alert-light alert-dark"
        )
        .addClass(`alert-${level}`)
        .fadeIn(1)
        .delay(timeout)
        .fadeOut(1000);

    if (level === "danger")
        console.error(message);
    else
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

function initGrips(editors)
{
    $('.query-editor-grip').on('mousedown', (event) => {
        const handle = $(event.target);
        const resizables = $(handle.attr('for'));
        let dragLastX = event.pageX;
        let dragLastY = event.pageY;

        $('body').on('mousemove.grip-drag', '*', (event) => {
            const deltaX = event.pageX - dragLastX;
            const deltaY = event.pageY - dragLastY;

            resizables.height((index, height) => height + deltaY);
            editors.forEach((editor) => editor.resize());

            event.preventDefault();
            dragLastX = event.pageX;
            dragLastY = event.pageY;
        });

        $('body').one('mouseup', (event) => {
            $('body').off('mousemove.grip-drag', '*');
        });
    });


}

function openFileDialog() {
    let options = {
        filters: [
            { name: "JSON documents", extensions: ["json"] },
            { name: "All Files", extensions: ["*"] },
        ],
        properties: ["openFile"],
    };

    if (!isEmpty(inputFile))
        options.defaultPath = dirname(inputFile);

    ipcRenderer.send('openFile', options);
}

function writeFileDialog(contents) {
    const options = {
        filters: [
            { name: "JSON documents", extensions: ["json"] },
            { name: "All Files", extensions: ["*"] },
        ],
    };

    if (jqOptions['raw-output'])
        options.filters.reverse();

    if (!isEmpty(inputFile))
        options.defaultPath = dirname(inputFile);

    ipcRenderer.send('saveFile', contents, options);
}

function showResult(result) {
    if (!jqOptions['raw-output'] && result.length < 10 * 1024 * 1024)
        $('#output').html(hljs.highlight('json', result).value);
    else
        $('#output').text(result);

    $('.result-actions [disabled]').prop('disabled', false);
}

function newWindow(params) {
    const finalParams = Object.assign({
        inputFile,
        query,
        jqOptions: JSON.stringify(jqOptions),
        tempInput: false,
    }, params);
    const urlParams = new URLSearchParams(finalParams);

    window.open(`${window.location.origin}${window.location.pathname}?${urlParams}`);
}

const migrations = [
    function useRawJqOptionsNames()
    {
        jqOptions = JSON.parse(localStorage.getItem('jqOptions') || '{}');

        if ("compact" in jqOptions)
        {
            jqOptions["compact-output"] = jqOptions["compact"];
            delete jqOptions["compact"];
        }

        localStorage.setItem(`jqOptions`, JSON.stringify(jqOptions));
    },
];

function migrateLocalStorage() {
    const fulfilledMigrations = JSON.parse(localStorage.getItem('fulfilledMigrations') || '{}');

    migrations.forEach(migration => {
        try
        {
            if (!(migration.name in fulfilledMigrations))
            {
                migration();
                fulfilledMigrations[migration.name] = true;
            }
        }
        catch (err)
        {
            showError("Failed to migrate local storage: " + err);
        }
    });

    localStorage.setItem(`fulfilledMigrations`, JSON.stringify(fulfilledMigrations));
}

function cleanupSync()
{
    if (!tempInput)
        return;

    console.log(`Deleting temp file ${inputFile}`);
    fsSync.unlinkSync(inputFile);
}

function load() {
    const params = new URLSearchParams(window.location.search);
    migrateLocalStorage();

    if (params.has("inputFile"))
        setInputFile(params.get("inputFile"));
    else
        setInputFile(localStorage.getItem('inputFile'));

    if (params.has("tempInput") && params.get("tempInput") === "true")
    {
        console.log("Setting up temporary input");
        tempInput = true;
        process.addListener('exit', function() {
            try {
                cleanupSync();
            } catch(err) {
                console.warn("Fail to clean temporary files on exit : ", err);
                throw err;
            }
        });
    }

    if (params.has("query"))
        query = params.get("query");
    else
        query = localStorage.getItem('lastQuery');

    if (params.has("jqOptions"))
        jqOptions = JSON.parse(params.get("jqOptions"));
    else
        jqOptions = JSON.parse(localStorage.getItem('jqOptions') || '{}');

    syncOptionCheckboxes();
    updateStoredQueries();

    if (tempInput) {
        // Deactivate input file
        $('#select-file, #file-name').prop("disabled", true);
    } else {
        // Register input file
        $('#select-file').click(openFileDialog);

        ipcRenderer.on('fileNames', (event, fileNames) => {
            setInputFile(fileNames[0]);
        });

        $('#file-name').change(function () {
            setInputFile($(this).val());
        });
    }


    jqFlags.forEach((optionName) => {
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
    initGrips([editor]);

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
    $(window).keyup(function (event) {
        if (event.ctrlKey && event.key == 'Enter')
        {
            $('#query-form').submit();
            event.preventDefault();
        }
        else if (event.key == 'Esc')
        {
            cancelJq();
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

            if (typeof(result) === "undefined")
                return; // jq was called twice
            else if (isEmpty(result))
                return showSuccess('Empty output');

            showResult(result);

            localStorage.setItem('inputFile', inputFile);
            localStorage.setItem('lastQuery', query);
            localStorage.setItem('jqOptions', JSON.stringify(jqOptions));

            lastResult = result;
        }
        catch (err)
        {
            return showError(err, 10000);
        }
    });

    // Cancel jq
    $('#query-form .action-cancel').click(function(event) {
        event.preventDefault();

        try
        {
            cancelJq();
        }
        catch (err)
        {
            return showError(err, 10000);
        }
    });

    $('#copy-result-button').click(async function(event) {
        if (isEmpty(lastResult))
            return;

        await navigator.clipboard.writeText(lastResult);

        showSuccess("Result copied to clipboard.");
    });

    $('#save-result-button').click(async function(event) {
        writeFileDialog(lastResult);
    });

    $('#clear-result-button').click(async function(event) {
        showResult("");
    });

    $('#new-window').click(async function(event) {
        newWindow();
    });

    $('#act-on-result').click(async function(event) {
        const outputFile = temp.path({
            dir: os.tmpdir(),
            prefix: 'jqvis.',
            suffix: '.json',
        });
        await fs.writeFile(outputFile, lastResult);

        newWindow({ inputFile: outputFile, tempInput: true });
    });

    $('#hide-result-toggle').change(function() {
        if ($(this).prop('checked'))
            $('#output').hide();
        else
            $('#output').show();
    })

    ipcRenderer.on('fileWritten', (event, { fileName, error, cancelled }) => {
        if (error === null && !cancelled)
            showSuccess("Result saved to '" + fileName + "'.");
        else if (error !== null)
            showError("error saving file: " + error);
    });
}

load();