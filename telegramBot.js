const { Telegraf } = require('telegraf');
const nawalaService = require('./services/nawalaService');
const domainService = require('./services/domainService');

class TelegramBot {
    constructor(token, adminId) {
        this.bot = new Telegraf(token);
        this.adminId = adminId;
        this.lastHourlyReportMessageId = null; 
        
        console.log(`🤖 Telegram Bot initialized with Admin ID: ${this.adminId}`);
        
        this.setupPublicCommands();
        this.setupMiddleware();
        this.setupCommands();
    }

    /**
     * Helper function to delete user message after delay
     * @param {Object} ctx - Telegraf context
     * @param {number} delay - Delay in milliseconds (default: 5000)
     */
    deleteUserMessageAfterDelay(ctx, delay = 5000) {
        setTimeout(() => {
            try {
                ctx.deleteMessage();
            } catch (error) {
                console.log('Could not delete user message:', error.message);
            }
        }, delay);
    }

    setupMiddleware() {
        this.bot.use((ctx, next) => {
            if (!ctx.from) {
                return ctx.reply('❌ Access denied. User information not available.');
            }

            const userId = ctx.from.id.toString();
            const adminId = this.adminId.toString();
            
            
            if (userId === adminId) {
                return next();
            } else {
                this.deleteUserMessageAfterDelay(ctx);
                return ctx.reply('❌ Access denied. This bot is for admin use only.\n\nUse /myid to see your User ID.');
            }
        });
    }

    setupPublicCommands() {
        this.bot.command('myid', (ctx) => {
            const userId = ctx.from.id;
            const username = ctx.from.username ? `@${ctx.from.username}` : 'No username';
            const firstName = ctx.from.first_name || 'No first name';
            const lastName = ctx.from.last_name || '';
            
            // Delete user message after 5 seconds
            this.deleteUserMessageAfterDelay(ctx);
            
            ctx.reply(
                `*Your Telegram Information:*\n\n` +
                `*User ID:* \`${userId}\`\n` +
                `*Username:* ${username}\n` +
                `*Name:* ${firstName} ${lastName}\n\n` +
                `*Admin ID:* \`${this.adminId}\`\n\n` +
                `If you need admin access, contact the bot administrator with your User ID.`,
                { parse_mode: 'Markdown' }
            );
        });
    }

    setupCommands() {
        this.bot.start((ctx) => {
            // Delete admin message after 5 seconds
            this.deleteUserMessageAfterDelay(ctx);
            
            ctx.reply(
                `*Nawala Live Bot*\n\n` +
                `Welcome! This bot helps you check domain blocking status.\n\n` +
                `*Available Commands:*\n` +
                `• /check <domain> - Quick check single domain\n` +
                `• /checkmultiple <domain1,domain2> - Check multiple domains\n` +
                `• /results - Get last check results\n` +
                `• /reports - Get hourly reports\n` +
                `• /status - Bot status\n` +
                `• /domains - List all domains\n` +
                `• /adddomain <domain> - Add new domain\n` +
                `• /toggledomain <domain> - Toggle domain status\n` +
                `• /deletedomain <domain> - Delete domain\n` +
                `• /checknow - Trigger manual hourly check\n` +
                `• /help - Show this help message\n\n` +
                `*Examples:*\n` +
                `• /check example.com\n` +
                `• /checkmultiple example.com,reddit.com\n` +
                `• /adddomain google.com`,
                { parse_mode: 'Markdown' }
            );
        });

        this.bot.help((ctx) => {
            // Delete admin message after 5 seconds
            this.deleteUserMessageAfterDelay(ctx);
            
            ctx.reply(
                `📖 *Nawala Live Bot Help*\n\n` +
                `*Commands:*\n` +
                `• /check <domain> - Check if a domain is blocked\n` +
                `• /checkmultiple <domain1,domain2> - Check multiple domains (comma-separated)\n` +
                `• /results - View last check results for all domains\n` +
                `• /reports [limit] - Get hourly reports (default: 5)\n` +
                `• /status - Show bot status and statistics\n` +
                `• /domains - List all domains in database\n` +
                `• /adddomain <domain> - Add new domain to check\n` +
                `• /toggledomain <domain> - Toggle domain active status\n` +
                `• /deletedomain <domain> - Delete domain from database\n` +
                `• /checknow - Trigger manual hourly check\n` +
                `• /help - Show this help message\n\n` +
                `*Examples:*\n` +
                `• /check example.com\n` +
                `• /checkmultiple example.com,reddit.com,google.com\n` +
                `• /adddomain facebook.com\n` +
                `• /toggledomain example.com\n` +
                `• /reports 10\n\n` +
                `*Note:* Maximum 10 domains per multiple check.`,
                { parse_mode: 'Markdown' }
            );
        });

        this.bot.command('check', async (ctx) => {
            try {
                // Delete admin message after 5 seconds
                this.deleteUserMessageAfterDelay(ctx);
                
                const domain = ctx.message.text.split(' ').slice(1).join(' ');
                
                if (!domain) {
                    return ctx.reply('Please provide a domain to check.\nExample: /check example.com');
                }

                if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
                    return ctx.reply('Invalid domain format. Please provide a valid domain.');
                }

                ctx.reply('Checking domain...');

                const result = await nawalaService.checkDomains(domain);
                
                if (result.success) {
                    const isBlocked = result.data[domain]?.blocked || false;
                    const status = isBlocked ? 'BLOCKED' : 'UNBLOCKED';
                    const emoji = isBlocked ? '🔴' : '🟢';
                    
                    ctx.reply(
                        `${emoji} *Domain Check Result*\n\n` +
                        `*Domain:* ${domain}\n` +
                        `*Status:* ${status}\n` +
                        `*Checked at:* ${new Date(result.timestamp).toLocaleString('id-ID')}`,
                        { parse_mode: 'Markdown' }
                    );
                } else {
                    ctx.reply(`Error checking domain: ${result.error}`);
                }
            } catch (error) {
                console.error('Error in check command:', error);
                ctx.reply('An error occurred while checking the domain.');
            }
        });

