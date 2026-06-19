const express = require('express');
const router = express.Router();
const db = require('../database');

// Home
router.get('/', (req, res) => {
  const sliders = db.prepare('SELECT * FROM sliders WHERE is_active=1 ORDER BY sort_order').all();
  const services = db.prepare('SELECT * FROM services ORDER BY sort_order').all();
  const featuredProducts = db.prepare('SELECT p.*, c.name as category_name, c.slug as category_slug, c.parent_id as category_parent_id FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.is_featured=1 AND p.is_active=1 ORDER BY p.created_at DESC LIMIT 8').all();
  // Resolve parent slug for subcategory products
  featuredProducts.forEach(p => {
    if (p.category_parent_id) {
      const parent = db.prepare('SELECT slug FROM categories WHERE id=?').get(p.category_parent_id);
      if (parent) p.parent_category_slug = parent.slug;
    }
  });
  const brands = db.prepare('SELECT * FROM brands WHERE is_active=1 ORDER BY sort_order').all();
  const projects = db.prepare('SELECT * FROM projects WHERE is_active=1 ORDER BY sort_order LIMIT 5').all();
  const blogPosts = db.prepare('SELECT * FROM blog_posts WHERE is_published=1 ORDER BY created_at DESC LIMIT 3').all();
  res.locals.localize(featuredProducts, ['name', 'short_description', 'description']);
  res.locals.localize(services, ['title', 'description']);
  res.locals.localize(projects, ['title', 'client', 'description']);
  res.locals.localize(blogPosts, ['title', 'excerpt', 'category']);
  // Localize category_name on featured products
  if (res.locals.isEn) {
    featuredProducts.forEach(p => {
      const cat = res.locals.allCategories.find(c => c.id === p.category_id);
      if (cat && cat.name_en) p.category_name = cat.name_en;
    });
  }
  res.render('pages/index', { sliders, services, featuredProducts, brands, projects, blogPosts, pageTitle: '' });
});

// Products API (JSON)
router.get('/api/products', (req, res) => {
  const categorySlug = req.query.category;
  const subcategorySlug = req.query.sub;
  const allCategories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  const parentCategories = allCategories.filter(c => !c.parent_id);
  parentCategories.forEach(cat => { cat.subcategories = allCategories.filter(c => c.parent_id === cat.id); });

  let activeCategory = null;
  let activeSubcategory = null;
  let whereClause = 'WHERE p.is_active=1';
  const params = [];

  if (subcategorySlug) {
    activeSubcategory = allCategories.find(c => c.slug === subcategorySlug) || null;
    if (activeSubcategory) {
      activeCategory = parentCategories.find(c => c.id === activeSubcategory.parent_id) || null;
      whereClause += ' AND p.category_id=?';
      params.push(activeSubcategory.id);
    }
  } else if (categorySlug) {
    activeCategory = parentCategories.find(c => c.slug === categorySlug) || null;
    if (activeCategory) {
      const subcatIds = allCategories.filter(c => c.parent_id === activeCategory.id).map(c => c.id);
      whereClause += ` AND p.category_id IN (${[activeCategory.id, ...subcatIds].map(() => '?').join(',')})`;
      params.push(activeCategory.id, ...subcatIds);
    }
  }

  const products = db.prepare(`SELECT p.*, c.name as category_name, c.name_en as category_name_en FROM products p LEFT JOIN categories c ON p.category_id=c.id ${whereClause} ORDER BY p.created_at DESC`).all(...params);
  const isEn = res.locals.isEn;
  // Localize
  if (isEn) {
    allCategories.forEach(c => { if (c.name_en) c.name = c.name_en; });
    products.forEach(p => {
      if (p.name_en) p.name = p.name_en;
      if (p.short_description_en) p.short_description = p.short_description_en;
      if (p.category_name_en) p.category_name = p.category_name_en;
    });
  }
  const total = products.length;
  const allProductsLabel = isEn ? 'All Products' : 'همه محصولات';
  const title = activeSubcategory ? activeSubcategory.name : (activeCategory ? activeCategory.name : allProductsLabel);
  const subcategories = activeCategory && activeCategory.subcategories ? activeCategory.subcategories : [];

  res.json({ products, total, title, subcategories, activeCategory, activeSubcategory });
});

