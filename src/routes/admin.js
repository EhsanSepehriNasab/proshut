const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const { requireAuth } = require('../middleware/auth');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../public/images/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Login
router.get('/login', (req, res) => {
  if (req.session && req.session.admin) return res.redirect('/admin');
  res.render('admin/login', { error: null, layout: false });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const hash = crypto.createHash('sha256').update(password || '').digest('hex');
  const admin = db.prepare('SELECT * FROM admins WHERE username=? AND password=?').get(username, hash);
  if (admin) {
    req.session.admin = { id: admin.id, username: admin.username, name: admin.name };
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'نام کاربری یا رمز عبور اشتباه است.', layout: false });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Dashboard
router.get('/', requireAuth, (req, res) => {
  res.redirect('/admin/dashboard');
});

router.get('/dashboard', requireAuth, (req, res) => {
  const stats = {
    products: db.prepare('SELECT COUNT(*) as c FROM products').get().c,
    unreadContacts: db.prepare('SELECT COUNT(*) as c FROM contacts WHERE is_read=0').get().c,
    openTickets: db.prepare("SELECT COUNT(*) as c FROM support_tickets WHERE status='open'").get().c,
    newsletterSubscribers: db.prepare('SELECT COUNT(*) as c FROM newsletter').get().c,
    totalContacts: db.prepare('SELECT COUNT(*) as c FROM contacts').get().c,
    totalTickets: db.prepare('SELECT COUNT(*) as c FROM support_tickets').get().c,
    blogPosts: db.prepare('SELECT COUNT(*) as c FROM blog_posts').get().c,
    brands: db.prepare('SELECT COUNT(*) as c FROM brands').get().c,
    projects: db.prepare('SELECT COUNT(*) as c FROM projects').get().c,
  };
  const recentContacts = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 5').all();
  const recentTickets = db.prepare('SELECT * FROM support_tickets ORDER BY created_at DESC LIMIT 5').all();
  res.render('admin/dashboard', { stats, recentContacts, recentTickets, page: 'dashboard' });
});

// ── Products ──
router.get('/products', requireAuth, (req, res) => {
  const products = db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id=c.id ORDER BY p.created_at DESC').all();
  const categories = db.prepare('SELECT * FROM categories').all();
  res.render('admin/products', { products, categories, page: 'products' });
});

router.post('/products', requireAuth, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]), (req, res) => {
  const { name, slug, category_id, short_description, description, full_description, specs, tags, sections, product_code, special_status, is_featured, meta_title, meta_description, name_en, short_description_en, description_en, full_description_en, specs_en, tags_en, sections_en, meta_title_en, meta_description_en } = req.body;
  const image = req.files && req.files['image'] ? '/images/uploads/' + req.files['image'][0].filename : '';
  const galleryFiles = req.files && req.files['gallery'] ? req.files['gallery'].map(f => '/images/uploads/' + f.filename) : [];
  const gallery = galleryFiles.length ? JSON.stringify(galleryFiles) : '';
  const finalSlug = slug || name.replace(/\s+/g, '-').toLowerCase();
  db.prepare('INSERT INTO products (name, slug, category_id, image, gallery, short_description, description, full_description, specs, tags, sections, product_code, special_status, is_featured, meta_title, meta_description, name_en, short_description_en, description_en, full_description_en, specs_en, tags_en, sections_en, meta_title_en, meta_description_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(name, finalSlug, category_id, image, gallery, short_description || '', description || '', full_description || '', specs || '', tags || '', sections || '', product_code || '', special_status || '', is_featured ? 1 : 0, meta_title || '', meta_description || '', name_en || '', short_description_en || '', description_en || '', full_description_en || '', specs_en || '', tags_en || '', sections_en || '', meta_title_en || '', meta_description_en || '');
  res.redirect('/admin/products');
});