        this.bot.command('checkmultiple', async (ctx) => {
            try {
                // Delete admin message after 5 seconds
                this.deleteUserMessageAfterDelay(ctx);
                
                const domainsText = ctx.message.text.split(' ').slice(1).join(' ');
                
                if (!domainsText) {
                    return ctx.reply('Please provide domains to check.\nExample: /checkmultiple example.com,reddit.com');
                }

                const domains = domainsText.split(',').map(d => d.trim()).filter(d => d);
                
                if (domains.length === 0) {
                    return ctx.reply('No valid domains provided.');
                }

                if (domains.length > 10) {
                    return ctx.reply('Maximum 10 domains allowed per check.');
                }

                const invalidDomains = domains.filter(d => !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(d));
                if (invalidDomains.length > 0) {
                    return ctx.reply(`Invalid domain format: ${invalidDomains.join(', ')}`);
                }

                ctx.reply(`Checking ${domains.length} domain(s)...`);

                const result = await nawalaService.checkDomains(domains);
                
                if (result.success) {
                    const summary = nawalaService.generateSummaryReport(result);
                    
                    let message = `*Multiple Domain Check Results*\n\n`;
                    message += `*Summary:*\n`;
                    message += `• Total checked: ${summary.summary.totalChecked}\n`;
                    message += `• Blocked: ${summary.summary.blocked}\n`;
                    message += `• Unblocked: ${summary.summary.unblocked}\n\n`;
                    
                    if (summary.summary.blockedDomains.length > 0) {
                        message += `*Blocked Domains:*\n`;
                        summary.summary.blockedDomains.forEach(domain => {
                            message += `• ${domain}\n`;
                        });
                        message += `\n`;
                    }
                    
                    if (summary.summary.unblockedDomains.length > 0) {
                        message += `*Unblocked Domains:*\n`;
                        summary.summary.unblockedDomains.forEach(domain => {
                            message += `• ${domain}\n`;
                        });
                    }
                    
                    message += `\n*Checked at:* ${new Date(result.timestamp).toLocaleString('id-ID')}`;
                    
                    ctx.reply(message, { parse_mode: 'Markdown' });
                } else {
                    ctx.reply(`Error checking domains: ${result.error}`);
                }
            } catch (error) {
                console.error('Error in checkmultiple command:', error);
                ctx.reply('An error occurred while checking the domains.');
            }
        });

        this.bot.command('results', (ctx) => {
            try {
                // Delete admin message after 5 seconds
                this.deleteUserMessageAfterDelay(ctx);
                
                const results = nawalaService.getAllLastCheckResults();
                const domains = Object.keys(results);
                
                if (domains.length === 0) {
                    return ctx.reply('📭 No check results available yet.');
                }

                let message = `*Last Check Results*\n\n`;
                
                domains.forEach(domain => {
                    const result = results[domain];
                    const status = result.blocked ? 'BLOCKED' : 'UNBLOCKED';
                    const time = new Date(result.timestamp).toLocaleString('id-ID');
                    message += `*${domain}*\n`;
                    message += `${status} - ${time}\n\n`;
                });
                
                ctx.reply(message, { parse_mode: 'Markdown' });
            } catch (error) {
                console.error('Error in results command:', error);
                ctx.reply('An error occurred while retrieving results.');
            }
        });

