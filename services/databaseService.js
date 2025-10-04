const mongoose = require('mongoose');

class DatabaseService {
    constructor() {
        this.isConnected = false;
        this.connection = null;
    }

    /**
     * Connect to MongoDB
     * @param {string} mongoUri - MongoDB connection URI
     */
    async connect(mongoUri) {
        try {
            if (this.isConnected) {
                return;
            }
            
            this.connection = await mongoose.connect(mongoUri);

            this.isConnected = true;

            mongoose.connection.on('error', (error) => {
                console.error('MongoDB connection error:', error);
                this.isConnected = false;
            });

            mongoose.connection.on('disconnected', () => {
                this.isConnected = false;
            });

            mongoose.connection.on('reconnected', () => {
                this.isConnected = true;
            });

        } catch (error) {
            console.error('❌ Failed to connect to MongoDB:', error);
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Disconnect from MongoDB
     */
    async disconnect() {
        try {
            if (this.connection) {
                await mongoose.disconnect();
                this.isConnected = false;
            }
        } catch (error) {
            console.error('❌ Error disconnecting from MongoDB:', error);
        }
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            readyState: mongoose.connection.readyState,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
        };
    }

    /**
     * Check if database is ready
     */
    isReady() {
        return this.isConnected && mongoose.connection.readyState === 1;
    }

    /**
     * Get mongoose connection
     */
    getConnection() {
        return mongoose.connection;
    }
}

module.exports = new DatabaseService();