router.post('/products/:id/edit', requireAuth, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'gallery', maxCount: 10 }]), (req, res) => {
  const { name, slug, category_id, short_description, description, full_description, specs, tags, sections, product_code, special_status, is_featured, is_active, meta_title, meta_description, name_en, short_description_en, description_en, full_description_en, specs_en, tags_en, sections_en, meta_title_en, meta_description_en } = req.body;
  const product = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  const image = req.files && req.files['image'] ? '/images/uploads/' + req.files['image'][0].filename : product.image;
  let existingGallery = [];
  if (product.gallery) { try { existingGallery = JSON.parse(product.gallery); } catch { existingGallery = []; } }
  const newGalleryFiles = req.files && req.files['gallery'] ? req.files['gallery'].map(f => '/images/uploads/' + f.filename) : [];
  const allGallery = [...existingGallery, ...newGalleryFiles];
  const gallery = allGallery.length ? JSON.stringify(allGallery) : '';
  db.prepare('UPDATE products SET name=?, slug=?, category_id=?, image=?, gallery=?, short_description=?, description=?, full_description=?, specs=?, tags=?, sections=?, product_code=?, special_status=?, is_featured=?, is_active=?, meta_title=?, meta_description=?, name_en=?, short_description_en=?, description_en=?, full_description_en=?, specs_en=?, tags_en=?, sections_en=?, meta_title_en=?, meta_description_en=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(name, slug, category_id, image, gallery, short_description || '', description || '', full_description || '', specs || '', tags || '', sections || '', product_code || '', special_status || '', is_featured ? 1 : 0, is_active ? 1 : 0, meta_title || '', meta_description || '', name_en || '', short_description_en || '', description_en || '', full_description_en || '', specs_en || '', tags_en || '', sections_en || '', meta_title_en || '', meta_description_en || '', req.params.id);
  res.redirect('/admin/products');
});

router.post('/products/:id/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  res.redirect('/admin/products');
});

// ── Categories ──
router.get('/categories', requireAuth, (req, res) => {
  const allCats = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  const parentCats = allCats.filter(c => !c.parent_id);
  parentCats.forEach(cat => { cat.subcategories = allCats.filter(c => c.parent_id === cat.id); });
  res.render('admin/categories', { categories: allCats, parentCategories: parentCats, page: 'categories' });
});

router.post('/categories', requireAuth, (req, res) => {
  const { name, slug, icon, description, parent_id, name_en, description_en } = req.body;
  db.prepare('INSERT INTO categories (name, slug, icon, description, parent_id, name_en, description_en) VALUES (?,?,?,?,?,?,?)').run(name, slug || name.replace(/\s+/g, '-'), icon || '', description || '', parent_id || null, name_en || '', description_en || '');
  res.redirect('/admin/categories');
});

router.post('/categories/:id/edit', requireAuth, (req, res) => {
  const { name, slug, icon, description, parent_id, name_en, description_en } = req.body;
  db.prepare('UPDATE categories SET name=?, slug=?, icon=?, description=?, parent_id=?, name_en=?, description_en=? WHERE id=?').run(name, slug, icon || '', description || '', parent_id || null, name_en || '', description_en || '', req.params.id);
  res.redirect('/admin/categories');
});

router.post('/categories/:id/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id);
  res.redirect('/admin/categories');
});

// ── Contacts ──
router.get('/contacts', requireAuth, (req, res) => {
  const contacts = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
  res.render('admin/contacts', { contacts, page: 'contacts' });
});

router.get('/contacts/:id', requireAuth, (req, res) => {
  const contact = db.prepare('SELECT * FROM contacts WHERE id=?').get(req.params.id);
  if (contact && !contact.is_read) db.prepare('UPDATE contacts SET is_read=1 WHERE id=?').run(req.params.id);
  res.render('admin/contact-detail', { contact, page: 'contacts' });
});

router.post('/contacts/:id/note', requireAuth, (req, res) => {
  db.prepare('UPDATE contacts SET admin_note=?, is_replied=1 WHERE id=?').run(req.body.admin_note || req.body.note, req.params.id);
  res.redirect('/admin/contacts/' + req.params.id);
});

router.post('/contacts/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE contacts SET is_read=1 WHERE id=?').run(req.params.id);
  res.redirect('/admin/contacts/' + req.params.id);
});

router.post('/contacts/:id/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id=?').run(req.params.id);
  res.redirect('/admin/contacts');
});

// ── Support Tickets ──
router.get('/tickets', requireAuth, (req, res) => {
  const status = req.query.status || '';
  let tickets;
  if (status) {
    tickets = db.prepare('SELECT * FROM support_tickets WHERE status=? ORDER BY created_at DESC').all(status);
  } else {
    tickets = db.prepare('SELECT * FROM support_tickets ORDER BY created_at DESC').all();
  }
  res.render('admin/tickets', { tickets, currentStatus: status, page: 'tickets' });
});