        this.bot.command('reports', async (ctx) => {
            try {
                // Delete admin message after 5 seconds
                this.deleteUserMessageAfterDelay(ctx);
                
                const limitText = ctx.message.text.split(' ').slice(1)[0];
                const limit = limitText ? parseInt(limitText) : 5;
                
                if (isNaN(limit) || limit < 1 || limit > 24) {
                    return ctx.reply('Invalid limit. Please provide a number between 1 and 24.');
                }

                const reports = await nawalaService.getHourlyReports(limit);
                
                if (reports.length === 0) {
                    return ctx.reply('📭 No hourly reports available yet.');
                }

                let message = `*Hourly Reports (Last ${reports.length})\n\n`;
                
                reports.forEach((report, index) => {
                    const time = new Date(report.timestamp).toLocaleString('id-ID');
                    message += `*Report ${index + 1}:*\n`;
                    message += `• Time: ${time}\n`;
                    message += `• Domains checked: ${report.summary?.totalChecked || 'N/A'}\n`;
                    message += `• Blocked: ${report.summary?.blocked || 'N/A'}\n`;
                    message += `• Unblocked: ${report.summary?.unblocked || 'N/A'}\n\n`;
                });
                
                ctx.reply(message, { parse_mode: 'Markdown' });
            } catch (error) {
                console.error('Error in reports command:', error);
                ctx.reply('An error occurred while retrieving reports.');
            }
        });

        this.bot.command('status', async (ctx) => {
            try {
                // Delete admin message after 5 seconds
                this.deleteUserMessageAfterDelay(ctx);
                
                const stats = await domainService.getDomainStatistics();
                const reports = await nawalaService.getHourlyReports();
                
                let message = `*Nawala Live Bot Status*\n\n`;
                message += `*Database Statistics:*\n`;
                message += `• Total domains: ${stats.totalDomains}\n`;
                message += `• Active domains: ${stats.activeDomains}\n`;
                message += `• Hourly check domains: ${stats.hourlyDomains}\n`;
                message += `• Recent checks: ${stats.recentChecks}\n`;
                message += `• Blocked: ${stats.blockedCount}\n`;
                message += `• Unblocked: ${stats.unblockedCount}\n`;
                message += `• Hourly reports: ${reports.length}\n\n`;
                message += `*Bot Info:*\n`;
                message += `• Admin ID: ${this.adminId}\n`;
                message += `• Status: Online\n`;
                message += `• Last update: ${new Date().toLocaleString('id-ID')}`;
                
                ctx.reply(message, { parse_mode: 'Markdown' });
            } catch (error) {
                console.error('Error in status command:', error);
                ctx.reply('An error occurred while retrieving status.');
            }
        });

        this.bot.command('checknow', async (ctx) => {
            try {
                // Delete admin message after 5 seconds
                this.deleteUserMessageAfterDelay(ctx);
                
                const domainsToCheck = await domainService.getDomainsForHourlyCheck();
                
                if (domainsToCheck.length === 0) {
                    return ctx.reply('No domains configured for hourly checking.');
                }

                const result = await nawalaService.checkDomains(domainsToCheck);
                
                if (result.success) {
                    const summary = nawalaService.generateSummaryReport(result);
                    
                    await nawalaService.addHourlyReport(summary);
                    
                    await this.sendHourlyNotification(summary);
                } else {
                    ctx.reply(`Manual hourly check failed: ${result.error}`);
                }
            } catch (error) {
                console.error('Error in checknow command:', error);
                ctx.reply('An error occurred during manual hourly check.');
            }
        });

        this.bot.command('domains', async (ctx) => {
            try {
                // Delete admin message after 5 seconds
                this.deleteUserMessageAfterDelay(ctx);
                
                const domains = await domainService.getAllDomains();
                
                if (domains.length === 0) {
                    return ctx.reply('📭 No domains found in database. Use /adddomain to add domains.');
                }

                let message = `*Domains in Database*\n\n`;
                
                domains.forEach((domain, index) => {
                    const status = domain.isActive ? 'Active' : 'Inactive';
                    const lastStatus = domain.lastStatus?.blocked !== null ? 
                        (domain.lastStatus.blocked ? 'Blocked' : 'Unblocked') : 
                        '❓ Unknown';
                    const lastChecked = domain.lastChecked ? 
                        new Date(domain.lastChecked).toLocaleString('id-ID') : 
                        'Never';
                    
                    message += `*${index + 1}. ${domain.name}*\n`;
                    message += `• Status: ${status}\n`;
                    message += `• Frequency: ${domain.checkFrequency}\n`;
                    message += `• Last status: ${lastStatus}\n`;
                    message += `• Last checked: ${lastChecked}\n`;
                    if (domain.description) {
                        message += `• Description: ${domain.description}\n`;
                    }
                    message += `\n`;
                });
                
                ctx.reply(message, { parse_mode: 'Markdown' });
            } catch (error) {
                console.error('Error in domains command:', error);
                ctx.reply('An error occurred while retrieving domains.');
            }
        });

