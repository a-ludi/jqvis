const fs = require('fs');


const resolvedStyles = {
    bootstrap: require.resolve('bootstrap/dist/css/bootstrap.min.css'),
    highlight: require.resolve('highlight.js/styles/github.css'),
};

try
{
    Object
        .entries(resolvedStyles)
        .forEach(([name, stylePath]) => {
            const targetPath = `./css/${name}.css`;

            try
            {
                fs.linkSync(stylePath, targetPath);
            }
            catch (err)
            {
                if (err.code !== 'EEXIST')
                    throw new Error(`Failed to link stylesheet for '${name}': ${err}`);

                fs.unlinkSync(targetPath);
                fs.linkSync(stylePath, targetPath);
            }

            console.log(`Linked '${stylePath}' -> '${targetPath}'`);
        });
}
catch (err)
{
    console.error(err);
    process.exit(1);
}
