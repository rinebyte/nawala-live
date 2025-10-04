require('dotenv').config();
require('./suppress-warnings');

const WebServer = require('./webServer');
const TelegramBot = require('./telegramBot');
const HourlyChecker = require('./services/hourlyChecker');
const DatabaseService = require('./services/databaseService');

class NawalaLiveServer {
    constructor() {
        this.webServer = null;
        this.telegramBot = null;
        this.hourlyChecker = null;
        this.setupEnvironment();
    }

    setupEnvironment() {
        this.config = {
            port: process.env.PORT || 3000,
            telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
            adminId: process.env.TELEGRAM_ADMIN_ID || '6080140322',
            mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/nawala-live',
            cronExpression: process.env.CRON_EXPRESSION || '0 * * * *' // Every hour
        };

        if (!this.config.telegramBotToken) {
            console.error('❌ TELEGRAM_BOT_TOKEN is required in environment variables');
            process.exit(1);
        }

        console.log(`   - Web server port: ${this.config.port}`);
        console.log(`   - Admin ID: ${this.config.adminId}`);
        console.log(`   - MongoDB URI: ${this.config.mongoUri}`);
        console.log(`   - Cron expression: ${this.config.cronExpression}`);
    }

    async start() {
        try {
            console.log('Starting Nawala Live Server...\n');

            console.log('Connecting to MongoDB...');
            await DatabaseService.connect(this.config.mongoUri);

            this.webServer = new WebServer(this.config.port);
            this.webServer.start();

            this.telegramBot = new TelegramBot(this.config.telegramBotToken, this.config.adminId);
            this.telegramBot.start();

            this.hourlyChecker = new HourlyChecker([], this.telegramBot);
            this.hourlyChecker.start(this.config.cronExpression);

            console.log('\nNawala Live Server started successfully!');
            console.log(`Web API: http://localhost:${this.config.port}`);
            console.log('Telegram Bot: Online');
            console.log('MongoDB: Connected');

        } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }

    async stop() {
        console.log('\n🛑 Shutting down Nawala Live Server...');
        
        if (this.hourlyChecker) {
            this.hourlyChecker.stop();
        }
        
        if (this.telegramBot) {
            this.telegramBot.stop();
        }
        
        await DatabaseService.disconnect();
        
    }

    async getStatus() {
        return {
            webServer: {
                running: !!this.webServer,
                port: this.config.port
            },
            telegramBot: {
                running: !!this.telegramBot,
                adminId: this.config.adminId
            },
            hourlyChecker: this.hourlyChecker ? await this.hourlyChecker.getStatus() : null,
            database: DatabaseService.getStatus(),
            config: this.config
        };
    }
}

const server = new NawalaLiveServer();

process.on('SIGINT', async () => {
    await server.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
});

process.on('uncaughtException', async (error) => {
    console.error('❌ Uncaught Exception:', error);
    await server.stop();
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    await server.stop();
    process.exit(1);
});

server.start();

module.exports = NawalaLiveServer;