router.get('/tickets/:id', requireAuth, (req, res) => {
  const ticket = db.prepare('SELECT * FROM support_tickets WHERE id=?').get(req.params.id);
  res.render('admin/ticket-detail', { ticket, page: 'tickets' });
});

router.post('/tickets/:id/reply', requireAuth, (req, res) => {
  const { message, admin_reply } = req.body;
  const reply = admin_reply || message;
  db.prepare('UPDATE support_tickets SET admin_reply=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(reply, 'answered', req.params.id);
  res.redirect('/admin/tickets/' + req.params.id);
});

router.post('/tickets/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE support_tickets SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, req.params.id);
  res.redirect('/admin/tickets/' + req.params.id);
});

// ── Blog ──
router.get('/blog', requireAuth, (req, res) => {
  const posts = db.prepare('SELECT * FROM blog_posts ORDER BY created_at DESC').all();
  res.render('admin/blog', { posts, page: 'blog' });
});

router.post('/blog', requireAuth, upload.single('image'), (req, res) => {
  const { title, slug, excerpt, content, category, meta_title, meta_description, title_en, excerpt_en, content_en, meta_title_en, meta_description_en, category_en } = req.body;
  const image = req.file ? '/images/uploads/' + req.file.filename : '';
  db.prepare('INSERT INTO blog_posts (title, slug, excerpt, content, image, category, meta_title, meta_description, title_en, excerpt_en, content_en, meta_title_en, meta_description_en, category_en) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(title, slug || title.replace(/\s+/g, '-'), excerpt || '', content || '', image, category || 'blog', meta_title || '', meta_description || '', title_en || '', excerpt_en || '', content_en || '', meta_title_en || '', meta_description_en || '', category_en || '');
  res.redirect('/admin/blog');
});

router.post('/blog/:id/edit', requireAuth, upload.single('image'), (req, res) => {
  const { title, slug, excerpt, content, category, meta_title, meta_description, title_en, excerpt_en, content_en, meta_title_en, meta_description_en, category_en } = req.body;
  const post = db.prepare('SELECT * FROM blog_posts WHERE id=?').get(req.params.id);
  const image = req.file ? '/images/uploads/' + req.file.filename : post.image;
  db.prepare('UPDATE blog_posts SET title=?, slug=?, excerpt=?, content=?, image=?, category=?, meta_title=?, meta_description=?, title_en=?, excerpt_en=?, content_en=?, meta_title_en=?, meta_description_en=?, category_en=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(title, slug, excerpt || '', content || '', image, category || 'blog', meta_title || '', meta_description || '', title_en || '', excerpt_en || '', content_en || '', meta_title_en || '', meta_description_en || '', category_en || '', req.params.id);
  res.redirect('/admin/blog');
});

router.post('/blog/:id/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM blog_posts WHERE id=?').run(req.params.id);
  res.redirect('/admin/blog');
});

// ── Sliders ──
router.get('/sliders', requireAuth, (req, res) => {
  const sliders = db.prepare('SELECT * FROM sliders ORDER BY sort_order').all();
  res.render('admin/sliders', { sliders, page: 'sliders' });
});

router.post('/sliders', requireAuth, upload.single('image'), (req, res) => {
  const { title, subtitle, link, sort_order } = req.body;
  const image = req.file ? '/images/uploads/' + req.file.filename : '';
  db.prepare('INSERT INTO sliders (title, subtitle, image, link, sort_order) VALUES (?,?,?,?,?)').run(title, subtitle || '', image, link || '/', sort_order || 0);
  res.redirect('/admin/sliders');
});

router.post('/sliders/:id/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sliders WHERE id=?').run(req.params.id);
  res.redirect('/admin/sliders');
});

// ── Brands ──
router.get('/brands', requireAuth, (req, res) => {
  const brands = db.prepare('SELECT * FROM brands ORDER BY sort_order').all();
  res.render('admin/brands-admin', { brands, page: 'brands' });
});

router.post('/brands', requireAuth, upload.single('logo'), (req, res) => {
  const { name, slug, country, website, description } = req.body;
  const logo = req.file ? '/images/uploads/' + req.file.filename : '';
  db.prepare('INSERT INTO brands (name, slug, logo, country, website, description) VALUES (?,?,?,?,?,?)')
    .run(name, slug || name.toLowerCase().replace(/\s+/g, '-'), logo, country || '', website || '', description || '');
  res.redirect('/admin/brands');
});

