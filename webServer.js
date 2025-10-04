const express = require('express');
const cors = require('cors');
const nawalaService = require('./services/nawalaService');
const domainService = require('./services/domainService');

class WebServer {
    constructor(port = 3000) {
        this.app = express();
        this.port = port;
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                service: 'Nawala Live API'
            });
        });

        this.app.get('/check/:domain', async (req, res) => {
            try {
                const { domain } = req.params;
                
                if (!domain || typeof domain !== 'string') {
                    return res.status(400).json({
                        success: false,
                        error: 'Domain parameter is required'
                    });
                }

                const result = await nawalaService.checkDomains(domain);
                
                if (result.success) {
                    res.json({
                        success: true,
                        domain: domain,
                        blocked: result.data[domain]?.blocked || false,
                        timestamp: result.timestamp
                    });
                } else {
                    res.status(500).json(result);
                }
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.post('/check', async (req, res) => {
            try {
                const { domains } = req.body;
                
                if (!domains || !Array.isArray(domains) || domains.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Domains array is required'
                    });
                }

                if (domains.length > 10) {
                    return res.status(400).json({
                        success: false,
                        error: 'Maximum 10 domains per request'
                    });
                }

                const result = await nawalaService.checkDomains(domains);
                
                if (result.success) {
                    const summary = nawalaService.generateSummaryReport(result);
                    res.json(summary);
                } else {
                    res.status(500).json(result);
                }
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.get('/results', (req, res) => {
            try {
                const results = nawalaService.getAllLastCheckResults();
                res.json({
                    success: true,
                    data: results,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.get('/reports', async (req, res) => {
            try {
                const limit = parseInt(req.query.limit) || 10;
                const reports = await nawalaService.getHourlyReports(limit);
                
                res.json({
                    success: true,
                    data: reports,
                    count: reports.length,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });


        this.app.get('/domains', async (req, res) => {
            try {
                const activeOnly = req.query.active === 'true';
                const domains = await domainService.getAllDomains(activeOnly);
                
                res.json({
                    success: true,
                    data: domains,
                    count: domains.length,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.post('/domains', async (req, res) => {
            try {
                const { name, description, checkFrequency } = req.body;
                
                if (!name) {
                    return res.status(400).json({
                        success: false,
                        error: 'Domain name is required'
                    });
                }

                const domain = await domainService.addDomain(name, description, checkFrequency);
                
                res.status(201).json({
                    success: true,
                    data: domain,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.get('/domains/:name', async (req, res) => {
            try {
                const { name } = req.params;
                const domains = await domainService.getAllDomains();
                const domain = domains.find(d => d.name === name.toLowerCase());
                
                if (!domain) {
                    return res.status(404).json({
                        success: false,
                        error: 'Domain not found'
                    });
                }

                res.json({
                    success: true,
                    data: domain,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.patch('/domains/:name/toggle', async (req, res) => {
            try {
                const { name } = req.params;
                const domain = await domainService.toggleDomainStatus(name);
                
                res.json({
                    success: true,
                    data: domain,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.delete('/domains/:name', async (req, res) => {
            try {
                const { name } = req.params;
                const domain = await domainService.deleteDomain(name);
                
                res.json({
                    success: true,
                    data: domain,
                    message: 'Domain deleted successfully',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.get('/domains/:name/history', async (req, res) => {
            try {
                const { name } = req.params;
                const limit = parseInt(req.query.limit) || 50;
                const history = await domainService.getDomainHistory(name, limit);
                
                res.json({
                    success: true,
                    data: history,
                    count: history.length,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.get('/domains/stats', async (req, res) => {
            try {
                const stats = await domainService.getDomainStatistics();
                
                res.json({
                    success: true,
                    data: stats,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.get('/', (req, res) => {
            res.json({
                service: 'Nawala Live API',
                version: '2.0.0',
                description: 'Domain blocking checker service with MongoDB backend',
                endpoints: {
                    'Health & Status': {
                        'GET /health': 'Health check',
                        'GET /domains/stats': 'Domain statistics'
                    },
                    'Domain Checking': {
                        'GET /check/:domain': 'Check single domain',
                        'POST /check': 'Check multiple domains (max 10)',
                        'GET /results': 'Get last check results',
                        'GET /reports': 'Get hourly reports'
                    },
                    'Domain Management': {
                        'GET /domains': 'Get all domains',
                        'POST /domains': 'Add new domain',
                        'GET /domains/:name': 'Get domain by name',
                        'PATCH /domains/:name/toggle': 'Toggle domain active status',
                        'DELETE /domains/:name': 'Delete domain',
                        'GET /domains/:name/history': 'Get domain check history'
                    },
                    'Documentation': {
                        'GET /': 'API documentation'
                    }
                },
                examples: {
                    'Check single domain': 'GET /check/example.com',
                    'Check multiple domains': {
                        'POST /check': {
                            domains: ['example.com', 'reddit.com']
                        }
                    },
                    'Add domain': {
                        'POST /domains': {
                            name: 'example.com',
                            description: 'Test domain',
                            checkFrequency: 'hourly'
                        }
                    },
                    'Get active domains only': 'GET /domains?active=true'
                }
            });
        });

        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found',
                timestamp: new Date().toISOString()
            });
        });

        this.app.use((error, req, res, next) => {
            console.error('Server error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                timestamp: new Date().toISOString()
            });
        });
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`Web server running on port ${this.port}`);
            console.log(`API documentation: http://localhost:${this.port}`);
        });
    }

    getApp() {
        return this.app;
    }
}

module.exports = WebServer;
