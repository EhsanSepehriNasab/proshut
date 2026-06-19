const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const db = new Database(path.join(__dirname, '..', 'proshut.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Schema ──
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sliders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subtitle TEXT,
    image TEXT,
    link TEXT,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT,
    image TEXT,
    description TEXT,
    parent_id INTEGER DEFAULT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    category_id INTEGER,
    image TEXT,
    gallery TEXT,
    short_description TEXT DEFAULT '',
    description TEXT,
    full_description TEXT DEFAULT '',
    specs TEXT,
    tags TEXT DEFAULT '',
    sections TEXT DEFAULT '',
    product_code TEXT DEFAULT '',
    special_status TEXT DEFAULT '',
    is_featured INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    meta_title TEXT,
    meta_description TEXT,
    views INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS product_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    comment TEXT NOT NULL,
    rating INTEGER DEFAULT 5,
    is_approved INTEGER DEFAULT 0,
    admin_reply TEXT,
    replied_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    long_description TEXT,
    icon TEXT,
    image TEXT,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo TEXT,
    country TEXT,
    website TEXT,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT,
    image TEXT,
    category TEXT DEFAULT 'blog',
    meta_title TEXT,
    meta_description TEXT,
    is_published INTEGER DEFAULT 1,
    views INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    subject TEXT,
    message TEXT,
    is_read INTEGER DEFAULT 0,
    is_replied INTEGER DEFAULT 0,
    admin_note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS newsletter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    client TEXT,
    description TEXT,
    image TEXT,
    gallery TEXT,
    year TEXT,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS support_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    priority TEXT DEFAULT 'normal',
    admin_reply TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── Migrations for existing installations ──
const productCols = db.prepare("PRAGMA table_info(products)").all().map(c => c.name);
const productMigrations = [
  ['short_description', 'ALTER TABLE products ADD COLUMN short_description TEXT DEFAULT ""'],
  ['full_description',  'ALTER TABLE products ADD COLUMN full_description TEXT DEFAULT ""'],
  ['tags',             'ALTER TABLE products ADD COLUMN tags TEXT DEFAULT ""'],
  ['sections',         'ALTER TABLE products ADD COLUMN sections TEXT DEFAULT ""'],
  ['product_code',     'ALTER TABLE products ADD COLUMN product_code TEXT DEFAULT ""'],
  ['special_status',   'ALTER TABLE products ADD COLUMN special_status TEXT DEFAULT ""'],
];
for (const [col, sql] of productMigrations) {
  if (!productCols.includes(col)) db.exec(sql);
}

const catCols = db.prepare("PRAGMA table_info(categories)").all().map(c => c.name);
if (!catCols.includes('parent_id')) {
  db.exec('ALTER TABLE categories ADD COLUMN parent_id INTEGER DEFAULT NULL');
}

const commentCols = db.prepare("PRAGMA table_info(product_comments)").all().map(c => c.name);
if (!commentCols.includes('admin_reply')) {
  db.exec('ALTER TABLE product_comments ADD COLUMN admin_reply TEXT');
}
if (!commentCols.includes('replied_at')) {
  db.exec('ALTER TABLE product_comments ADD COLUMN replied_at DATETIME');
}
if (!commentCols.includes('lang')) {
  db.exec("ALTER TABLE product_comments ADD COLUMN lang TEXT DEFAULT 'fa'");
}

// English columns for products
const enProductCols = ['name_en','short_description_en','description_en','full_description_en','specs_en','tags_en','sections_en','meta_title_en','meta_description_en'];
enProductCols.forEach(col => { if (!productCols.includes(col)) db.exec(`ALTER TABLE products ADD COLUMN ${col} TEXT DEFAULT ''`); });

// English columns for categories
if (!catCols.includes('name_en')) db.exec("ALTER TABLE categories ADD COLUMN name_en TEXT DEFAULT ''");
if (!catCols.includes('description_en')) db.exec("ALTER TABLE categories ADD COLUMN description_en TEXT DEFAULT ''");

// English columns for blog_posts
const blogCols = db.prepare("PRAGMA table_info(blog_posts)").all().map(c => c.name);
['title_en','excerpt_en','content_en','meta_title_en','meta_description_en','category_en'].forEach(col => {
  if (!blogCols.includes(col)) db.exec(`ALTER TABLE blog_posts ADD COLUMN ${col} TEXT DEFAULT ''`);
});

// English columns for projects
const projCols = db.prepare("PRAGMA table_info(projects)").all().map(c => c.name);
['title_en','client_en','description_en'].forEach(col => {
  if (!projCols.includes(col)) db.exec(`ALTER TABLE projects ADD COLUMN ${col} TEXT DEFAULT ''`);
});

// English columns for services
const svcCols = db.prepare("PRAGMA table_info(services)").all().map(c => c.name);
['title_en','description_en','long_description_en'].forEach(col => {
  if (!svcCols.includes(col)) db.exec(`ALTER TABLE services ADD COLUMN ${col} TEXT DEFAULT ''`);
});

// ── Seed Data ──
function seedIfEmpty(table, seedFn) {
  const count = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get().c;
  if (count === 0) seedFn();
}

// Admin
seedIfEmpty('admins', () => {
  const hash = crypto.createHash('sha256').update('admin123').digest('hex');
  db.prepare('INSERT INTO admins (username, password, name) VALUES (?, ?, ?)').run('admin', hash, 'مدیر سایت');
});

// Settings
seedIfEmpty('settings', () => {
  const s = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  const settings = {
    company_name: 'شرکت شهر و اندیشه پروشات آریا',
    company_short: 'پروشات',
    company_en: 'Proshut Aria',
    phone: '+98 915 311 1614',
    phone2: '',
    mobile: '+98 915 311 1614',
    fax: '',
    email: 'info@proshut.com',
    address: 'مشهد، گذرگاه پیامبر اعظم، بین پیامبر اعظم ۴۷ و ۴۹',
    postal_code: '1234567890',
    working_hours: 'شنبه تا پنجشنبه ۸ صبح تا ۵ عصر',
    whatsapp: '989153111614',
    instagram: 'https://www.instagram.com/proshutaria/',
    telegram: 'https://t.me/proshutaria',
    linkedin: 'https://linkedin.com/company/proshut',
    aparat: 'https://aparat.com/proshut',
    about_short: 'شرکت شهر و اندیشه پروشات آریا با سال‌ها تجربه در زمینه طراحی، تولید و نصب زمین‌های بازی کودکان و مخازن زباله مکانیزه شهری، همواره پیشرو در زیباسازی فضاهای شهری بوده است.',
    about_text: 'با یاد خدای بیکران\nشرکت شهر و اندیشه پروشات آریا فعالیت خود را از سال ۱۳۸۸ در شهر مقدس مشهد برای اولین بار در زمینه تولید و تامین تجهیزات بازی کودکان (پلی‌اتیلن استاندارد) و مبلمان شهری و همچنین خدمات شهری (مخازن زباله مکانیزه) در ایران عزیزمان آغاز به کار نموده و با تجربه و دانش حدود دو دهه فعالیت در این حوزه اینک مفتخریم بیش از ۱۰ هزار بوستان در سراسر میهنمان و همچنین در کشورهای ارمنستان، عراق، افغانستان، تاجیکستان، ترکمنستان و... تجهیز و صادر نموده‌ایم.\n\nامیر عباس حیات‌بخش\nمدیر عامل و عضو هیئت مدیره',
    about_mission: 'طراحی و تولید مبلمان شهری با کیفیت بین‌المللی برای ارتقای زیبایی و کارایی فضاهای عمومی',
    about_vision: 'تبدیل شدن به برند اول مبلمان شهری و زمین‌های بازی کودکان در خاورمیانه',
    years_experience: '۱۵+',
    happy_clients: '۳۰۰+',
    projects_done: '۵۰۰+',
    team_members: '۵۰+',
    meta_title: 'پروشات آریا | مبلمان شهری، زمین‌های بازی کودکان و وسایل بازی',
    meta_description: 'شرکت پروشات آریا - تولیدکننده مبلمان شهری، نیمکت پارکی، سطل زباله، وسایل بازی کودکان، آلاچیق و تجهیزات فضای سبز با کیفیت بالا',
    meta_keywords: 'مبلمان شهری، نیمکت پارک، سطل زباله شهری، وسایل بازی کودکان، زمین‌های بازی کودکان، آلاچیق، پروشات آریا، تجهیزات فضای سبز',
  };
  for (const [k, v] of Object.entries(settings)) s.run(k, v);
});

// Sliders
seedIfEmpty('sliders', () => {
  const s = db.prepare('INSERT INTO sliders (title, subtitle, image, link, sort_order) VALUES (?, ?, ?, ?, ?)');
  s.run('مبلمان شهری پروشات', 'طراحی و تولید انواع مبلمان شهری با کیفیت بالا', '/images/sliders/slide1.jpg', '/products', 1);
  s.run('وسایل بازی پارکی', 'تجهیزات بازی ایمن و استاندارد برای کودکان', '/images/sliders/slide2.jpg', '/products?category=playground-equipment', 2);
  s.run('زیباسازی فضاهای شهری', 'نیمکت، سطل زباله و زمین‌های بازی کودکان مدرن', '/images/sliders/slide3.jpg', '/products?category=park-benches', 3);
});

// Categories (with subcategories) — based on products.md
seedIfEmpty('categories', () => {
  const s = db.prepare('INSERT INTO categories (name, slug, icon, description, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)');

  // 1. مخزن زباله مکانیزه شهری
  s.run('مخزن زباله مکانیزه شهری', 'mechanized-waste-bin', 'fas fa-dumpster', 'انواع مخازن زباله مکانیزه شهری', null, 1);
  const c1 = db.prepare("SELECT id FROM categories WHERE slug='mechanized-waste-bin'").get();
  s.run('گالوانیزه', 'bin-galvanized', 'fas fa-dumpster', 'مخازن زباله گالوانیزه', c1.id, 1);
  s.run('پلی اتیلن', 'bin-polyethylene', 'fas fa-dumpster', 'مخازن زباله پلی اتیلن', c1.id, 2);
  s.run('زیر مخزنی', 'bin-under', 'fas fa-dumpster', 'مخازن زباله زیر مخزنی', c1.id, 3);
  s.run('چرخ مخزن زباله', 'bin-wheel', 'fas fa-dumpster', 'چرخ و قطعات مخزن زباله', c1.id, 4);

  // 2. نیمکت و سطل زباله پارکی
  s.run('نیمکت و سطل زباله پارکی', 'park-bench-bin', 'fas fa-chair', 'نیمکت و سطل زباله برای پارک‌ها', null, 2);
  const c2 = db.prepare("SELECT id FROM categories WHERE slug='park-bench-bin'").get();
  s.run('چدنی', 'bench-cast-iron', 'fas fa-chair', 'نیمکت و سطل زباله چدنی', c2.id, 1);
  s.run('فلزی', 'bench-metal', 'fas fa-chair', 'نیمکت و سطل زباله فلزی', c2.id, 2);

  // 3. مجموعه بازی کودکان پلی اتیلن
  s.run('مجموعه بازی کودکان پلی اتیلن', 'kids-playground', 'fas fa-child', 'وسایل و مجموعه‌های بازی کودکان', null, 3);
  const c3 = db.prepare("SELECT id FROM categories WHERE slug='kids-playground'").get();
  s.run('مجموعه بازی کودکان ترکیبی', 'combo-playground', 'fas fa-child', 'مجموعه‌های بازی ترکیبی', c3.id, 1);
  s.run('تاب', 'swing', 'fas fa-child', 'انواع تاب', c3.id, 2);
  s.run('الاکلنگ', 'seesaw', 'fas fa-child', 'انواع الاکلنگ', c3.id, 3);
  s.run('بازی های تور و طناب', 'net-rope-play', 'fas fa-child', 'تجهیزات بازی تور و طناب', c3.id, 4);
  s.run('مهد کودکی و خانگی', 'nursery-home', 'fas fa-child', 'وسایل بازی مهد کودک و خانگی', c3.id, 5);
  s.run('صخره نوردی', 'climbing', 'fas fa-child', 'دیوار و صخره مصنوعی', c3.id, 6);

  // 4. کف پوش ایمنی
  s.run('کف پوش ایمنی', 'safety-flooring', 'fas fa-layer-group', 'انواع کف پوش ایمنی', null, 4);
  const c4 = db.prepare("SELECT id FROM categories WHERE slug='safety-flooring'").get();
  s.run('گرانولی', 'flooring-granule', 'fas fa-layer-group', 'کف پوش گرانولی', c4.id, 1);
  s.run('تاتامی', 'flooring-tatami', 'fas fa-layer-group', 'کف پوش تاتامی', c4.id, 2);
  s.run('ورزشی', 'flooring-sport', 'fas fa-layer-group', 'کف پوش ورزشی', c4.id, 3);

  // 5. پایه چراغ روشنایی (no subs)
  s.run('پایه چراغ روشنایی', 'light-pole', 'fas fa-lightbulb', 'پایه و ستون چراغ روشنایی', null, 5);

  // 6. چمن مصنوعی
  s.run('چمن مصنوعی', 'artificial-grass', 'fas fa-leaf', 'انواع چمن مصنوعی', null, 6);
  const c6 = db.prepare("SELECT id FROM categories WHERE slug='artificial-grass'").get();
  s.run('فوتبالی', 'grass-football', 'fas fa-futbol', 'چمن مصنوعی فوتبالی', c6.id, 1);
  s.run('تزیینی', 'grass-decorative', 'fas fa-leaf', 'چمن مصنوعی تزیینی', c6.id, 2);

  // 7. المان شهری (no subs)
  s.run('المان شهری', 'urban-element', 'fas fa-city', 'المان‌های تزیینی شهری', null, 7);

  // 8. دستگاه بدنسازی
  s.run('دستگاه بدنسازی', 'fitness-equipment', 'fas fa-dumbbell', 'دستگاه‌های بدنسازی پارکی و سالنی', null, 8);
  const c8 = db.prepare("SELECT id FROM categories WHERE slug='fitness-equipment'").get();
  s.run('پارکی فضای باز', 'outdoor-fitness', 'fas fa-dumbbell', 'دستگاه بدنسازی فضای باز', c8.id, 1);
  s.run('فضای بسته', 'indoor-fitness', 'fas fa-dumbbell', 'دستگاه بدنسازی فضای بسته', c8.id, 2);
});

// Products
seedIfEmpty('products', () => {
  const s = db.prepare('INSERT INTO products (name, slug, category_id, image, short_description, description, full_description, specs, tags, sections, product_code, special_status, is_featured, meta_title, meta_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const getCatId = slug => db.prepare("SELECT id FROM categories WHERE slug=?").get(slug).id;
  const P = (name,slug,cat,img,short,desc,full,specs,tags,secs,code,status,feat,mt,md) => s.run(name,slug,getCatId(cat),img,short,desc,full,specs,tags,secs,code,status,feat,mt,md);

  // ── مخزن زباله گالوانیزه (1 item) ──
  P('مخزن زباله فلزی مکعب ۱۱۰۰ لیتر','metal-bin-1100','bin-galvanized','https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=600&q=80','مخزن زباله فلزی ۱۱۰۰ لیتری گالوانیزه، مناسب شهرداری‌ها و کارخانجات.','مخزن زباله فلزی مکعب ۱۱۰۰ لیتری از ورق ۲ میلیمتر گالوانیزه.','<p>مخزن زباله فلزی مکعب از ورق ۲ میلیمتر گالوانیزه گرم نورد شده.</p><h5>مزایا:</h5><ul><li>شاسی پروفیل در بالا و پایین</li><li>ضربه‌گیر مقاوم</li><li>گوشواره‌های جوش‌شده</li></ul>','ظرفیت|1100 لیتر|ضخامت ورق|2 میلیمتر|چرخ|4 عدد (2 قفل‌دار)|وزن|95 کیلوگرم|جنس|گالوانیزه','مخزن زباله,گالوانیزه,شهرداری,مخزن فلزی','مخزن زباله صنعتی','TB-G-1100','',1,'مخزن زباله فلزی ۱۱۰۰ لیتر | پروشات','مخزن زباله فلزی گالوانیزه ۱۱۰۰ لیتر');

  // ── مخزن زباله پلی اتیلن (1 item) ──
  P('مخزن زباله پلی‌اتیلنی ۶۶۰ لیتر','polyethylene-bin-660','bin-polyethylene','https://images.unsplash.com/photo-1604187351574-c75ca79f5807?w=600&q=80','مخزن پلاستیکی ۶۶۰ لیتری مقاوم در برابر اشعه UV و ضربه.','مخزن پلی‌اتیلنی با چرخ‌های لاستیکی و درب لولایی.','<p>ساخته شده از پلی‌اتیلن سنگین (HDPE) به روش قالب‌گیری تزریقی. مقاوم در برابر مواد شیمیایی و شرایط جوی.</p>','ظرفیت|660 لیتر|جنس|HDPE پلی‌اتیلن سنگین|چرخ|4 لاستیکی|مقاومت UV|دارد|وزن|48 کیلوگرم','مخزن پلاستیکی,پلی اتیلن,سطل زباله','مخزن زباله پلاستیکی','TB-PE-660','',1,'مخزن پلی‌اتیلنی ۶۶۰ لیتر | پروشات','مخزن زباله پلی‌اتیلنی ۶۶۰ لیتر');

  // ── مخزن زیر مخزنی (1 item) ──
  P('مخزن زباله زیرزمینی ۵ مترمکعب','underground-bin-5m','bin-under','https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80','سیستم مخزن زباله زیرزمینی با ظرفیت ۵ مترمکعب، زیباسازی فضای شهری.','مخزن زیرزمینی با سیستم بالابر هیدرولیکی برای تخلیه توسط کامیون.','<p>سیستم دفن زباله زیرزمینی با ظرفیت بالا. فقط دریچه ورودی در سطح خیابان نمایان است.</p><h5>مزایا:</h5><ul><li>حذف بوی نامطبوع</li><li>زیباسازی منظر شهری</li><li>کاهش دفعات تخلیه</li></ul>','ظرفیت|5000 لیتر|عمق نصب|2.5 متر|سیستم تخلیه|هیدرولیکی|جنس|فولاد ضد زنگ|عمر مفید|25+ سال','مخزن زیرزمینی,زباله شهری,مدرن','مخزن زباله شهری','TB-UG-5M','',1,'مخزن زیرزمینی ۵ مترمکعب | پروشات','مخزن زباله زیرزمینی ۵ مترمکعب');

  // ── چرخ مخزن (1 item) ──
  P('چرخ مخزن زباله ۲۰۰ میلیمتر','bin-wheel-200mm','bin-wheel','https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80','چرخ یدکی مخزن زباله قطر ۲۰۰ میلیمتر با بلبرینگ صنعتی.','چرخ لاستیکی ۲۰۰ میلیمتر با رینگ فلزی و بلبرینگ.','<p>چرخ یدکی مناسب مخازن ۷۷۰ و ۱۱۰۰ لیتری. بلبرینگ صنعتی با عمر بالا.</p>','قطر|200 میلیمتر|نوع|لاستیکی با رینگ فلزی|بلبرینگ|صنعتی|تحمل بار|200 کیلوگرم','چرخ مخزن,قطعات یدکی,چرخ زباله','قطعات یدکی','TB-WH-200','',1,'چرخ مخزن زباله ۲۰۰ میلیمتر | پروشات','چرخ یدکی مخزن زباله');

  // ── نیمکت فلزی (1 item) ──
  P('نیمکت پارکی چوب و فلز مدل رویال','park-bench-royal','bench-metal','https://images.unsplash.com/photo-1572204292164-b35ba943fca7?w=600&q=80','نیمکت پارکی با بدنه فلزی گالوانیزه و نشیمن چوب ترمو.','نیمکت رویال با طراحی ارگونومیک، مقاوم در برابر شرایط آب و هوایی.','<p>ترکیب فولاد گالوانیزه و چوب ترموود. مقاوم در برابر خوردگی و زنگ‌زدگی.</p>','بدنه|فولاد گالوانیزه|نشیمن|چوب ترموود|ابعاد|180x60x80 cm|وزن|45 kg|ظرفیت|3 نفر','نیمکت,پارکی,چوب و فلز,مبلمان شهری','مبلمان شهری','PB-M-ROYAL','',1,'نیمکت پارکی رویال | پروشات','نیمکت پارکی چوب و فلز رویال');

  // ── نیمکت چدنی (1 item) ──
  P('نیمکت چدنی کلاسیک مدل ویکتوریا','bench-victoria','bench-cast-iron','https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=600&q=80','نیمکت چدنی با طرح کلاسیک ویکتوریایی و نشیمن چوبی.','نیمکت چدنی با پایه‌های طرح‌دار و نشیمن چوب روسی.','<p>پایه‌های چدنی با طرح کلاسیک ویکتوریایی. نشیمن از چوب روسی آغشته به روغن.</p>','پایه|چدن|نشیمن|چوب روسی|ابعاد|160x55x75 cm|وزن|60 kg','نیمکت چدنی,کلاسیک,ویکتوریا','مبلمان شهری','PB-CI-VIC','',1,'نیمکت چدنی ویکتوریا | پروشات','نیمکت چدنی کلاسیک ویکتوریا');

  // ── مجموعه بازی ترکیبی (1 item) ──
  P('مجموعه بازی کودکان پارک شادی','playground-park-shadi','combo-playground','https://images.unsplash.com/photo-1596997000103-e597b3ca50df?w=600&q=80','مجموعه بازی کامل شامل سرسره، تاب، پل معلق و برج صعود.','مجموعه بازی ترکیبی مناسب کودکان ۳ تا ۱۲ سال، مطابق EN 1176.','<p>شامل سرسره، تاب، پل معلق و برج صعود. تمام مواد مطابق استانداردهای EN 1176.</p>','رده سنی|3 تا 12 سال|ابعاد|8x6x3.5 متر|سازه|فولاد گالوانیزه|سرسره|پلی‌اتیلن|استاندارد|EN 1176','مجموعه بازی,سرسره,تاب,پارک کودک','وسایل بازی کودکان','PG-C-SHADI','',1,'مجموعه بازی پارک شادی | پروشات','مجموعه بازی کودکان پارک شادی');

  // ── تاب (1 item) ──
  P('تاب دو نفره فلزی','double-swing-metal','swing','https://images.unsplash.com/photo-1575783970733-1aaedde1db74?w=600&q=80','تاب دو نفره با سازه فلزی مستحکم و صندلی ایمنی‌دار.','تاب دو نفره فلزی با صندلی EVA ضدضربه.','<p>سازه لوله فولادی ضخیم با صندلی EVA ضدضربه. مناسب پارک‌ها و مهدکودک‌ها.</p>','ظرفیت|2 نفر|سازه|لوله فولادی 3mm|ارتفاع|2.5 متر|صندلی|EVA ضد ضربه','تاب,فلزی,پارکی,دو نفره','وسایل بازی کودکان','SW-DBL-001','',1,'تاب دو نفره فلزی | پروشات','تاب دو نفره فلزی پارکی');

  // ── الاکلنگ (1 item) ──
  P('الاکلنگ فنری دو نفره','spring-seesaw-double','seesaw','https://images.unsplash.com/photo-1564429238961-244d2be59e1e?w=600&q=80','الاکلنگ فنری دو نفره با فنر صنعتی ضد خستگی.','الاکلنگ فنری با بدنه پلی‌اتیلن و فنر فولادی مقاوم.','<p>بدنه پلی‌اتیلنی با طرح حیوانات. فنر فولادی با عمر بالا و دسته‌های ایمنی.</p>','ظرفیت|2 نفر|رده سنی|3 تا 8 سال|فنر|فولاد ضد خستگی|بدنه|پلی‌اتیلن','الاکلنگ,فنری,وسایل بازی','وسایل بازی کودکان','SS-SPR-002','',1,'الاکلنگ فنری | پروشات','الاکلنگ فنری دو نفره');

  // ── بازی تور و طناب (1 item) ──
  P('برج صعود طنابی مدل اسپایدر','rope-climb-spider','net-rope-play','https://images.unsplash.com/photo-1564429238961-244d2be59e1e?w=600&q=80','برج صعود طنابی با شبکه تور برای تقویت مهارت‌های حرکتی.','برج تور و طناب با ارتفاع ۳ متر، مناسب کودکان ماجراجو.','<p>شبکه طنابی با گره‌های ایمنی. سازه فولادی گالوانیزه و طناب پلی‌آمید UV مقاوم.</p>','ارتفاع|3 متر|طناب|پلی‌آمید UV مقاوم|سازه|فولاد گالوانیزه|رده سنی|5 تا 14 سال','برج طنابی,تور بازی,صعود','وسایل بازی کودکان','NR-SPDR-001','',1,'برج صعود طنابی | پروشات','برج صعود طنابی اسپایدر');

  // ── مهد کودکی و خانگی (1 item) ──
  P('سرسره خانگی کودک مدل خرسی','home-slide-bear','nursery-home','https://images.unsplash.com/photo-1596997000103-e597b3ca50df?w=600&q=80','سرسره پلاستیکی خانگی با طرح خرس، مناسب فضای داخلی.','سرسره کوچک پلی‌اتیلنی برای استفاده در منزل و مهدکودک.','<p>جنس پلی‌اتیلن بدون BPA. قابل جمع‌شدن و حمل آسان.</p>','رده سنی|1 تا 5 سال|ارتفاع|80 cm|جنس|پلی‌اتیلن بدون BPA|وزن|8 kg','سرسره خانگی,مهدکودک,کودک','وسایل بازی خانگی','NH-SLD-BEAR','',1,'سرسره خانگی کودک | پروشات','سرسره پلاستیکی خانگی کودک');

  // ── صخره‌نوردی (1 item) ──
  P('دیوار صخره‌نوردی مصنوعی ۳ متری','climbing-wall-3m','climbing','https://images.unsplash.com/photo-1564769662533-4f00a87b4056?w=600&q=80','دیوار صخره‌نوردی مصنوعی ارتفاع ۳ متر برای پارک‌ها.','دیوار صخره‌نوردی با دستگیره‌های رنگی و سطح ضد لغزش.','<p>پنل‌های فایبرگلاس با دستگیره‌های پلی‌اورتان. قابل نصب در فضای باز و بسته.</p>','ارتفاع|3 متر|عرض|2.5 متر|جنس پنل|فایبرگلاس|دستگیره|پلی‌اورتان|استاندارد|EN 12572','صخره نوردی,دیوار صعود,ورزشی','وسایل بازی کودکان','CL-WALL-3M','',1,'دیوار صخره‌نوردی | پروشات','دیوار صخره‌نوردی مصنوعی');

  // ── کفپوش گرانولی (1 item) ──
  P('کفپوش ایمنی گرانولی EPDM','epdm-granule-flooring','flooring-granule','https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80','کفپوش لاستیکی گرانولی EPDM برای زمین بازی و پارک.','کفپوش ایمنی از گرانول EPDM با ضخامت قابل تنظیم.','<p>کفپوش EPDM با قابلیت اجرا در رنگ‌ها و طرح‌های مختلف. ضربه‌گیر و ضد لغزش.</p>','جنس|EPDM گرانولی|ضخامت|2 تا 5 سانتی‌متر|استاندارد|EN 1177|ضد لغزش|بله|مقاوم UV|بله','کفپوش ایمنی,EPDM,گرانولی,پارک','کفپوش ایمنی','FL-GR-EPDM','',1,'کفپوش گرانولی EPDM | پروشات','کفپوش ایمنی گرانولی EPDM');

  // ── کفپوش تاتامی (1 item) ──
  P('کفپوش تاتامی ایمنی ۱×۱ متر','tatami-safety-floor','flooring-tatami','https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80','کفپوش تاتامی قفل‌شونده ۱×۱ متر برای سالن و فضای بازی.','تاتامی EVA با سیستم قفل پازلی، نصب آسان بدون چسب.','<p>از فوم EVA با دانسیته بالا. سیستم اتصال پازلی و قابل جداسازی.</p>','ابعاد|100x100 cm|ضخامت|2 تا 4 cm|جنس|EVA|اتصال|پازلی|تحمل ضربه|بالا','تاتامی,کفپوش,فوم,EVA','کفپوش ایمنی','FL-TAT-100','',1,'کفپوش تاتامی | پروشات','کفپوش تاتامی ایمنی');

  // ── کفپوش ورزشی (1 item) ──
  P('کفپوش ورزشی سالنی ۸ میلیمتر','sport-floor-8mm','flooring-sport','https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80','کفپوش ورزشی PVC مناسب سالن‌های چندمنظوره.','کفپوش PVC ورزشی با لایه ضربه‌گیر و سطح ضد لغزش.','<p>کفپوش ورزشی PVC با ضخامت ۸ میلیمتر. مناسب بسکتبال، والیبال و بدمینتون.</p>','ضخامت|8 میلیمتر|جنس|PVC|عرض رول|1.5 متر|ضد لغزش|بله|کاربری|سالن ورزشی','کفپوش ورزشی,PVC,سالن ورزشی','کفپوش ایمنی','FL-SP-8MM','',1,'کفپوش ورزشی سالنی | پروشات','کفپوش ورزشی PVC سالنی');

  // ── پایه چراغ (1 item) ──
  P('پایه چراغ پارکی مدل گلبرگ','light-pole-golbarg','light-pole','https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80','پایه چراغ روشنایی پارکی ارتفاع ۳ متر با طرح گلبرگ.','پایه چراغ تزیینی آلومینیومی با سرچراغ LED یکپارچه.','<p>پایه آلومینیوم ریخته‌گری با رنگ الکترواستاتیک. سرچراغ LED با نور گرم.</p>','ارتفاع|3 متر|جنس|آلومینیوم ریخته‌گری|لامپ|LED 30W|رنگ نور|گرم 3000K|IP|IP65','چراغ پارکی,روشنایی,LED','روشنایی شهری','LP-GOLB-3M','',1,'پایه چراغ گلبرگ | پروشات','پایه چراغ پارکی مدل گلبرگ');

  // ── چمن مصنوعی فوتبالی (1 item) ──
  P('چمن مصنوعی فوتبالی مونوفیلامنت ۵۰ میلیمتر','football-grass-50mm','grass-football','https://images.unsplash.com/photo-1575361204480-aadea25e6e68?w=600&q=80','چمن مصنوعی فوتبالی ۵۰mm مونوفیلامنت با تأییدیه FIFA.','چمن فوتبالی حرفه‌ای با نخ مونوفیلامنت PE و بکینگ PU.','<p>نخ مونوفیلامنت پلی‌اتیلن با شکل‌پذیری بالا. مناسب زمین‌های فوتبال حرفه‌ای و تمرینی.</p>','ارتفاع نخ|50 میلیمتر|نوع نخ|مونوفیلامنت PE|بکینگ|PU|دانسیته|10500 نخ/m²|عرض رول|4 متر','چمن مصنوعی,فوتبالی,FIFA,مونوفیلامنت','چمن مصنوعی','AG-FB-50MM','',1,'چمن مصنوعی فوتبالی ۵۰mm | پروشات','چمن مصنوعی فوتبالی مونوفیلامنت');

  // ── چمن مصنوعی تزیینی (1 item) ──
  P('چمن مصنوعی تزیینی ۲۵ میلیمتر','decorative-grass-25mm','grass-decorative','https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&q=80','چمن مصنوعی تزیینی ۲۵mm برای حیاط، بالکن و فضای سبز.','چمن تزیینی با ظاهر طبیعی، بدون نیاز به آبیاری و نگهداری.','<p>ترکیب نخ‌های سبز و قهوه‌ای برای ظاهری طبیعی. مقاوم در برابر UV و باران.</p>','ارتفاع نخ|25 میلیمتر|جنس|PE + PP|عرض رول|2 متر|مقاوم UV|بله|زهکشی|دارد','چمن تزیینی,فضای سبز,بالکن,حیاط','چمن مصنوعی','AG-DC-25MM','',1,'چمن تزیینی ۲۵mm | پروشات','چمن مصنوعی تزیینی ۲۵ میلیمتر');

  // ── المان شهری (1 item) ──
  P('آلاچیق فلزی مدل باغ ایرانی','metal-gazebo-iranian','urban-element','https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80','آلاچیق فلزی با طراحی ایرانی، مناسب پارک‌ها و باغ‌ها.','آلاچیق فلزی با سقف ضد آب و طراحی الهام از معماری ایرانی.','<p>سازه فولادی با رنگ الکترواستاتیک. سقف ورق رنگی ضد زنگ.</p>','ابعاد|4x4x3 متر|سازه|فولاد|سقف|ورق ضد زنگ|ظرفیت|8-10 نفر','آلاچیق,سایبان,زمین‌های بازی کودکان','زمین‌های بازی کودکان','UE-GZ-IRAN','',1,'آلاچیق باغ ایرانی | پروشات','آلاچیق فلزی مدل باغ ایرانی');

  // ── دستگاه بدنسازی پارکی (1 item) ──
  P('دستگاه بدنسازی پارکی اسکی‌فضایی','outdoor-air-walker','outdoor-fitness','https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80','دستگاه اسکی فضایی پارکی برای تقویت عضلات پا و باسن.','دستگاه ورزشی فضای باز با حرکت رفت و برگشتی پا.','<p>سازه فولادی گالوانیزه با بلبرینگ صنعتی. مناسب تمام سنین.</p>','سازه|فولاد گالوانیزه|ارتفاع|1.5 متر|بلبرینگ|صنعتی|تحمل وزن|120 kg','بدنسازی پارکی,اسکی فضایی,ورزشی','دستگاه بدنسازی','FT-OUT-SKI','',1,'اسکی فضایی پارکی | پروشات','دستگاه بدنسازی پارکی اسکی فضایی');

  // ── دستگاه بدنسازی فضای بسته (1 item) ──
  P('دستگاه بدنسازی چندکاره خانگی','home-multi-gym','indoor-fitness','https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80','دستگاه بدنسازی چندکاره برای تمرینات قدرتی در منزل.','دستگاه چندکاره با ایستگاه‌های مختلف تمرینی.','<p>شامل لت، پرس سینه، جلو بازو و پشت بازو. وزنه‌های قابل تنظیم تا ۸۰ کیلوگرم.</p>','وزنه|تا 80 kg|ایستگاه|4 عدد|سازه|فولاد ضخیم|ابعاد|180x150x210 cm','بدنسازی خانگی,چندکاره,قدرتی','دستگاه بدنسازی','FT-IN-MULTI','',1,'دستگاه چندکاره خانگی | پروشات','دستگاه بدنسازی چندکاره خانگی');
});

// Comments (product IDs: 1=galvanized, 2=polyethylene, 3=underground, 5=bench-metal, 6=bench-cast-iron, 7=combo-playground, 8=swing)
seedIfEmpty('product_comments', () => {
  const sc = db.prepare('INSERT INTO product_comments (product_id, name, email, comment, rating, is_approved, admin_reply, replied_at) VALUES (?,?,?,?,?,?,?,?)');
  sc.run(1, 'علی محمدی', 'ali@email.com', 'کیفیت مخزن زباله عالی بود. ورق گالوانیزه واقعاً ضخیم و مقاومه. برای شهرداری خریدیم و راضی هستیم.', 5, 1, 'ممنون از اعتماد شما. موفق باشید.', '2026-05-20');
  sc.run(2, 'سازمان پارک‌ها', 'parks@org.ir', 'مخزن پلی‌اتیلنی بسیار سبک و مقاومه. رنگش هم بعد از ۶ ماه تغییر نکرده.', 5, 1, null, null);
  sc.run(5, 'مهندس کریمی', '', 'نیمکت رویال واقعاً باکیفیته. چوب ترموود نشیمنش خیلی راحته و ظاهرش حرفه‌ایه.', 5, 1, 'ممنون. چوب ترموود ما وارداتی از فنلاند است.', '2026-05-15');
  sc.run(7, 'آقای تهرانی', 'tehrani@email.com', 'مجموعه بازی پارک شادی رو برای پارک محله نصب کردیم. بچه‌ها عاشقش شدن!', 5, 1, 'خوشحالیم که رضایت دارید. ایمنی کودکان اولویت ماست.', '2026-06-05');
  sc.run(8, 'مدیر مهدکودک', '', 'تاب دو نفره خیلی محکمه. صندلی EVA هم نرم و ایمنه. پیشنهاد می‌کنم.', 5, 1, null, null);
  sc.run(3, 'دهیاری روستای سبز', '', 'مخزن زیرزمینی نصب کردیم، فضای روستا خیلی تمیزتر شده. سیستم هیدرولیکش عالیه.', 5, 1, 'ممنون. تیم فنی ما برای سرویس دوره‌ای در خدمت شماست.', '2026-05-25');
});

// Services
seedIfEmpty('services', () => {
  const s = db.prepare('INSERT INTO services (title, description, long_description, icon, image, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
  s.run('طراحی و مشاوره', 'مشاوره تخصصی در طراحی و چیدمان مبلمان شهری و زمین‌های بازی کودکان', 'تیم طراحی ما با بررسی فضای پارک یا محیط شهری شما، بهترین چیدمان و محصولات را پیشنهاد می‌دهد. ارائه نقشه سه‌بعدی و طرح اولیه رایگان.', 'fas fa-pencil-ruler', '/images/services/s1.jpg', 1);
  s.run('تولید سفارشی', 'تولید محصولات سفارشی مطابق نیاز و سلیقه مشتری', 'امکان تولید نیمکت، سطل زباله و زمین‌های بازی کودکان با ابعاد، رنگ و طرح دلخواه شما. از طراحی تا تولید نهایی.', 'fas fa-hammer', '/images/services/s2.jpg', 2);
  s.run('نصب و اجرا', 'نصب حرفه‌ای زمین‌های بازی کودکان و مبلمان شهری در محل', 'تیم نصب مجرب ما با تجهیزات کامل، نصب ایمن و استاندارد محصولات را در کوتاه‌ترین زمان انجام می‌دهد.', 'fas fa-tools', '/images/services/s3.jpg', 3);
  s.run('تعمیر و نگهداری', 'خدمات تعمیر و نگهداری دوره‌ای زمین‌های بازی کودکان', 'با سرویس‌های نگهداری دوره‌ای، عمر مفید زمین‌های بازی کودکان خود را افزایش دهید. شامل رنگ‌آمیزی مجدد، تعویض قطعات و بازسازی.', 'fas fa-wrench', '/images/services/s4.jpg', 4);
  s.run('ایمنی و استاندارد', 'بازرسی و ارزیابی ایمنی تجهیزات بازی کودکان', 'بازرسی تجهیزات بازی مطابق استانداردهای EN 1176 و ارائه گزارش ایمنی و پیشنهادات بهبود.', 'fas fa-shield-alt', '/images/services/s5.jpg', 5);
  s.run('پشتیبانی و گارانتی', 'گارانتی محصولات و پشتیبانی پس از فروش', 'تمامی محصولات دارای گارانتی معتبر هستند. تیم پشتیبانی ما آماده پاسخگویی به سوالات شماست.', 'fas fa-headset', '/images/services/s6.jpg', 6);
});

// Brands
seedIfEmpty('brands', () => {
  const s = db.prepare('INSERT INTO brands (name, slug, logo, country, website, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
  s.run('Kompan', 'kompan', '/images/brands/kompan.png', 'دانمارک', 'https://kompan.com', 'همکاری در زمینه طراحی و استانداردهای تجهیزات بازی', 1);
  s.run('Lappset', 'lappset', '/images/brands/lappset.png', 'فنلاند', 'https://lappset.com', 'تأمین تجهیزات بازی و ورزشی فضای باز', 2);
  s.run('Hags', 'hags', '/images/brands/hags.png', 'سوئد', 'https://hags.com', 'تجهیزات بازی و مبلمان پارکی اسکاندیناوی', 3);
  s.run('Metalco', 'metalco', '/images/brands/metalco.png', 'ایتالیا', 'https://metalco.it', 'مبلمان شهری و تجهیزات فضای عمومی', 4);
  s.run('Marshalls', 'marshalls', '/images/brands/marshalls.png', 'انگلستان', 'https://marshalls.co.uk', 'مبلمان شهری، نیمکت و سطل زباله', 5);
  s.run('Benito', 'benito', '/images/brands/benito.png', 'اسپانیا', 'https://benito.com', 'تجهیزات مبلمان شهری و بازی', 6);
});

// Blog Posts
seedIfEmpty('blog_posts', () => {
  const s = db.prepare('INSERT INTO blog_posts (title, slug, excerpt, content, image, category, meta_title, meta_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  s.run('اصول طراحی پارک بازی ایمن برای کودکان', 'safe-playground-design', 'آشنایی با استانداردهای ایمنی و اصول طراحی زمین بازی کودکان در پارک‌ها و فضاهای عمومی.', 'استانداردهای EN 1176 و EN 1177 مهم‌ترین استانداردهای بین‌المللی در زمینه ایمنی تجهیزات بازی کودکان هستند.', 'https://images.unsplash.com/photo-1596997000103-e597b3ca50df?w=600&q=80', 'blog', 'اصول طراحی پارک بازی ایمن | پروشات', 'اصول و استانداردهای طراحی پارک بازی ایمن کودکان');
  s.run('انتخاب نیمکت مناسب برای فضاهای شهری', 'choosing-urban-benches', 'راهنمای انتخاب نیمکت پارکی مناسب بر اساس جنس، طراحی و کاربری فضای مورد نظر.', 'انتخاب نیمکت مناسب برای فضاهای شهری نیازمند توجه به عوامل مختلفی است.', 'https://images.unsplash.com/photo-1572204292164-b35ba943fca7?w=600&q=80', 'blog', 'انتخاب نیمکت شهری مناسب | پروشات', 'راهنمای انتخاب نیمکت پارکی و شهری');
  s.run('اهمیت تفکیک زباله در فضاهای عمومی', 'waste-separation-importance', 'نقش سطل‌های زباله تفکیکی در مدیریت پسماند شهری و حفظ محیط زیست.', 'نصب سطل‌های زباله تفکیکی در پارک‌ها، خیابان‌ها و مراکز تجاری یکی از مؤثرترین راهکارها است.', 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600&q=80', 'blog', 'تفکیک زباله در فضای عمومی | پروشات', 'اهمیت سطل زباله تفکیکی در فضاهای شهری');
});

// Projects
seedIfEmpty('projects', () => {
  const s = db.prepare('INSERT INTO projects (title, slug, client, description, image, year, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
  s.run('تجهیز پارک بزرگ ملت', 'mellat-park-project', 'شهرداری منطقه ۳ تهران', 'طراحی و نصب مجموعه کامل مبلمان شهری شامل نیمکت، سطل زباله، آبخوری و مجموعه بازی کودکان', 'https://images.unsplash.com/photo-1568393691622-c7ba131d63b4?w=600&q=80', '۱۴۰۲', 1);
  s.run('زمین بازی مجتمع مسکونی آسمان', 'asman-playground', 'مجتمع مسکونی آسمان', 'طراحی و اجرای زمین بازی ایمن با کفپوش EPDM و مجموعه بازی ترکیبی برای سنین مختلف', 'https://images.unsplash.com/photo-1596997000103-e597b3ca50df?w=600&q=80', '۱۴۰۳', 2);
  s.run('نصب مبلمان شهری بلوار اصلی', 'boulevard-furniture', 'شهرداری اصفهان', 'تأمین و نصب ۲۰۰ عدد نیمکت و ۱۵۰ سطل زباله تفکیکی در بلوار اصلی شهر', 'https://images.unsplash.com/photo-1572204292164-b35ba943fca7?w=600&q=80', '۱۴۰۳', 3);
  s.run('تجهیز پارک ساحلی بندرعباس', 'bandarabbas-park', 'شهرداری بندرعباس', 'طراحی و نصب تجهیزات بازی کودکان و کفپوش ایمنی EPDM در پارک ساحلی', 'https://images.unsplash.com/photo-1596997000103-e597b3ca50df?w=600&q=80', '۱۴۰۴', 4);
  s.run('زیباسازی میدان مرکزی تبریز', 'tabriz-square', 'شهرداری تبریز', 'نصب المان‌های شهری، نیمکت چدنی و پایه چراغ روشنایی در میدان مرکزی', 'https://images.unsplash.com/photo-1568393691622-c7ba131d63b4?w=600&q=80', '۱۴۰۴', 5);
});

module.exports = db;
