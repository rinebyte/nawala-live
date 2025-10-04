const mongoose = require('mongoose');

const domainSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                return /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);
            },
            message: 'Invalid domain format'
        }
    },
    description: {
        type: String,
        trim: true,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    },
    checkFrequency: {
        type: String,
        enum: ['hourly', 'daily', 'weekly'],
        default: 'hourly'
    },
    lastChecked: {
        type: Date,
        default: null
    },
    lastStatus: {
        blocked: {
            type: Boolean,
            default: null
        },
        timestamp: {
            type: Date,
            default: null
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

domainSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

domainSchema.index({ isActive: 1 });
domainSchema.index({ checkFrequency: 1 });

const checkResultSchema = new mongoose.Schema({
    domain: {
        type: String,
        required: true,
        ref: 'Domain'
    },
    blocked: {
        type: Boolean,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    responseTime: {
        type: Number,
        default: null
    },
    error: {
        type: String,
        default: null
    }
});

checkResultSchema.index({ domain: 1, timestamp: -1 });
checkResultSchema.index({ timestamp: -1 });

const hourlyReportSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        required: true
    },
    domainsChecked: {
        type: Number,
        required: true
    },
    summary: {
        totalChecked: {
            type: Number,
            required: true
        },
        blocked: {
            type: Number,
            required: true
        },
        unblocked: {
            type: Number,
            required: true
        },
        blockedDomains: [{
            type: String
        }],
        unblockedDomains: [{
            type: String
        }]
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

hourlyReportSchema.index({ timestamp: -1 });

const Domain = mongoose.model('Domain', domainSchema);
const CheckResult = mongoose.model('CheckResult', checkResultSchema);
const HourlyReport = mongoose.model('HourlyReport', hourlyReportSchema);

module.exports = {
    Domain,
    CheckResult,
    HourlyReport
};
