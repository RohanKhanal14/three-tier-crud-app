const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const promClient = require('prom-client');

// Load environment variables in non-test environments
if (process.env.NODE_ENV !== 'test') {
  require('dotenv').config();
}

// ── Configuration ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/three-tier-crud';
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// ── Express App Setup ──────────────────────────────────────────────────────────
const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());
if (NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ── Prometheus Metrics ─────────────────────────────────────────────────────────
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'crud_app_' });

const httpRequestDuration = new promClient.Histogram({
  name: 'crud_app_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

const httpRequestTotal = new promClient.Counter({
  name: 'crud_app_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

// Metrics middleware – track every request
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route ? req.route.path : req.path;
    const labels = { method: req.method, route, status_code: res.statusCode };
    end(labels);
    httpRequestTotal.inc(labels);
  });
  next();
});

// ── Mongoose Item Schema ───────────────────────────────────────────────────────
const itemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      minlength: [1, 'Item name cannot be empty'],
      maxlength: [200, 'Item name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'in-progress', 'completed'],
        message: 'Status must be pending, in-progress, or completed',
      },
      default: 'pending',
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

const Item = mongoose.model('Item', itemSchema);

// ── Helper: Validate MongoDB ObjectId ──────────────────────────────────────────
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// ── Routes ─────────────────────────────────────────────────────────────────────

// Health check
app.get('/health', async (_req, res) => {
  const mongoStatus =
    mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const status = mongoStatus === 'connected' ? 'healthy' : 'degraded';

  res.status(mongoStatus === 'connected' ? 200 : 503).json({
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoStatus,
  });
});

// Prometheus metrics endpoint
app.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', promClient.register.contentType);
    const metrics = await promClient.register.metrics();
    res.end(metrics);
  } catch (err) {
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

// GET /api/items – list all items (supports ?search= and ?status= query params)
app.get('/api/items', async (req, res) => {
  try {
    const { search, status } = req.query;
    const filter = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (status && ['pending', 'in-progress', 'completed'].includes(status)) {
      filter.status = status;
    }

    const items = await Item.find(filter).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error('Error fetching items:', err.message);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// GET /api/items/:id – get a single item
app.get('/api/items/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID format' });
    }

    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (err) {
    console.error('Error fetching item:', err.message);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// POST /api/items – create a new item
app.post('/api/items', async (req, res) => {
  try {
    const { name, description, status } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Item name is required and cannot be empty' });
    }

    const item = new Item({ name: name.trim(), description, status });
    const saved = await item.save();
    res.status(201).json(saved);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    console.error('Error creating item:', err.message);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// PUT /api/items/:id – update an existing item
app.put('/api/items/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID format' });
    }

    const { name, description, status } = req.body;

    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ error: 'Item name cannot be empty' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;

    const item = await Item.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    console.error('Error updating item:', err.message);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/items/:id – delete an item
app.delete('/api/items/:id', async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid item ID format' });
    }

    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    console.error('Error deleting item:', err.message);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// 404 handler for undefined routes
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler – never expose stack traces in production
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ── MongoDB Connection & Server Start ──────────────────────────────────────────
let server;

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT} [${NODE_ENV}]`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully…`);
  if (server) {
    server.close(async () => {
      await mongoose.connection.close();
      console.log('🛑 Server closed');
      process.exit(0);
    });
  } else {
    await mongoose.connection.close();
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Only start the server when this file is run directly (not when imported for tests)
if (require.main === module) {
  startServer();
}

// Export for testing
module.exports = { app, Item, startServer };