// Products
router.get('/products', (req, res) => {
  const categorySlug = req.query.category;
  const subcategorySlug = req.query.sub;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const perPage = 9;
  const offset = (page - 1) * perPage;

  // Build category tree (use localized categories from middleware)
  const allCategories = res.locals.allCategories || db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  const parentCategories = allCategories.filter(c => !c.parent_id);
  parentCategories.forEach(cat => {
    cat.subcategories = allCategories.filter(c => c.parent_id === cat.id);
  });

  let activeCategory = null;
  let activeSubcategory = null;
  let whereClause = 'WHERE p.is_active=1';
  const params = [];

  if (subcategorySlug) {
    activeSubcategory = allCategories.find(c => c.slug === subcategorySlug) || null;
    if (activeSubcategory) {
      // Use parentCategories so activeCategory has .subcategories attached
      activeCategory = parentCategories.find(c => c.id === activeSubcategory.parent_id) || allCategories.find(c => c.id === activeSubcategory.parent_id) || null;
      whereClause += ' AND p.category_id=?';
      params.push(activeSubcategory.id);
    }
  } else if (categorySlug) {
    // Use parentCategories first so .subcategories is attached
    activeCategory = parentCategories.find(c => c.slug === categorySlug) || allCategories.find(c => c.slug === categorySlug) || null;
    if (activeCategory) {
      const subcatIds = allCategories.filter(c => c.parent_id === activeCategory.id).map(c => c.id);
      const catIds = [activeCategory.id, ...subcatIds];
      whereClause += ` AND p.category_id IN (${catIds.map(() => '?').join(',')})`;
      params.push(...catIds);
    }
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM products p ${whereClause}`).get(...params).c;
  const products = db.prepare(`SELECT p.*, c.name as category_name, c.name_en as category_name_en FROM products p LEFT JOIN categories c ON p.category_id=c.id ${whereClause} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`).all(...params, perPage, offset);
  const totalPages = Math.ceil(total / perPage);
  res.locals.localize(products, ['name', 'short_description', 'description']);
  if (res.locals.isEn) products.forEach(p => { if (p.category_name_en) p.category_name = p.category_name_en; });

  const isEn = res.locals.isEn;
  const productsLabel = isEn ? 'Products' : 'محصولات';
  let pageTitle = productsLabel;
  if (activeSubcategory) pageTitle = activeSubcategory.name;
  else if (activeCategory) pageTitle = activeCategory.name;

  const breadcrumbs = [{ label: productsLabel, url: activeCategory || activeSubcategory ? '/products' : null }];
  if (activeCategory) breadcrumbs.push({ label: activeCategory.name, url: activeSubcategory ? `/products?category=${activeCategory.slug}` : null });
  if (activeSubcategory) breadcrumbs.push({ label: activeSubcategory.name, url: null });

  res.render('pages/products', {
    products,
    categories: parentCategories,
    activeCategory,
    activeSubcategory,
    pagination: { page, totalPages, total },
    pageTitle,
    breadcrumbs
  });
});

// Single Product
router.get('/product/:slug', (req, res) => {
  const product = db.prepare('SELECT p.*, c.name as category_name, c.slug as category_slug, c.parent_id as category_parent_id FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.slug=?').get(req.params.slug);
  const isEn = res.locals.isEn;
  if (!product) return res.status(404).render('pages/404', { pageTitle: '404', breadcrumbs: [{ label: isEn ? 'Not Found' : 'صفحه یافت نشد', url: null }] });
  res.locals.localize(product, ['name', 'short_description', 'description', 'full_description', 'specs', 'tags', 'sections', 'meta_title', 'meta_description']);
  if (isEn) {
    const cat = res.locals.allCategories.find(c => c.id === product.category_id);
    if (cat && cat.name_en) product.category_name = cat.name_en;
  }
  db.prepare('UPDATE products SET views=views+1 WHERE id=?').run(product.id);

  // Parse gallery JSON
  let galleryImages = [];
  if (product.gallery) {
    try { galleryImages = JSON.parse(product.gallery); } catch { galleryImages = []; }
  }
  if (product.image && !galleryImages.includes(product.image)) {
    galleryImages = [product.image, ...galleryImages];
  }

  // Parse tags and sections
  const tags = product.tags ? product.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const sections = product.sections ? product.sections.split(',').map(s => s.trim()).filter(Boolean) : [];

  // Get parent category for breadcrumb
  let parentCategory = null;
  if (product.category_parent_id) {
    parentCategory = db.prepare('SELECT * FROM categories WHERE id=?').get(product.category_parent_id);
  }

  const relatedProducts = db.prepare('SELECT * FROM products WHERE category_id=? AND id!=? AND is_active=1 LIMIT 4').all(product.category_id, product.id);
  res.locals.localize(relatedProducts, ['name', 'short_description']);
  if (isEn && parentCategory) res.locals.localize(parentCategory, ['name', 'description']);
  const commentLang = isEn ? 'en' : 'fa';
  const comments = db.prepare('SELECT * FROM product_comments WHERE product_id=? AND is_approved=1 AND (lang=? OR lang IS NULL) ORDER BY created_at DESC').all(product.id, commentLang);

  const productsLabel = isEn ? 'Products' : 'محصولات';
  const breadcrumbs = [{ label: productsLabel, url: '/products' }];
  if (parentCategory) breadcrumbs.push({ label: parentCategory.name, url: `/products?category=${parentCategory.slug}` });
  if (product.category_name) breadcrumbs.push({ label: product.category_name, url: product.category_slug ? `/products?category=${product.category_slug}` : null });
  breadcrumbs.push({ label: product.name, url: null });

  res.render('pages/product', {
    product, galleryImages, tags, sections, parentCategory,
    relatedProducts, comments,
    pageTitle: product.meta_title || product.name,
    commentSuccess: req.query.commented === '1',
    commentError: req.query.error || null,
    breadcrumbs
  });
});

// Submit Comment
router.post('/product/:slug/comment', (req, res) => {
  const product = db.prepare('SELECT id FROM products WHERE slug=?').get(req.params.slug);
  if (!product) return res.redirect('/products');
  const { name, email, comment, rating } = req.body;
  if (!name || !comment) {
    const commentError = res.locals.isEn ? 'Please enter your name and comment' : 'لطفا نام و متن نظر را وارد کنید';
    return res.redirect(`/product/${req.params.slug}?error=${encodeURIComponent(commentError)}#comment-form`);
  }
  const r = Math.min(5, Math.max(1, parseInt(rating) || 5));
  const lang = res.locals.isEn ? 'en' : 'fa';
  db.prepare('INSERT INTO product_comments (product_id, name, email, comment, rating, lang) VALUES (?,?,?,?,?,?)').run(product.id, name, email || '', comment, r, lang);
  res.redirect(`/product/${req.params.slug}?commented=1#comment-form`);
});