        this.bot.command('adddomain', async (ctx) => {
            try {
                // Delete admin message after 5 seconds
                this.deleteUserMessageAfterDelay(ctx);
                
                const domainText = ctx.message.text.split(' ').slice(1).join(' ');
                
                if (!domainText) {
                    return ctx.reply('Please provide a domain to add.\nExample: /adddomain example.com');
                }

                if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domainText)) {
                    return ctx.reply('Invalid domain format. Please provide a valid domain.');
                }

                const domain = await domainService.addDomain(domainText);
                
                ctx.reply(
                    `*Domain Added Successfully*\n\n` +
                    `*Domain:* ${domain.name}\n` +
                    `*Status:* ${domain.isActive ? 'Active' : 'Inactive'}\n` +
                    `*Frequency:* ${domain.checkFrequency}\n` +
                    `*Added at:* ${new Date(domain.createdAt).toLocaleString('id-ID')}`,
                    { parse_mode: 'Markdown' }
                );
            } catch (error) {
                if (error.message === 'Domain already exists') {
                    ctx.reply('Domain already exists in database.');
                } else {
                    console.error('Error in adddomain command:', error);
                    ctx.reply('An error occurred while adding the domain.');
                }
            }
        });

        this.bot.command('toggledomain', async (ctx) => {
            try {
                // Delete admin message after 5 seconds
                this.deleteUserMessageAfterDelay(ctx);
                
                const domainText = ctx.message.text.split(' ').slice(1).join(' ');
                
                if (!domainText) {
                    return ctx.reply('Please provide a domain to toggle.\nExample: /toggledomain example.com');
                }

                const domain = await domainService.toggleDomainStatus(domainText);
                
                ctx.reply(
                    `*Domain Status Toggled*\n\n` +
                    `*Domain:* ${domain.name}\n` +
                    `*New Status:* ${domain.isActive ? 'Active' : 'Inactive'}\n` +
                    `*Updated at:* ${new Date(domain.updatedAt).toLocaleString('id-ID')}`,
                    { parse_mode: 'Markdown' }
                );
            } catch (error) {
                if (error.message === 'Domain not found') {
                    ctx.reply('Domain not found in database.');
                } else {
                    console.error('Error in toggledomain command:', error);
                    ctx.reply('An error occurred while toggling domain status.');
                }
            }
        });

        this.bot.command('deletedomain', async (ctx) => {
            try {
                // Delete admin message after 5 seconds
                this.deleteUserMessageAfterDelay(ctx);
                
                const domainText = ctx.message.text.split(' ').slice(1).join(' ');
                
                if (!domainText) {
                    return ctx.reply('Please provide a domain to delete.\nExample: /deletedomain example.com');
                }

                const domain = await domainService.deleteDomain(domainText);
                
                ctx.reply(
                    `*Domain Deleted Successfully*\n\n` +
                    `*Domain:* ${domain.name}\n` +
                    `*Deleted at:* ${new Date().toLocaleString('id-ID')}\n\n` +
                    `All check history for this domain has also been deleted.`,
                    { parse_mode: 'Markdown' }
                );
            } catch (error) {
                if (error.message === 'Domain not found') {
                    ctx.reply('Domain not found in database.');
                } else {
                    console.error('Error in deletedomain command:', error);
                    ctx.reply('An error occurred while deleting the domain.');
                }
            }
        });

        this.bot.catch((err, ctx) => {
            console.error('Bot error:', err);
            ctx.reply('An unexpected error occurred. Please try again.');
        });
    }

    /**
     * Send hourly notification to Telegram
     * @param {Object} summary 
     */
    async sendHourlyNotification(summary) {
        try {
            const bot = this.bot;
            const adminId = this.adminId;
            
            if (this.lastHourlyReportMessageId) {
                try {
                    await bot.telegram.deleteMessage(adminId, this.lastHourlyReportMessageId);
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
            this.lastHourlyReportMessageId = sentMessage.message_id;
        } catch (error) {
            console.error('Failed to send hourly notification:', error);
        }
    }

    start() {
        this.bot.launch().then(() => {
        }).catch((error) => {
            console.error('Failed to start Telegram bot:', error);
        });

        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    }

    stop() {
        this.bot.stop();
    }

    getBot() {
        return this.bot;
    }
}

module.exports = TelegramBot;
