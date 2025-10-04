const { Domain, CheckResult, HourlyReport } = require('../models');

class DomainService {
    constructor() {
        this.domains = new Map();
    }

    /**
     * Add a new domain to check
     * @param {string} domainName - Domain name to add
     * @param {string} description - Optional description
     * @param {string} checkFrequency - Check frequency (hourly, daily, weekly)
     */
    async addDomain(domainName, description = '', checkFrequency = 'hourly') {
        try {
            if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domainName)) {
                throw new Error('Invalid domain format');
            }

            const domain = new Domain({
                name: domainName.toLowerCase().trim(),
                description: description.trim(),
                checkFrequency: checkFrequency
            });

            const savedDomain = await domain.save();
            return savedDomain;
        } catch (error) {
            if (error.code === 11000) {
                throw new Error('Domain already exists');
            }
            throw error;
        }
    }

    /**
     * Get all domains
     * @param {boolean} activeOnly - Return only active domains
     */
    async getAllDomains(activeOnly = false) {
        try {
            const query = activeOnly ? { isActive: true } : {};
            const domains = await Domain.find(query).sort({ name: 1 });
            return domains;
        } catch (error) {
            console.error('Error getting domains:', error);
            throw error;
        }
    }

    /**
     * Get domains for hourly checking
     */
    async getDomainsForHourlyCheck() {
        try {
            const domains = await Domain.find({ 
                isActive: true, 
                checkFrequency: 'hourly' 
            }).select('name');
            
            return domains.map(domain => domain.name);
        } catch (error) {
            console.error('Error getting domains for hourly check:', error);
            throw error;
        }
    }

    /**
     * Update domain status
     * @param {string} domainName - Domain name
     * @param {boolean} blocked - Blocked status
     */
    async updateDomainStatus(domainName, blocked) {
        try {
            const domain = await Domain.findOne({ name: domainName.toLowerCase() });
            if (!domain) {
                throw new Error('Domain not found');
            }

            domain.lastChecked = new Date();
            domain.lastStatus = {
                blocked: blocked,
                timestamp: new Date()
            };

            await domain.save();

            const checkResult = new CheckResult({
                domain: domainName.toLowerCase(),
                blocked: blocked
            });

            await checkResult.save();
            return domain;
        } catch (error) {
            console.error('Error updating domain status:', error);
            throw error;
        }
    }

    /**
     * Toggle domain active status
     * @param {string} domainName - Domain name
     */
    async toggleDomainStatus(domainName) {
        try {
            const domain = await Domain.findOne({ name: domainName.toLowerCase() });
            if (!domain) {
                throw new Error('Domain not found');
            }

            domain.isActive = !domain.isActive;
            await domain.save();

            return domain;
        } catch (error) {
            console.error('Error toggling domain status:', error);
            throw error;
        }
    }

    /**
     * Delete domain
     * @param {string} domainName - Domain name
     */
    async deleteDomain(domainName) {
        try {
            const domain = await Domain.findOneAndDelete({ name: domainName.toLowerCase() });
            if (!domain) {
                throw new Error('Domain not found');
            }

            // Also delete related check results
            await CheckResult.deleteMany({ domain: domainName.toLowerCase() });

            return domain;
        } catch (error) {
            console.error('Error deleting domain:', error);
            throw error;
        }
    }

    /**
     * Get domain check history
     * @param {string} domainName - Domain name
     * @param {number} limit - Number of results to return
     */
    async getDomainHistory(domainName, limit = 50) {
        try {
            const history = await CheckResult.find({ domain: domainName.toLowerCase() })
                .sort({ timestamp: -1 })
                .limit(limit);

            return history;
        } catch (error) {
            console.error('Error getting domain history:', error);
            throw error;
        }
    }

    /**
     * Save hourly report
     * @param {Object} reportData - Report data
     */
    async saveHourlyReport(reportData) {
        try {
            const report = new HourlyReport({
                timestamp: new Date(),
                domainsChecked: reportData.domainsChecked || 0,
                summary: reportData.summary,
                details: reportData.details || {}
            });

            await report.save();
            return report;
        } catch (error) {
            console.error('Error saving hourly report:', error);
            throw error;
        }
    }

    /**
     * Get hourly reports
     * @param {number} limit - Number of reports to return
     */
    async getHourlyReports(limit = 10) {
        try {
            const reports = await HourlyReport.find()
                .sort({ timestamp: -1 })
                .limit(limit);

            return reports;
        } catch (error) {
            console.error('Error getting hourly reports:', error);
            throw error;
        }
    }

    /**
     * Get domain statistics
     */
    async getDomainStatistics() {
        try {
            const totalDomains = await Domain.countDocuments();
            const activeDomains = await Domain.countDocuments({ isActive: true });
            const hourlyDomains = await Domain.countDocuments({ 
                isActive: true, 
                checkFrequency: 'hourly' 
            });

            const recentChecks = await CheckResult.find()
                .sort({ timestamp: -1 })
                .limit(100);

            const blockedCount = recentChecks.filter(check => check.blocked).length;
            const unblockedCount = recentChecks.length - blockedCount;

            return {
                totalDomains,
                activeDomains,
                hourlyDomains,
                recentChecks: recentChecks.length,
                blockedCount,
                unblockedCount
            };
        } catch (error) {
            console.error('Error getting domain statistics:', error);
            throw error;
        }
    }
}

module.exports = new DomainService();
