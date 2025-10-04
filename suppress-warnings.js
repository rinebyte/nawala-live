// Suppress all warnings and deprecation messages
process.removeAllListeners('warning');
process.on('warning', () => {});

// Suppress mongoose warnings
const mongoose = require('mongoose');
mongoose.set('strictQuery', false);

// Suppress punycode deprecation warning
const originalEmitWarning = process.emitWarning;
process.emitWarning = function(warning, name, code, ...args) {
    if (code === 'DEP0040') {
        return;
    }
    return originalEmitWarning.call(this, warning, name, code, ...args);
};

module.exports = {};
