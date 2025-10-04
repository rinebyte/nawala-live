const cron = require('node-cron');
const nawalaService = require('./nawalaService');
const domainService = require('./domainService');

class HourlyChecker {
    constructor(domainsToCheck = [], telegramBot = null) {
        this.domainsToCheck = domainsToCheck;
        this.telegramBot = telegramBot;
        this.isRunning = false;
        this.cronJob = null;
    }

    /**
     * Set domains to check hourly
     * @param {string[]} domains - Array of domains to check
     */
    setDomainsToCheck(domains) {
        this.domainsToCheck = domains;
    }

    /**
     * Set Telegram bot instance for notifications
     * @param {Object} bot - Telegram bot instance
     */
    setTelegramBot(bot) {
        this.telegramBot = bot;
    }

    /**
     * Perform hourly check
     */
    async performHourlyCheck() {
        try {
            const domainsToCheck = await domainService.getDomainsForHourlyCheck();
            
                if (domainsToCheck.length === 0) {
                    return;
                }

            const result = await nawalaService.checkDomains(domainsToCheck);
            
            if (result.success) {
                const summary = nawalaService.generateSummaryReport(result);
                
                await nawalaService.addHourlyReport(summary);
                
                if (this.telegramBot) {
                    await this.sendHourlyNotification(summary);
                }
                
                return summary;
            } else {
                console.error(`Hourly check failed: ${result.error}`);
                
                if (this.telegramBot) {
                    await this.sendErrorNotification(result.error);
                }
            }
        } catch (error) {
            console.error('Error during hourly check:', error);
            
            if (this.telegramBot) {
                await this.sendErrorNotification(error.message);
            }
        }
    }

    /**
     * Send hourly notification to Telegram
     * @param {Object} summary - Check summary
     */
    async sendHourlyNotification(summary) {
        try {
            const bot = this.telegramBot.getBot();
            const adminId = this.telegramBot.adminId;
            
            // Delete the previous hourly report message if it exists
            if (this.telegramBot.lastHourlyReportMessageId) {
                try {
                    await bot.telegram.deleteMessage(adminId, this.telegramBot.lastHourlyReportMessageId);
                } catch (deleteError) {
                }
            }
            
            let message = `*Hourly Check Report*\n\n`;
            message += `*Summary:*\n`;
            message += `• Domains checked: ${summary.summary.totalChecked}\n`;
            message += `• Blocked: ${summary.summary.blocked}\n`;
            message += `• Unblocked: ${summary.summary.unblocked}\n\n`;
            
            if (summary.summary.blockedDomains.length > 0) {
                message += `*Blocked Domains:*\n`;
                summary.summary.blockedDomains.forEach(domain => {
                    message += `• ${domain}\n`;
                });
                message += `\n`;
            }
            
            message += `\n*Checked at:* ${new Date(summary.timestamp).toLocaleString('id-ID')}`;
            
            const sentMessage = await bot.telegram.sendMessage(adminId, message, { parse_mode: 'Markdown' });
            this.telegramBot.lastHourlyReportMessageId = sentMessage.message_id;
        } catch (error) {
            console.error('Failed to send hourly notification:', error);
        }
    }

    /**
     * Send error notification to Telegram
     * @param {string} error - Error message
     */
    async sendErrorNotification(error) {
        try {
            const bot = this.telegramBot.getBot();
            const adminId = this.telegramBot.adminId;
            
            const message = `*Hourly Check Error*\n\n` +
                          `An error occurred during the hourly check:\n` +
                          `\`${error}\`\n\n` +
                          `*Time:* ${new Date().toLocaleString('id-ID')}`;
            
            await bot.telegram.sendMessage(adminId, message, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Failed to send error notification:', error);
        }
    }

    /**
     * Start hourly checking
     * @param {string} cronExpression - Cron expression (default: '0 * * * *' - every hour)
     */
    start(cronExpression = '0 * * * *') {
        if (this.isRunning) {
            return;
        }

        this.cronJob = cron.schedule(cronExpression, async () => {
            await this.performHourlyCheck();
        }, {
            scheduled: false,
            timezone: 'Asia/Jakarta'
        });

        this.cronJob.start();
        this.isRunning = true;
        
        setTimeout(() => {
            this.performHourlyCheck();
        }, 5000); 
    }

    /**
     * Stop hourly checking
     */
    stop() {
        if (!this.isRunning) {
            return;
        }

        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }

        this.isRunning = false;
    }

    /**
     * Get status of hourly checker
     */
    async getStatus() {
        try {
            const domainsToCheck = await domainService.getDomainsForHourlyCheck();
            return {
                isRunning: this.isRunning,
                domainsToCheck: domainsToCheck,
                hasTelegramBot: !!this.telegramBot,
                cronExpression: this.cronJob ? this.cronJob.cronTime.source : null
            };
        } catch (error) {
            console.error('Error getting hourly checker status:', error);
            return {
                isRunning: this.isRunning,
                domainsToCheck: [],
                hasTelegramBot: !!this.telegramBot,
                cronExpression: this.cronJob ? this.cronJob.cronTime.source : null,
                error: error.message
            };
        }
    }

    /**
     * Manually trigger hourly check
     */
    async triggerCheck() {
        return await this.performHourlyCheck();
    }
}

module.exports = HourlyChecker;