// Services
router.get('/services', (req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY sort_order').all();
  res.locals.localize(services, ['title', 'description', 'long_description']);
  const isEn = res.locals.isEn;
  res.render('pages/services', { services, pageTitle: isEn ? 'Our Services' : 'خدمات ما', breadcrumbs: [{ label: isEn ? 'Services' : 'خدمات', url: null }] });
});

// About
router.get('/about', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects WHERE is_active=1 ORDER BY sort_order').all();
  res.locals.localize(projects, ['title', 'client', 'description']);
  const isEn = res.locals.isEn;
  res.render('pages/about', { projects, pageTitle: isEn ? 'About Us' : 'درباره ما', breadcrumbs: [{ label: isEn ? 'About Us' : 'درباره ما', url: null }] });
});

// Contact
router.get('/contact', (req, res) => {
  const isEn = res.locals.isEn;
  res.render('pages/contact', { success: null, error: null, pageTitle: isEn ? 'Contact Us' : 'تماس با ما', breadcrumbs: [{ label: isEn ? 'Contact' : 'تماس با ما', url: null }] });
});

router.post('/contact', (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  const isEn = res.locals.isEn;
  if (!name || !message) {
    return res.render('pages/contact', { success: null, error: isEn ? 'Please enter your name and message.' : 'لطفا نام و پیام خود را وارد کنید.', pageTitle: isEn ? 'Contact Us' : 'تماس با ما', breadcrumbs: [{ label: isEn ? 'Contact' : 'تماس با ما', url: null }] });
  }
  db.prepare('INSERT INTO contacts (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)').run(name, email || '', phone || '', subject || '', message);
  res.render('pages/contact', { success: isEn ? 'Your message was sent successfully. Our team will contact you shortly.' : 'پیام شما با موفقیت ارسال شد. کارشناسان ما در اسرع وقت با شما تماس خواهند گرفت.', error: null, pageTitle: isEn ? 'Contact Us' : 'تماس با ما', breadcrumbs: [{ label: isEn ? 'Contact' : 'تماس با ما', url: null }] });
});

