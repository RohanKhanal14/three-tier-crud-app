const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const { app, Item } = require('../src/server');

let mongoServer;

// ── Setup & Teardown ───────────────────────────────────────────────────────────
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

afterEach(async () => {
  await Item.deleteMany({});
});

// ── Health Endpoint ────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('should return healthy status when MongoDB is connected', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.mongodb).toBe('connected');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
  });
});

// ── Create Item ────────────────────────────────────────────────────────────────
describe('POST /api/items', () => {
  it('should create a new item with valid data', async () => {
    const res = await request(app)
      .post('/api/items')
      .send({ name: 'Test Item', description: 'A test item', status: 'pending' });

    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('Test Item');
    expect(res.body.description).toBe('A test item');
    expect(res.body.status).toBe('pending');
    expect(res.body).toHaveProperty('_id');
    expect(res.body).toHaveProperty('createdAt');
    expect(res.body).toHaveProperty('updatedAt');
  });

  it('should default status to pending when not provided', async () => {
    const res = await request(app)
      .post('/api/items')
      .send({ name: 'Default Status Item' });

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe('pending');
  });

  it('should reject an item with an empty name', async () => {
    const res = await request(app)
      .post('/api/items')
      .send({ name: '', description: 'Missing name' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should reject an item with no name field', async () => {
    const res = await request(app)
      .post('/api/items')
      .send({ description: 'No name at all' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should reject an invalid status value', async () => {
    const res = await request(app)
      .post('/api/items')
      .send({ name: 'Bad Status', status: 'unknown' });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

// ── List Items ─────────────────────────────────────────────────────────────────
describe('GET /api/items', () => {
  beforeEach(async () => {
    await Item.create([
      { name: 'Alpha', description: 'First', status: 'pending' },
      { name: 'Bravo', description: 'Second', status: 'in-progress' },
      { name: 'Charlie', description: 'Third', status: 'completed' },
    ]);
  });

  it('should return all items', async () => {
    const res = await request(app).get('/api/items');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('should filter items by search query', async () => {
    const res = await request(app).get('/api/items?search=Alpha');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Alpha');
  });

  it('should filter items by status', async () => {
    const res = await request(app).get('/api/items?status=completed');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Charlie');
  });
});

// ── Get Single Item ────────────────────────────────────────────────────────────
describe('GET /api/items/:id', () => {
  it('should return a single item by ID', async () => {
    const item = await Item.create({ name: 'Single', description: 'One' });
    const res = await request(app).get(`/api/items/${item._id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('Single');
  });

  it('should return 404 for non-existent item', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/items/${fakeId}`);
    expect(res.statusCode).toBe(404);
  });

  it('should return 400 for invalid ObjectId', async () => {
    const res = await request(app).get('/api/items/invalid-id');
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Invalid item ID format');
  });
});

// ── Update Item ────────────────────────────────────────────────────────────────
describe('PUT /api/items/:id', () => {
  it('should update an existing item', async () => {
    const item = await Item.create({ name: 'Old Name', status: 'pending' });

    const res = await request(app)
      .put(`/api/items/${item._id}`)
      .send({ name: 'New Name', status: 'in-progress' });

    expect(res.statusCode).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.status).toBe('in-progress');
  });

  it('should return 404 when updating non-existent item', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .put(`/api/items/${fakeId}`)
      .send({ name: 'Ghost' });

    expect(res.statusCode).toBe(404);
  });

  it('should reject update with empty name', async () => {
    const item = await Item.create({ name: 'Valid' });

    const res = await request(app)
      .put(`/api/items/${item._id}`)
      .send({ name: '   ' });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Item name cannot be empty');
  });
});

// ── Delete Item ────────────────────────────────────────────────────────────────
describe('DELETE /api/items/:id', () => {
  it('should delete an existing item', async () => {
    const item = await Item.create({ name: 'To Delete' });

    const res = await request(app).delete(`/api/items/${item._id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Item deleted successfully');

    const found = await Item.findById(item._id);
    expect(found).toBeNull();
  });

  it('should return 404 when deleting non-existent item', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).delete(`/api/items/${fakeId}`);
    expect(res.statusCode).toBe(404);
  });

  it('should return 400 for invalid ObjectId', async () => {
    const res = await request(app).delete('/api/items/bad-id');
    expect(res.statusCode).toBe(400);
  });
});

// ── Validation Failures ────────────────────────────────────────────────────────
describe('Validation', () => {
  it('should reject whitespace-only item name', async () => {
    const res = await request(app)
      .post('/api/items')
      .send({ name: '    ' });

    expect(res.statusCode).toBe(400);
  });

  it('should return 404 for unknown routes', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Route not found');
  });
});
