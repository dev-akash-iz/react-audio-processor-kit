const path = require('path');

module.exports = {
    entry: './index.js', // Starting point of your app or library
    output: {
        filename: 'index.js', // The bundled file output
        path: path.resolve(__dirname, 'dist'),
        libraryTarget: 'umd', // To make it usable in multiple environments (CommonJS, AMD, UMD)
    },
    externals: {
        react: 'react',           // Externalize React (treat it as a peer dependency)
        'react-dom': 'react-dom'  // If you're using React DOM, also externalize that
    },
    devtool: 'source-map', // Enables source map generation
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: [
                            '@babel/preset-env',
                            ['@babel/preset-react', { runtime: 'automatic' }]
                        ]
                    },
                },
            },
        ],
    },
    resolve: {
        extensions: ['.js', '.jsx'],
    },
};