// Brands
router.get('/brands', (req, res) => {
  const brands = db.prepare('SELECT * FROM brands WHERE is_active=1 ORDER BY sort_order').all();
  const isEn = res.locals.isEn;
  res.render('pages/brands', { brands, pageTitle: isEn ? 'Brands' : 'نمایندگی‌ها و برندها', breadcrumbs: [{ label: isEn ? 'Brands' : 'نمایندگی‌ها', url: null }] });
});

// Blog / Academy
router.get('/blog', (req, res) => {
  const posts = db.prepare('SELECT * FROM blog_posts WHERE is_published=1 ORDER BY created_at DESC').all();
  res.locals.localize(posts, ['title', 'excerpt', 'category']);
  const isEn = res.locals.isEn;
  res.render('pages/blog', { posts, pageTitle: isEn ? 'Academy & Articles' : 'آکادمی و مقالات', breadcrumbs: [{ label: isEn ? 'Academy' : 'آکادمی', url: null }] });
});

router.get('/blog/:slug', (req, res) => {
  const post = db.prepare('SELECT * FROM blog_posts WHERE slug=? AND is_published=1').get(req.params.slug);
  const isEn = res.locals.isEn;
  if (!post) return res.status(404).render('pages/404', { pageTitle: '404', breadcrumbs: [{ label: isEn ? 'Not Found' : 'صفحه یافت نشد', url: null }] });
  res.locals.localize(post, ['title', 'excerpt', 'content', 'meta_title', 'meta_description', 'category']);
  db.prepare('UPDATE blog_posts SET views=views+1 WHERE id=?').run(post.id);
  const relatedPosts = db.prepare('SELECT * FROM blog_posts WHERE id!=? AND is_published=1 ORDER BY created_at DESC LIMIT 3').all(post.id);
  res.locals.localize(relatedPosts, ['title', 'excerpt']);
  res.render('pages/blog-single', { post, relatedPosts, pageTitle: post.meta_title || post.title, breadcrumbs: [{ label: isEn ? 'Academy' : 'آکادمی', url: '/blog' }, { label: post.title, url: null }] });
});

// Projects
router.get('/projects', (req, res) => {
  const projects = db.prepare('SELECT * FROM projects WHERE is_active=1 ORDER BY sort_order').all();
  res.locals.localize(projects, ['title', 'client', 'description']);
  const isEn = res.locals.isEn;
  res.render('pages/projects', { projects, pageTitle: isEn ? 'Successful Projects' : 'پروژه‌های موفق', breadcrumbs: [{ label: isEn ? 'Projects' : 'پروژه‌ها', url: null }] });
});

// Support Ticket
router.get('/support', (req, res) => {
  const isEn = res.locals.isEn;
  res.render('pages/support', { success: null, error: null, ticket: null, pageTitle: isEn ? 'Support' : 'پشتیبانی', breadcrumbs: [{ label: isEn ? 'Support' : 'پشتیبانی', url: null }] });
});

