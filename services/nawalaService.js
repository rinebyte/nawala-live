const axios = require('axios');
const domainService = require('./domainService');

class NawalaService {
    constructor() {
        this.baseUrl = 'https://check.skiddle.id';
        this.lastCheckResults = new Map();
    }

    /**
     * Check domain blocking status
     * @param {string|string[]} domains - Single domain or array of domains to check
     * @returns {Promise<Object>} - Domain blocking status
     */
    async checkDomains(domains) {
        try {
            const domainList = Array.isArray(domains) ? domains : [domains];
            
            const domainString = domainList.join(',');
            
            const response = await axios.get(`${this.baseUrl}/?domains=${domainString}`, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Nawala-Live/1.0'
                }
            });

            const results = response.data;
            
            const timestamp = new Date().toISOString();
            domainList.forEach(async (domain) => {
                const blocked = results[domain]?.blocked || false;
                
                this.lastCheckResults.set(domain, {
                    blocked: blocked,
                    timestamp: timestamp
                });

                try {
                    await domainService.updateDomainStatus(domain, blocked);
                } catch (error) {
                    console.error(`Error updating domain status for ${domain}:`, error);
                }
            });

            return {
                success: true,
                data: results,
                timestamp: timestamp,
                checkedDomains: domainList
            };
        } catch (error) {
            console.error('Error checking domains:', error.message);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get last check results for a domain
     * @param {string} domain - Domain to get results for
     * @returns {Object|null} - Last check result or null if not found
     */
    getLastCheckResult(domain) {
        return this.lastCheckResults.get(domain) || null;
    }

    /**
     * Get all last check results
     * @returns {Object} - All stored check results
     */
    getAllLastCheckResults() {
        const results = {};
        this.lastCheckResults.forEach((value, key) => {
            results[key] = value;
        });
        return results;
    }

    /**
     * Add hourly report
     * @param {Object} report - Report data
     */
    async addHourlyReport(report) {
        try {
            await domainService.saveHourlyReport(report);
        } catch (error) {
            console.error('Error saving hourly report:', error);
        }
    }

    /**
     * Get hourly reports
     * @param {number} limit - Number of reports to return (default: 10)
     * @returns {Array} - Array of hourly reports
     */
    async getHourlyReports(limit = 10) {
        try {
            return await domainService.getHourlyReports(limit);
        } catch (error) {
            console.error('Error getting hourly reports:', error);
            return [];
        }
    }

    /**
     * Generate summary report for domains
     * @param {Object} checkResults - Results from checkDomains
     * @returns {Object} - Summary report
     */
    generateSummaryReport(checkResults) {
        if (!checkResults.success) {
            return {
                success: false,
                error: checkResults.error,
                timestamp: checkResults.timestamp
            };
        }

        const domains = Object.keys(checkResults.data);
        const blockedDomains = domains.filter(domain => checkResults.data[domain].blocked);
        const unblockedDomains = domains.filter(domain => !checkResults.data[domain].blocked);

        return {
            success: true,
            timestamp: checkResults.timestamp,
            summary: {
                totalChecked: domains.length,
                blocked: blockedDomains.length,
                unblocked: unblockedDomains.length,
                blockedDomains: blockedDomains,
                unblockedDomains: unblockedDomains
            },
            details: checkResults.data
        };
    }
}

module.exports = new NawalaService();