router.post('/brands/:id/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM brands WHERE id=?').run(req.params.id);
  res.redirect('/admin/brands');
});

// ── Settings ──
router.get('/settings', requireAuth, (req, res) => {
  res.render('admin/settings', { page: 'settings', success: null });
});

router.post('/settings', requireAuth, (req, res) => {
  const fields = ['company_name', 'company_short', 'phone', 'phone2', 'mobile', 'email', 'address', 'working_hours', 'whatsapp', 'instagram', 'telegram', 'linkedin', 'about_short', 'about_text', 'meta_title', 'meta_description', 'meta_keywords', 'company_name_en', 'company_short_en', 'about_short_en', 'about_text_en', 'address_en', 'working_hours_en', 'meta_title_en', 'meta_description_en', 'about_vision_en'];
  const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  for (const f of fields) {
    if (req.body[f] !== undefined) upsert.run(f, req.body[f]);
  }
  res.render('admin/settings', { page: 'settings', success: 'تنظیمات با موفقیت ذخیره شد.' });
});

// ── Projects ──
router.get('/projects', requireAuth, (req, res) => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY sort_order, created_at DESC').all();
  res.render('admin/projects', { projects, page: 'projects' });
});

router.post('/projects', requireAuth, upload.single('image'), (req, res) => {
  const { title, slug, client, year, description, sort_order, is_active, title_en, client_en, description_en } = req.body;
  const image = req.file ? '/images/uploads/' + req.file.filename : '';
  const finalSlug = slug || title.replace(/\s+/g, '-').toLowerCase();
  db.prepare('INSERT INTO projects (title, slug, client, description, image, year, is_active, sort_order, title_en, client_en, description_en) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(title, finalSlug, client || '', description || '', image, year || '', is_active ? 1 : 0, sort_order || 0, title_en || '', client_en || '', description_en || '');
  res.redirect('/admin/projects');
});

router.post('/projects/:id/edit', requireAuth, upload.single('image'), (req, res) => {
  const { title, slug, client, year, description, sort_order, is_active, title_en, client_en, description_en } = req.body;
  const project = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  const image = req.file ? '/images/uploads/' + req.file.filename : project.image;
  db.prepare('UPDATE projects SET title=?, slug=?, client=?, description=?, image=?, year=?, is_active=?, sort_order=?, title_en=?, client_en=?, description_en=? WHERE id=?')
    .run(title, slug, client || '', description || '', image, year || '', is_active ? 1 : 0, sort_order || 0, title_en || '', client_en || '', description_en || '', req.params.id);
  res.redirect('/admin/projects');
});

router.post('/projects/:id/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
  res.redirect('/admin/projects');
});

// ── Newsletter ──
router.get('/newsletter', requireAuth, (req, res) => {
  const subscribers = db.prepare('SELECT * FROM newsletter ORDER BY created_at DESC').all();
  res.render('admin/newsletter', { subscribers, page: 'newsletter' });
});

// ── Product Comments ──
router.get('/comments', requireAuth, (req, res) => {
  const comments = db.prepare('SELECT pc.*, p.name as product_name, p.slug as product_slug FROM product_comments pc LEFT JOIN products p ON pc.product_id=p.id ORDER BY pc.created_at DESC').all();
  res.render('admin/comments', { comments, page: 'products' });
});

router.post('/comments/:id/approve', requireAuth, (req, res) => {
  db.prepare('UPDATE product_comments SET is_approved=1 WHERE id=?').run(req.params.id);
  res.redirect('/admin/comments');
});

router.post('/comments/:id/reply', requireAuth, (req, res) => {
  const { admin_reply } = req.body;
  if (admin_reply && admin_reply.trim()) {
    db.prepare('UPDATE product_comments SET admin_reply=?, replied_at=CURRENT_TIMESTAMP, is_approved=1 WHERE id=?').run(admin_reply.trim(), req.params.id);
  }
  res.redirect('/admin/comments');
});

router.post('/comments/:id/delete', requireAuth, (req, res) => {
  db.prepare('DELETE FROM product_comments WHERE id=?').run(req.params.id);
  res.redirect('/admin/comments');
});

// ── Upload API ──
router.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  if (req.file) {
    res.json({ ok: true, url: '/images/uploads/' + req.file.filename });
  } else {
    res.json({ ok: false });
  }
});

module.exports = router;