router.post('/support', (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  const isEn = res.locals.isEn;
  if (!name || !subject || !message) {
    return res.render('pages/support', { success: null, error: isEn ? 'Please fill in all required fields.' : 'لطفا تمام فیلدهای ضروری را پر کنید.', ticket: null, pageTitle: isEn ? 'Support' : 'پشتیبانی', breadcrumbs: [{ label: isEn ? 'Support' : 'پشتیبانی', url: null }] });
  }
  const ticketNumber = 'TK-' + Date.now().toString(36).toUpperCase();
  db.prepare('INSERT INTO support_tickets (ticket_number, name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?, ?)').run(ticketNumber, name, email || '', phone || '', subject, message);
  const successMsg = isEn ? `Your ticket was submitted successfully. Tracking number: ${ticketNumber}` : `تیکت شما با موفقیت ثبت شد. شماره پیگیری: ${ticketNumber}`;
  res.render('pages/support', { success: successMsg, error: null, ticket: ticketNumber, pageTitle: isEn ? 'Support' : 'پشتیبانی', breadcrumbs: [{ label: isEn ? 'Support' : 'پشتیبانی', url: null }] });
});

router.get('/support/track', (req, res) => {
  const ticketNumber = req.query.ticket;
  const isEn = res.locals.isEn;
  let ticket = null;
  if (ticketNumber) {
    ticket = db.prepare('SELECT * FROM support_tickets WHERE ticket_number=?').get(ticketNumber);
  }
  res.render('pages/support-track', { ticket, ticketNumber, pageTitle: isEn ? 'Track Ticket' : 'پیگیری تیکت', breadcrumbs: [{ label: isEn ? 'Support' : 'پشتیبانی', url: '/support' }, { label: isEn ? 'Track Ticket' : 'پیگیری تیکت', url: null }] });
});

// Newsletter
router.post('/newsletter', (req, res) => {
  const { email } = req.body;
  const isEn = res.locals.isEn;
  if (!email) return res.json({ ok: false, msg: isEn ? 'Email is required.' : 'ایمیل الزامی است.' });
  try {
    db.prepare('INSERT OR IGNORE INTO newsletter (email) VALUES (?)').run(email);
    res.json({ ok: true, msg: isEn ? 'Successfully subscribed to the newsletter.' : 'با موفقیت عضو خبرنامه شدید.' });
  } catch {
    res.json({ ok: false, msg: isEn ? 'Error registering email.' : 'خطا در ثبت ایمیل.' });
  }
});

// Search
router.get('/search', (req, res) => {
  const q = req.query.q || '';
  const isEn = res.locals.isEn;
  let products = [];
  if (q.trim()) {
    products = db.prepare("SELECT p.*, c.name as category_name, c.name_en as category_name_en FROM products p LEFT JOIN categories c ON p.category_id=c.id WHERE p.is_active=1 AND (p.name LIKE ? OR p.name_en LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)").all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    res.locals.localize(products, ['name', 'short_description']);
    if (isEn) products.forEach(p => { if (p.category_name_en) p.category_name = p.category_name_en; });
  }
  res.render('pages/search', { products, query: q, pageTitle: isEn ? `Search: ${q}` : `جستجو: ${q}`, breadcrumbs: [{ label: isEn ? 'Search Results' : 'نتایج جستجو', url: null }] });
});

// Sitemap
router.get('/sitemap.xml', (req, res) => {
  const products = db.prepare('SELECT slug, updated_at FROM products WHERE is_active=1').all();
  const posts = db.prepare('SELECT slug, updated_at FROM blog_posts WHERE is_published=1').all();
  const categories = db.prepare('SELECT slug FROM categories').all();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  const base = `${req.protocol}://${req.get('host')}`;
  const pages = ['', '/products', '/services', '/about', '/contact', '/brands', '/blog', '/projects', '/support'];
  pages.forEach(p => { xml += `<url><loc>${base}${p}</loc><priority>${p === '' ? '1.0' : '0.8'}</priority></url>\n`; });
  categories.forEach(c => { xml += `<url><loc>${base}/products?category=${c.slug}</loc><priority>0.7</priority></url>\n`; });
  products.forEach(p => { xml += `<url><loc>${base}/product/${p.slug}</loc><lastmod>${p.updated_at}</lastmod><priority>0.6</priority></url>\n`; });
  posts.forEach(p => { xml += `<url><loc>${base}/blog/${p.slug}</loc><lastmod>${p.updated_at}</lastmod><priority>0.5</priority></url>\n`; });
  xml += '</urlset>';
  res.type('application/xml').send(xml);
});

// Robots.txt
router.get('/robots.txt', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${base}/sitemap.xml\n`);
});

module.exports = router;
