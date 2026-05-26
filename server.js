const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Database Setup ───────────────────────────────────────────
const db = new Database('nextgenwork.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    service TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    price TEXT NOT NULL,
    description TEXT
  );
`);

// Seed services if empty
const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services').get();
if (serviceCount.count === 0) {
  const insertService = db.prepare(
    'INSERT INTO services (category, name, price, description) VALUES (?, ?, ?, ?)'
  );
  const services = [
    ['Video Editing', 'Short Reel (under 60 sec)', '₹500', 'Quick promo reel for Instagram/Facebook'],
    ['Video Editing', 'YouTube Video (5–10 min)', '₹1,500', 'Edited YouTube video with transitions'],
    ['Video Editing', 'Wedding / Event Video', '₹3,000+', 'Full event highlight reel'],
    ['Video Editing', 'Short Film Editing', 'Custom', 'Contact for pricing'],
    ['Web Design', '1 Page Landing Site', '₹3,000', 'Single page promotional website'],
    ['Web Design', '3–5 Page Business Site', '₹7,000', 'Multi page professional website'],
    ['Web Design', 'Full Website + Contact Form', '₹10,000+', 'Complete business website'],
    ['Web Design', 'E-commerce Store', 'Custom', 'Online shop with payment gateway'],
    ['Social Media', '10 Posts / Month', '₹3,000', 'Design and post 10 posts/month'],
    ['Social Media', '20 Posts / Month', '₹5,000', 'Design and post 20 posts/month'],
    ['Social Media', 'Full Page Management', '₹8,000/mo', 'Full Instagram + Facebook management'],
    ['Social Media', 'Ad Campaign Setup', 'Custom', 'Meta ads setup and management'],
  ];
  services.forEach(s => insertService.run(...s));
  console.log('✅ Services seeded to database');
}

// ─── API Routes ───────────────────────────────────────────────

// GET all services
app.get('/api/services', (req, res) => {
  try {
    const services = db.prepare('SELECT * FROM services ORDER BY category, id').all();
    // Group by category
    const grouped = services.reduce((acc, s) => {
      if (!acc[s.category]) acc[s.category] = [];
      acc[s.category].push(s);
      return acc;
    }, {});
    res.json({ success: true, data: grouped });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST submit enquiry
app.post('/api/enquiry', (req, res) => {
  try {
    const { name, phone, email, service, message } = req.body;

    // Validation
    if (!name || !phone || !service || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, phone, service and message are required.'
      });
    }
    if (phone.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid phone number.'
      });
    }

    const insert = db.prepare(
      'INSERT INTO enquiries (name, phone, email, service, message) VALUES (?, ?, ?, ?, ?)'
    );
    const result = insert.run(name, phone, email || '', service, message);

    res.json({
      success: true,
      message: 'Thank you! We will contact you within 24 hours.',
      id: result.lastInsertRowid
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// GET all enquiries (admin)
app.get('/api/admin/enquiries', (req, res) => {
  try {
    const { status, service } = req.query;
    let query = 'SELECT * FROM enquiries';
    const params = [];
    const conditions = [];

    if (status) { conditions.push('status = ?'); params.push(status); }
    if (service) { conditions.push('service = ?'); params.push(service); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC';

    const enquiries = db.prepare(query).all(...params);
    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status='new' THEN 1 ELSE 0 END) as new_count,
        SUM(CASE WHEN status='contacted' THEN 1 ELSE 0 END) as contacted_count,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed_count
      FROM enquiries
    `).get();

    res.json({ success: true, data: enquiries, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH update enquiry status
app.patch('/api/admin/enquiries/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['new', 'contacted', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    db.prepare('UPDATE enquiries SET status = ? WHERE id = ?').run(status, id);
    res.json({ success: true, message: 'Status updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE enquiry
app.delete('/api/admin/enquiries/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM enquiries WHERE id = ?').run(id);
    res.json({ success: true, message: 'Enquiry deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ NextGen Work server running at http://localhost:${PORT}`);
  console.log(`📊 Admin panel at http://localhost:${PORT}/admin.html`);
});