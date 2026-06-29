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
    company_name_en: 'Shahr va Andisheh Proshut Aria Co.',
    company_short: 'پروشات',
    company_short_en: 'Proshut',
    company_en: 'Proshut Aria',
    phone: '+98 915 311 1614',
    phone2: '',
    mobile: '+98 915 311 1614',
    fax: '',
    email: 'info@proshut.com',
    address: 'مشهد، گذرگاه پیامبر اعظم، بین پیامبر اعظم ۴۷ و ۴۹',
    address_en: 'Mashhad, Gozargah Payambar Azam, Between Payambar Azam 47 & 49',
    postal_code: '1234567890',
    working_hours: 'شنبه تا پنجشنبه ۸ صبح تا ۵ عصر',
    working_hours_en: 'Saturday to Thursday 8 AM - 5 PM',
    whatsapp: '989153111614',
    instagram: 'https://www.instagram.com/proshutaria/',
    telegram: 'https://t.me/proshutaria',
    linkedin: 'https://linkedin.com/company/proshut',
    aparat: 'https://aparat.com/proshut',
    about_short: 'شرکت شهر و اندیشه پروشات آریا با سال‌ها تجربه در زمینه طراحی، تولید و نصب زمین‌های بازی کودکان و مخازن زباله مکانیزه شهری، همواره پیشرو در زیباسازی فضاهای شهری بوده است.',
    about_short_en: 'Shahr va Andisheh Proshut Aria Company, with years of experience in designing, manufacturing, and installing urban furniture, playgrounds, and children play equipment.',
    about_text: 'با یاد خدای بیکران\nشرکت شهر و اندیشه پروشات آریا فعالیت خود را از سال ۱۳۸۸ در شهر مقدس مشهد برای اولین بار در زمینه تولید و تامین تجهیزات بازی کودکان (پلی‌اتیلن استاندارد) و مبلمان شهری و همچنین خدمات شهری (مخازن زباله مکانیزه) در ایران عزیزمان آغاز به کار نموده و با تجربه و دانش حدود دو دهه فعالیت در این حوزه اینک مفتخریم بیش از ۱۰ هزار بوستان در سراسر میهنمان و همچنین در کشورهای ارمنستان، عراق، افغانستان، تاجیکستان، ترکمنستان و... تجهیز و صادر نموده‌ایم.\n\nامیر عباس حیات‌بخش\nمدیر عامل و عضو هیئت مدیره',
    about_text_en: 'In the name of the Almighty\nShahr va Andisheh Proshut Aria Company started its activity in 2009 in the holy city of Mashhad, pioneering the production and supply of children playground equipment (standard polyethylene), urban furniture, and municipal services (mechanized waste bins) in Iran. With nearly two decades of experience and expertise in this field, we are now proud to have equipped and exported to over 10,000 parks across our country, as well as to Armenia, Iraq, Afghanistan, Tajikistan, Turkmenistan, and more.\n\nAmir Abbas Hayatbakhsh\nCEO & Board Member',
    about_mission: 'طراحی و تولید مبلمان شهری با کیفیت بین‌المللی برای ارتقای زیبایی و کارایی فضاهای عمومی',
    about_mission_en: 'Designing and manufacturing urban furniture with international quality to enhance the beauty and functionality of public spaces',
    about_vision: 'تبدیل شدن به برند اول مبلمان شهری و زمین‌های بازی کودکان در خاورمیانه',
    about_vision_en: 'Becoming the leading brand of urban furniture and playgrounds in the Middle East',
    years_experience: '۱۵+',
    years_experience_en: '15+',
    happy_clients: '۳۰۰+',
    happy_clients_en: '300+',
    projects_done: '۵۰۰+',
    projects_done_en: '500+',
    team_members: '۵۰+',
    team_members_en: '50+',
    meta_title: 'پروشات آریا | مبلمان شهری، زمین‌های بازی کودکان و وسایل بازی',
    meta_title_en: 'Proshut Aria | Urban Furniture, Playgrounds & Play Equipment',
    meta_description: 'شرکت پروشات آریا - تولیدکننده مبلمان شهری، نیمکت پارکی، سطل زباله، وسایل بازی کودکان، آلاچیق و تجهیزات فضای سبز با کیفیت بالا',
    meta_description_en: 'Proshut Aria - Manufacturer of urban furniture, park benches, waste bins, playground equipment with high quality',
    meta_keywords: 'مبلمان شهری، نیمکت پارک، سطل زباله شهری، وسایل بازی کودکان، زمین‌های بازی کودکان، آلاچیق، پروشات آریا، تجهیزات فضای سبز',
  };
  for (const [k, v] of Object.entries(settings)) s.run(k, v);
});

// Sliders
seedIfEmpty('sliders', () => {
  const s = db.prepare('INSERT INTO sliders (title, subtitle, image, link, sort_order) VALUES (?, ?, ?, ?, ?)');
  s.run('مبلمان شهری پروشات', 'طراحی و تولید انواع مبلمان شهری با کیفیت بالا', '/images/uploads/1781467194547-262094.jpg', '/products', 1);
  s.run('وسایل بازی پارکی', 'تجهیزات بازی ایمن و استاندارد برای کودکان', '/images/uploads/1781463381290-797725.png', '/products?category=kids-playground', 2);
  s.run('زیباسازی فضاهای شهری', 'نیمکت، سطل زباله و زمین‌های بازی کودکان مدرن', '/images/uploads/1781466137142-914035.png', '/products?category=park-bench-bin', 3);
});

// Categories (with subcategories) — based on products.md
seedIfEmpty('categories', () => {
  const s = db.prepare('INSERT INTO categories (name, name_en, slug, icon, description, description_en, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

  // 1. مخزن زباله مکانیزه شهری
  s.run('مخزن زباله مکانیزه شهری', 'Mechanized Urban Waste Bins', 'mechanized-waste-bin', 'fas fa-dumpster', 'انواع مخازن زباله مکانیزه شهری', 'All types of mechanized urban waste bins', null, 1);
  const c1 = db.prepare("SELECT id FROM categories WHERE slug='mechanized-waste-bin'").get();
  s.run('گالوانیزه', 'Galvanized', 'bin-galvanized', 'fas fa-dumpster', 'مخازن زباله گالوانیزه', 'Galvanized waste bins', c1.id, 1);
  s.run('پلی اتیلن', 'Polyethylene', 'bin-polyethylene', 'fas fa-dumpster', 'مخازن زباله پلی اتیلن', 'Polyethylene waste bins', c1.id, 2);
  s.run('زیر مخزنی', 'Underground', 'bin-under', 'fas fa-dumpster', 'مخازن زباله زیر مخزنی', 'Underground waste bins', c1.id, 3);
  s.run('چرخ مخزن زباله', 'Bin Wheels', 'bin-wheel', 'fas fa-dumpster', 'چرخ و قطعات مخزن زباله', 'Wheels and spare parts for waste bins', c1.id, 4);

  // 2. نیمکت و سطل زباله پارکی
  s.run('نیمکت و سطل زباله پارکی', 'Park Benches & Waste Bins', 'park-bench-bin', 'fas fa-chair', 'نیمکت و سطل زباله برای پارک‌ها', 'Benches and waste bins for parks', null, 2);
  const c2 = db.prepare("SELECT id FROM categories WHERE slug='park-bench-bin'").get();
  s.run('چدنی', 'Cast Iron', 'bench-cast-iron', 'fas fa-chair', 'نیمکت و سطل زباله چدنی', 'Cast iron benches and waste bins', c2.id, 1);
  s.run('فلزی', 'Metal', 'bench-metal', 'fas fa-chair', 'نیمکت و سطل زباله فلزی', 'Metal benches and waste bins', c2.id, 2);

  // 3. مجموعه بازی کودکان پلی اتیلن
  s.run('مجموعه بازی کودکان پلی اتیلن', 'Children Playground Equipment', 'kids-playground', 'fas fa-child', 'وسایل و مجموعه‌های بازی کودکان', 'Children play sets and equipment', null, 3);
  const c3 = db.prepare("SELECT id FROM categories WHERE slug='kids-playground'").get();
  s.run('مجموعه بازی کودکان ترکیبی', 'Combined Playground Sets', 'combo-playground', 'fas fa-child', 'مجموعه‌های بازی ترکیبی', 'Combined play sets', c3.id, 1);
  s.run('تاب', 'Swings', 'swing', 'fas fa-child', 'انواع تاب', 'All types of swings', c3.id, 2);
  s.run('الاکلنگ', 'Seesaws', 'seesaw', 'fas fa-child', 'انواع الاکلنگ', 'All types of seesaws', c3.id, 3);
  s.run('بازی های تور و طناب', 'Net & Rope Play', 'net-rope-play', 'fas fa-child', 'تجهیزات بازی تور و طناب', 'Net and rope play equipment', c3.id, 4);
  s.run('مهد کودکی و خانگی', 'Nursery & Home', 'nursery-home', 'fas fa-child', 'وسایل بازی مهد کودک و خانگی', 'Play equipment for nurseries and homes', c3.id, 5);
  s.run('صخره نوردی', 'Climbing', 'climbing', 'fas fa-child', 'دیوار و صخره مصنوعی', 'Artificial climbing walls and boulders', c3.id, 6);

  // 4. کف پوش ایمنی
  s.run('کف پوش ایمنی', 'Safety Flooring', 'safety-flooring', 'fas fa-layer-group', 'انواع کف پوش ایمنی', 'All types of safety flooring', null, 4);
  const c4 = db.prepare("SELECT id FROM categories WHERE slug='safety-flooring'").get();
  s.run('گرانولی', 'Granular (EPDM)', 'flooring-granule', 'fas fa-layer-group', 'کف پوش گرانولی', 'EPDM granular safety flooring', c4.id, 1);
  s.run('تاتامی', 'Tatami', 'flooring-tatami', 'fas fa-layer-group', 'کف پوش تاتامی', 'Tatami safety flooring', c4.id, 2);
  s.run('ورزشی', 'Sports', 'flooring-sport', 'fas fa-layer-group', 'کف پوش ورزشی', 'Sports flooring', c4.id, 3);

  // 5. پایه چراغ روشنایی (no subs)
  s.run('پایه چراغ روشنایی', 'Lighting Poles', 'light-pole', 'fas fa-lightbulb', 'پایه و ستون چراغ روشنایی', 'Lighting poles and columns', null, 5);

  // 6. چمن مصنوعی
  s.run('چمن مصنوعی', 'Artificial Grass', 'artificial-grass', 'fas fa-leaf', 'انواع چمن مصنوعی', 'All types of artificial grass', null, 6);
  const c6 = db.prepare("SELECT id FROM categories WHERE slug='artificial-grass'").get();
  s.run('فوتبالی', 'Football', 'grass-football', 'fas fa-futbol', 'چمن مصنوعی فوتبالی', 'Football artificial grass', c6.id, 1);
  s.run('تزیینی', 'Decorative', 'grass-decorative', 'fas fa-leaf', 'چمن مصنوعی تزیینی', 'Decorative artificial grass', c6.id, 2);

  // 7. المان شهری (no subs)
  s.run('المان شهری', 'Urban Elements', 'urban-element', 'fas fa-city', 'المان‌های تزیینی شهری', 'Urban decorative elements', null, 7);

  // 8. دستگاه بدنسازی
  s.run('دستگاه بدنسازی', 'Fitness Equipment', 'fitness-equipment', 'fas fa-dumbbell', 'دستگاه‌های بدنسازی پارکی و سالنی', 'Park and indoor fitness equipment', null, 8);
  const c8 = db.prepare("SELECT id FROM categories WHERE slug='fitness-equipment'").get();
  s.run('پارکی فضای باز', 'Outdoor Fitness', 'outdoor-fitness', 'fas fa-dumbbell', 'دستگاه بدنسازی فضای باز', 'Outdoor park fitness equipment', c8.id, 1);
  s.run('فضای بسته', 'Indoor Fitness', 'indoor-fitness', 'fas fa-dumbbell', 'دستگاه بدنسازی فضای بسته', 'Indoor fitness equipment', c8.id, 2);
});

// Products
seedIfEmpty('products', () => {
  const s = db.prepare(`INSERT INTO products
    (name, name_en, slug, category_id, image, short_description, short_description_en,
     description, description_en, full_description, full_description_en,
     specs, specs_en, tags, tags_en, sections, sections_en, product_code, special_status, is_featured,
     meta_title, meta_description, meta_title_en, meta_description_en)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const getCatId = slug => db.prepare('SELECT id FROM categories WHERE slug=?').get(slug).id;
  const P = (name,name_en,slug,cat,img,short,short_en,desc,desc_en,full,full_en,specs,specs_en,tags,tags_en,secs,secs_en,code,status,feat,mt,md,mt_en,md_en) =>
    s.run(name,name_en,slug,getCatId(cat),img,short,short_en,desc,desc_en,full,full_en,specs,specs_en,tags,tags_en,secs,secs_en,code,status,feat,mt,md,mt_en,md_en);

  P('مخزن زباله فلزی مکعب ۱۱۰۰ لیتر','1100L Cubic Metal Waste Bin',
    'metal-bin-1100','bin-galvanized','/images/uploads/1781467194547-262094.jpg',
    'مخزن زباله گالوانیزه مکانیزه شهری ۱۱۰۰ لیتری، مناسب جمع‌آوری پسماند شهری، پارک‌ها، معابر و مناطق مسکونی.',
    '1100-liter mechanized galvanized municipal waste bin, suitable for urban waste collection in parks, streets, and residential areas.',
    'مخزن زباله گالوانیزه مکانیزه شهری از ورق فولادی گالوانیزه گرم با ضخامت ۱.۵ تا ۲ میلی‌متر، دارای چهار چرخ گردان صنعتی و قابلیت تخلیه مکانیزه.',
    'Mechanized galvanized municipal waste bin made from hot-dip galvanized steel sheet (1.5-2mm thick), with four industrial swivel casters and mechanized emptying capability.',
    '<p>مخزن زباله گالوانیزه مکانیزه شهری با ظرفیت‌های ۲۴۰، ۶۶۰، ۷۷۰، ۱۰۰۰ و ۱۱۰۰ لیتر از ورق فولادی گالوانیزه گرم مقاوم در برابر خوردگی ساخته شده است.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>جمع‌آوری پسماند شهری، پارک‌ها، معابر و مناطق مسکونی</td></tr><tr><th>جنس بدنه</th><td>ورق فولادی گالوانیزه گرم مقاوم در برابر خوردگی</td></tr><tr><th>ضخامت ورق</th><td>حدود ۱.۵ تا ۲ میلی‌متر متناسب با ظرفیت</td></tr><tr><th>پوشش</th><td>گالوانیزه گرم کامل سطوح داخلی و خارجی</td></tr><tr><th>ظرفیت‌های تولید</th><td>۲۴۰، ۶۶۰، ۷۷۰، ۱۰۰۰ و ۱۱۰۰ لیتر</td></tr><tr><th>نوع تخلیه</th><td>مکانیزه توسط خودروهای حمل زباله شهری</td></tr><tr><th>درب مخزن</th><td>تک لنگه یا دو لنگه با لولاهای صنعتی</td></tr><tr><th>چرخ‌ها</th><td>چهار چرخ گردان صنعتی با قابلیت ترمز</td></tr><tr><th>کف مخزن</th><td>تقویت شده جهت تحمل وزن پسماند و شستشو</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر رطوبت، ضربه و شرایط جوی</td></tr><tr><th>شستشو</th><td>قابل شستشو با تجهیزات شستشوی مخازن شهری</td></tr><tr><th>علائم شهری</th><td>امکان درج لوگو و مشخصات شهرداری</td></tr><tr><th>کنترل کیفیت</th><td>بررسی جوش، ابعاد، گالوانیزه و عملکرد قبل از تحویل</td></tr></table>',
    '<p>Mechanized galvanized municipal waste bin available in 240, 660, 770, 1000, and 1100-liter capacities, made from hot-dip galvanized steel sheet resistant to corrosion.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Urban waste collection in parks, streets, and residential areas</td></tr><tr><th>Body Material</th><td>Hot-dip galvanized steel sheet, corrosion resistant</td></tr><tr><th>Sheet Thickness</th><td>Approx. 1.5 to 2 mm depending on capacity</td></tr><tr><th>Coating</th><td>Full hot-dip galvanized on interior and exterior surfaces</td></tr><tr><th>Production Capacities</th><td>240, 660, 770, 1000, and 1100 liters</td></tr><tr><th>Emptying Type</th><td>Mechanized by municipal waste collection vehicles</td></tr><tr><th>Lid</th><td>Single or double-flap with industrial hinges</td></tr><tr><th>Wheels</th><td>Four industrial swivel casters with brake capability</td></tr><tr><th>Floor</th><td>Reinforced to withstand waste weight and washing</td></tr><tr><th>Resistance</th><td>Resistant to moisture, impact, and weather conditions</td></tr><tr><th>Washing</th><td>Washable with municipal bin washing equipment</td></tr><tr><th>Municipal Markings</th><td>Option to print municipality logo and specifications</td></tr><tr><th>Quality Control</th><td>Weld, dimensions, galvanization, and function inspection before delivery</td></tr></table>',
    'عنوان|مخزن زباله گالوانیزه مکانیزه شهری|کاربرد|جمع‌آوری پسماند شهری، پارک‌ها، معابر و مناطق مسکونی|جنس بدنه|ورق فولادی گالوانیزه گرم مقاوم در برابر خوردگی|ضخامت ورق|۱.۵ تا ۲ میلی‌متر|پوشش|گالوانیزه گرم کامل داخلی و خارجی|ظرفیت‌ها|۲۴۰، ۶۶۰، ۷۷۰، ۱۰۰۰ و ۱۱۰۰ لیتر|نوع تخلیه|مکانیزه توسط خودروهای حمل زباله|درب|تک لنگه یا دو لنگه با لولاهای صنعتی|چرخ‌ها|۴ چرخ گردان صنعتی با قابلیت ترمز|کف مخزن|تقویت شده|مقاومت|رطوبت، ضربه و شرایط جوی',
    'Title|Mechanized Galvanized Municipal Waste Bin|Application|Urban waste collection in parks, streets & residential areas|Body Material|Hot-dip galvanized steel sheet, corrosion resistant|Sheet Thickness|1.5 to 2 mm|Coating|Full hot-dip galvanized, interior & exterior|Capacities|240, 660, 770, 1000 & 1100 Liters|Emptying Type|Mechanized by municipal waste vehicles|Lid|Single or double-flap with industrial hinges|Wheels|4 industrial swivel casters with brake|Floor|Reinforced|Resistance|Moisture, impact & weather conditions',
    'مخزن زباله,گالوانیزه,مکانیزه,شهرداری,مخزن فلزی,پسماند شهری','waste bin,galvanized,mechanized,municipal,metal bin,urban waste','مخزن زباله صنعتی','Industrial Waste Bins','TB-G-1100','',1,
    'مخزن زباله گالوانیزه مکانیزه ۱۱۰۰ لیتر | پروشات','مخزن زباله گالوانیزه مکانیزه شهری ۱۱۰۰ لیتر، ورق فولادی گالوانیزه گرم، چهار چرخ صنعتی',
    '1100L Mechanized Galvanized Waste Bin | Proshut','1100L mechanized galvanized municipal waste bin with hot-dip steel sheet and industrial casters');

  P('مخزن زباله پلی‌اتیلنی ۶۶۰ لیتر','660L Polyethylene Waste Bin',
    'polyethylene-bin-660','bin-polyethylene','/images/uploads/1781467183178-17166.png',
    'مخزن پلاستیکی ۶۶۰ لیتری مقاوم در برابر اشعه UV و ضربه.',
    '660-liter plastic bin resistant to UV rays and impact.',
    'مخزن پلی‌اتیلنی با چرخ‌های لاستیکی و درب لولایی.',
    'Polyethylene bin with rubber wheels and hinged lid.',
    '<p>ساخته شده از پلی‌اتیلن سنگین (HDPE) به روش قالب‌گیری تزریقی. مقاوم در برابر مواد شیمیایی و شرایط جوی.</p>',
    '<p>Made from heavy-density polyethylene (HDPE) by injection molding. Resistant to chemicals and weather conditions.</p>',
    'ظرفیت|660 لیتر|جنس|HDPE پلی‌اتیلن سنگین|چرخ|4 لاستیکی|مقاومت UV|دارد|وزن|48 کیلوگرم',
    'Capacity|660 Liters|Material|HDPE Heavy Polyethylene|Wheels|4 Rubber|UV Resistance|Yes|Weight|48 kg',
    'مخزن پلاستیکی,پلی اتیلن,سطل زباله','plastic bin,polyethylene,waste bin','مخزن زباله پلاستیکی','Plastic Waste Bins','TB-PE-660','',1,
    'مخزن پلی‌اتیلنی ۶۶۰ لیتر | پروشات','مخزن زباله پلی‌اتیلنی ۶۶۰ لیتر',
    '660L Polyethylene Waste Bin | Proshut','660L Polyethylene Waste Bin');

  P('زیر مخزن زباله زیرزمینی ۵ مترمکعب','5m³ Underground Waste Bin',
    'underground-bin-5m','bin-under','/images/uploads/1781467163784-327711.jpg',
    'سیستم مخزن زباله زیرزمینی با ظرفیت ۵ مترمکعب، زیباسازی فضای شهری.',
    'Underground waste bin system with 5m³ capacity, beautifying urban spaces.',
    'مخزن زیرزمینی با سیستم بالابر هیدرولیکی برای تخلیه توسط کامیون.',
    'Underground bin with hydraulic lifting system for truck emptying.',
    '<p>سیستم دفن زباله زیرزمینی با ظرفیت بالا. فقط دریچه ورودی در سطح خیابان نمایان است.</p><h5>مزایا:</h5><ul><li>حذف بوی نامطبوع</li><li>زیباسازی منظر شهری</li><li>کاهش دفعات تخلیه</li></ul>',
    '<p>Underground waste disposal system with high capacity. Only the inlet hatch is visible at street level.</p><h5>Advantages:</h5><ul><li>Eliminates unpleasant odors</li><li>Beautifies urban landscape</li><li>Reduces emptying frequency</li></ul>',
    'ظرفیت|5000 لیتر|عمق نصب|2.5 متر|سیستم تخلیه|هیدرولیکی|جنس|فولاد ضد زنگ|عمر مفید|25+ سال',
    'Capacity|5000 Liters|Installation Depth|2.5 m|Emptying System|Hydraulic|Material|Stainless Steel|Service Life|25+ Years',
    'مخزن زیرزمینی,زباله شهری,مدرن','underground bin,urban waste,modern','مخزن زباله شهری','Urban Waste Bins','TB-UG-5M','',1,
    'مخزن زیرزمینی ۵ مترمکعب | پروشات','مخزن زباله زیرزمینی ۵ مترمکعب',
    '5m³ Underground Waste Bin | Proshut','5m³ Underground Waste Bin');

  P('چرخ مخزن زباله ۲۰۰ میلیمتر','200mm Waste Bin Wheel',
    'bin-wheel-200mm','bin-wheel','/images/uploads/1781467122450-95447.jpg',
    'چرخ یدکی مخزن زباله قطر ۲۰۰ میلیمتر با بلبرینگ صنعتی.',
    'Spare waste bin wheel, 200mm diameter with industrial bearing.',
    'چرخ لاستیکی ۲۰۰ میلیمتر با رینگ فلزی و بلبرینگ.',
    '200mm rubber wheel with metal rim and bearing.',
    '<p>چرخ یدکی مناسب مخازن ۷۷۰ و ۱۱۰۰ لیتری. بلبرینگ صنعتی با عمر بالا.</p>',
    '<p>Spare wheel suitable for 770 and 1100-liter bins. Industrial bearing with long service life.</p>',
    'قطر|200 میلیمتر|نوع|لاستیکی با رینگ فلزی|بلبرینگ|صنعتی|تحمل بار|200 کیلوگرم',
    'Diameter|200 mm|Type|Rubber with Metal Rim|Bearing|Industrial|Load Capacity|200 kg',
    'چرخ مخزن,قطعات یدکی,چرخ زباله','bin wheel,spare parts,waste wheel','قطعات یدکی','Spare Parts','TB-WH-200','',1,
    'چرخ مخزن زباله ۲۰۰ میلیمتر | پروشات','چرخ یدکی مخزن زباله',
    '200mm Waste Bin Wheel | Proshut','Spare wheel for waste bins');

  P('سطل زباله پارکی چدنی مدل SP-1005','Cast Iron Park Waste Bin Model SP-1005',
    'park-bin-cast-iron-sp1005','bench-cast-iron','/images/uploads/1782631335517-235293.webp',
    'سطل زباله پارکی چدنی با پوشش رنگ کوره‌ای الکترواستاتیک، مناسب پارک‌ها، بوستان‌ها و فضاهای شهری.',
    'Cast iron park waste bin with electrostatic oven-baked coating, suitable for parks, gardens, and urban spaces.',
    'سطل زباله پارکی چدنی با بدنه مشبک از جنس چدن داکتیل، دارای مخزن داخلی گالوانیزه قابل شستشو و پایه چدنی جهت نصب روی زمین.',
    'Cast iron park waste bin with perforated ductile iron body, featuring a washable galvanized inner container and cast iron base for ground installation.',
    '<p>سطل زباله پارکی چدنی با طراحی زیبا و مقاوم، مناسب استفاده در پارک‌ها، بوستان‌ها، معابر و فضاهای شهری. بدنه از جنس چدن داکتیل یا چدن خاکستری با استحکام بالا ساخته شده و با رنگ کوره‌ای الکترواستاتیک پوشش داده شده است.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>استفاده در پارک‌ها، بوستان‌ها، معابر و فضاهای شهری</td></tr><tr><th>جنس بدنه</th><td>چدن داکتیل یا چدن خاکستری با استحکام بالا</td></tr><tr><th>نوع پوشش</th><td>رنگ کوره‌ای الکترواستاتیک مقاوم در برابر رطوبت و نور خورشید</td></tr><tr><th>ظرفیت مخزن</th><td>۵۰ تا ۷۰ لیتر (قابل سفارش)</td></tr><tr><th>ساختار</th><td>بدنه مشبک جهت تهویه و جلوگیری از تجمع بو</td></tr><tr><th>درب</th><td>دارای درب ثابت/قابل باز شدن جهت تخلیه آسان</td></tr><tr><th>سیستم تخلیه</th><td>تخلیه دستی با امکان جدا شدن مخزن داخلی</td></tr><tr><th>مخزن داخلی</th><td>ورق گالوانیزه یا پلی‌اتیلن قابل شستشو</td></tr><tr><th>پایه اتصال</th><td>دارای پایه چدنی جهت نصب روی زمین</td></tr><tr><th>روش نصب</th><td>نصب به وسیله رول‌بولت یا پیچ مهاری به کف</td></tr><tr><th>ابعاد تقریبی</th><td>ارتفاع ۸۰ تا ۱۰۰ سانتی‌متر – عرض ۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>وزن تقریبی</th><td>۲۵ تا ۴۰ کیلوگرم (بسته به مدل)</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر ضربه، شرایط جوی و استفاده عمومی شهری</td></tr><tr><th>نگهداری</th><td>قابلیت شستشو و تعویض قطعات</td></tr><tr><th>رنگ‌بندی</th><td>طبق کد رنگ شهرداری یا سفارش کارفرما</td></tr><tr><th>استاندارد تولید</th><td>مطابق الزامات مبلمان شهری و فضای سبز</td></tr></table>',
    '<p>Cast iron park waste bin with elegant and durable design, suitable for parks, gardens, streets, and urban spaces. The body is made from high-strength ductile or gray cast iron with an electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Parks, gardens, streets, and urban spaces</td></tr><tr><th>Body Material</th><td>Ductile or gray cast iron with high strength</td></tr><tr><th>Coating</th><td>Electrostatic oven-baked paint, resistant to moisture and sunlight</td></tr><tr><th>Container Capacity</th><td>50 to 70 liters (customizable)</td></tr><tr><th>Structure</th><td>Perforated body for ventilation and odor prevention</td></tr><tr><th>Lid</th><td>Fixed or openable lid for easy emptying</td></tr><tr><th>Emptying System</th><td>Manual emptying with removable inner container</td></tr><tr><th>Inner Container</th><td>Washable galvanized sheet or polyethylene</td></tr><tr><th>Base</th><td>Cast iron base for ground installation</td></tr><tr><th>Installation</th><td>Roll-bolt or anchor bolt to floor</td></tr><tr><th>Approx. Dimensions</th><td>Height 80-100 cm – Width 40-50 cm</td></tr><tr><th>Approx. Weight</th><td>25 to 40 kg (depending on model)</td></tr><tr><th>Resistance</th><td>Impact, weather conditions, and public urban use</td></tr><tr><th>Maintenance</th><td>Washable with replaceable parts</td></tr><tr><th>Colors</th><td>Per municipality color code or client order</td></tr><tr><th>Production Standard</th><td>Compliant with urban furniture and landscaping requirements</td></tr></table>',
    'جنس بدنه|چدن داکتیل یا خاکستری|پوشش|رنگ کوره‌ای الکترواستاتیک|ظرفیت|۵۰ تا ۷۰ لیتر|ساختار|بدنه مشبک|درب|ثابت/قابل باز شدن|تخلیه|دستی با مخزن داخلی جداشونده|مخزن داخلی|گالوانیزه یا پلی‌اتیلن|نصب|رول‌بولت یا پیچ مهاری|ابعاد|ارتفاع ۸۰-۱۰۰ × عرض ۴۰-۵۰ سانتی‌متر|وزن|۲۵ تا ۴۰ کیلوگرم',
    'Body|Ductile or Gray Cast Iron|Coating|Electrostatic Oven-Baked Paint|Capacity|50-70 Liters|Structure|Perforated Body|Lid|Fixed/Openable|Emptying|Manual with Removable Inner Container|Inner Container|Galvanized or Polyethylene|Installation|Roll-bolt or Anchor Bolt|Dimensions|H 80-100 × W 40-50 cm|Weight|25-40 kg',
    'سطل زباله,پارکی,چدنی,مبلمان شهری,فضای سبز','waste bin,park,cast iron,urban furniture,landscaping','مبلمان شهری','Urban Furniture','SP-1005','',1,
    'سطل زباله پارکی چدنی مدل SP-1005 | پروشات','سطل زباله پارکی چدنی با پوشش الکترواستاتیک، مناسب پارک‌ها و فضاهای شهری',
    'Cast Iron Park Waste Bin SP-1005 | Proshut','Cast iron park waste bin with electrostatic coating for parks and urban spaces');

  P('سطل زباله پارکی چدنی مدل SP-1007','Cast Iron Park Waste Bin Model SP-1007',
    'park-bin-cast-iron-sp1007','bench-cast-iron','/images/uploads/1782631348195-554931.webp',
    'سطل زباله پارکی چدنی با پوشش رنگ کوره‌ای الکترواستاتیک، مناسب پارک‌ها، بوستان‌ها و فضاهای شهری.',
    'Cast iron park waste bin with electrostatic oven-baked coating, suitable for parks, gardens, and urban spaces.',
    'سطل زباله پارکی چدنی با بدنه مشبک از جنس چدن داکتیل، دارای مخزن داخلی گالوانیزه قابل شستشو و پایه چدنی جهت نصب روی زمین.',
    'Cast iron park waste bin with perforated ductile iron body, featuring a washable galvanized inner container and cast iron base for ground installation.',
    '<p>سطل زباله پارکی چدنی با طراحی زیبا و مقاوم، مناسب استفاده در پارک‌ها، بوستان‌ها، معابر و فضاهای شهری. بدنه از جنس چدن داکتیل یا چدن خاکستری با استحکام بالا ساخته شده و با رنگ کوره‌ای الکترواستاتیک پوشش داده شده است.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>استفاده در پارک‌ها، بوستان‌ها، معابر و فضاهای شهری</td></tr><tr><th>جنس بدنه</th><td>چدن داکتیل یا چدن خاکستری با استحکام بالا</td></tr><tr><th>نوع پوشش</th><td>رنگ کوره‌ای الکترواستاتیک مقاوم در برابر رطوبت و نور خورشید</td></tr><tr><th>ظرفیت مخزن</th><td>۵۰ تا ۷۰ لیتر (قابل سفارش)</td></tr><tr><th>ساختار</th><td>بدنه مشبک جهت تهویه و جلوگیری از تجمع بو</td></tr><tr><th>درب</th><td>دارای درب ثابت/قابل باز شدن جهت تخلیه آسان</td></tr><tr><th>سیستم تخلیه</th><td>تخلیه دستی با امکان جدا شدن مخزن داخلی</td></tr><tr><th>مخزن داخلی</th><td>ورق گالوانیزه یا پلی‌اتیلن قابل شستشو</td></tr><tr><th>پایه اتصال</th><td>دارای پایه چدنی جهت نصب روی زمین</td></tr><tr><th>روش نصب</th><td>نصب به وسیله رول‌بولت یا پیچ مهاری به کف</td></tr><tr><th>ابعاد تقریبی</th><td>ارتفاع ۸۰ تا ۱۰۰ سانتی‌متر – عرض ۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>وزن تقریبی</th><td>۲۵ تا ۴۰ کیلوگرم (بسته به مدل)</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر ضربه، شرایط جوی و استفاده عمومی شهری</td></tr><tr><th>نگهداری</th><td>قابلیت شستشو و تعویض قطعات</td></tr><tr><th>رنگ‌بندی</th><td>طبق کد رنگ شهرداری یا سفارش کارفرما</td></tr><tr><th>استاندارد تولید</th><td>مطابق الزامات مبلمان شهری و فضای سبز</td></tr></table>',
    '<p>Cast iron park waste bin with elegant and durable design, suitable for parks, gardens, streets, and urban spaces. The body is made from high-strength ductile or gray cast iron with an electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Parks, gardens, streets, and urban spaces</td></tr><tr><th>Body Material</th><td>Ductile or gray cast iron with high strength</td></tr><tr><th>Coating</th><td>Electrostatic oven-baked paint, resistant to moisture and sunlight</td></tr><tr><th>Container Capacity</th><td>50 to 70 liters (customizable)</td></tr><tr><th>Structure</th><td>Perforated body for ventilation and odor prevention</td></tr><tr><th>Lid</th><td>Fixed or openable lid for easy emptying</td></tr><tr><th>Emptying System</th><td>Manual emptying with removable inner container</td></tr><tr><th>Inner Container</th><td>Washable galvanized sheet or polyethylene</td></tr><tr><th>Base</th><td>Cast iron base for ground installation</td></tr><tr><th>Installation</th><td>Roll-bolt or anchor bolt to floor</td></tr><tr><th>Approx. Dimensions</th><td>Height 80-100 cm – Width 40-50 cm</td></tr><tr><th>Approx. Weight</th><td>25 to 40 kg (depending on model)</td></tr><tr><th>Resistance</th><td>Impact, weather conditions, and public urban use</td></tr><tr><th>Maintenance</th><td>Washable with replaceable parts</td></tr><tr><th>Colors</th><td>Per municipality color code or client order</td></tr><tr><th>Production Standard</th><td>Compliant with urban furniture and landscaping requirements</td></tr></table>',
    'جنس بدنه|چدن داکتیل یا خاکستری|پوشش|رنگ کوره‌ای الکترواستاتیک|ظرفیت|۵۰ تا ۷۰ لیتر|ساختار|بدنه مشبک|درب|ثابت/قابل باز شدن|تخلیه|دستی با مخزن داخلی جداشونده|مخزن داخلی|گالوانیزه یا پلی‌اتیلن|نصب|رول‌بولت یا پیچ مهاری|ابعاد|ارتفاع ۸۰-۱۰۰ × عرض ۴۰-۵۰ سانتی‌متر|وزن|۲۵ تا ۴۰ کیلوگرم',
    'Body|Ductile or Gray Cast Iron|Coating|Electrostatic Oven-Baked Paint|Capacity|50-70 Liters|Structure|Perforated Body|Lid|Fixed/Openable|Emptying|Manual with Removable Inner Container|Inner Container|Galvanized or Polyethylene|Installation|Roll-bolt or Anchor Bolt|Dimensions|H 80-100 × W 40-50 cm|Weight|25-40 kg',
    'سطل زباله,پارکی,چدنی,مبلمان شهری,فضای سبز','waste bin,park,cast iron,urban furniture,landscaping','مبلمان شهری','Urban Furniture','SP-1007','',1,
    'سطل زباله پارکی چدنی مدل SP-1007 | پروشات','سطل زباله پارکی چدنی با پوشش الکترواستاتیک، مناسب پارک‌ها و فضاهای شهری',
    'Cast Iron Park Waste Bin SP-1007 | Proshut','Cast iron park waste bin with electrostatic coating for parks and urban spaces');

  P('سطل زباله پارکی چدنی مدل SP-1009','Cast Iron Park Waste Bin Model SP-1009',
    'park-bin-cast-iron-sp1009','bench-cast-iron','/images/uploads/1782631406370-904561.webp',
    'سطل زباله پارکی چدنی با پوشش رنگ کوره‌ای الکترواستاتیک، مناسب پارک‌ها، بوستان‌ها و فضاهای شهری.',
    'Cast iron park waste bin with electrostatic oven-baked coating, suitable for parks, gardens, and urban spaces.',
    'سطل زباله پارکی چدنی با بدنه مشبک از جنس چدن داکتیل، دارای مخزن داخلی گالوانیزه قابل شستشو و پایه چدنی جهت نصب روی زمین.',
    'Cast iron park waste bin with perforated ductile iron body, featuring a washable galvanized inner container and cast iron base for ground installation.',
    '<p>سطل زباله پارکی چدنی با طراحی زیبا و مقاوم، مناسب استفاده در پارک‌ها، بوستان‌ها، معابر و فضاهای شهری. بدنه از جنس چدن داکتیل یا چدن خاکستری با استحکام بالا ساخته شده و با رنگ کوره‌ای الکترواستاتیک پوشش داده شده است.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>استفاده در پارک‌ها، بوستان‌ها، معابر و فضاهای شهری</td></tr><tr><th>جنس بدنه</th><td>چدن داکتیل یا چدن خاکستری با استحکام بالا</td></tr><tr><th>نوع پوشش</th><td>رنگ کوره‌ای الکترواستاتیک مقاوم در برابر رطوبت و نور خورشید</td></tr><tr><th>ظرفیت مخزن</th><td>۵۰ تا ۷۰ لیتر (قابل سفارش)</td></tr><tr><th>ساختار</th><td>بدنه مشبک جهت تهویه و جلوگیری از تجمع بو</td></tr><tr><th>درب</th><td>دارای درب ثابت/قابل باز شدن جهت تخلیه آسان</td></tr><tr><th>سیستم تخلیه</th><td>تخلیه دستی با امکان جدا شدن مخزن داخلی</td></tr><tr><th>مخزن داخلی</th><td>ورق گالوانیزه یا پلی‌اتیلن قابل شستشو</td></tr><tr><th>پایه اتصال</th><td>دارای پایه چدنی جهت نصب روی زمین</td></tr><tr><th>روش نصب</th><td>نصب به وسیله رول‌بولت یا پیچ مهاری به کف</td></tr><tr><th>ابعاد تقریبی</th><td>ارتفاع ۸۰ تا ۱۰۰ سانتی‌متر – عرض ۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>وزن تقریبی</th><td>۲۵ تا ۴۰ کیلوگرم (بسته به مدل)</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر ضربه، شرایط جوی و استفاده عمومی شهری</td></tr><tr><th>نگهداری</th><td>قابلیت شستشو و تعویض قطعات</td></tr><tr><th>رنگ‌بندی</th><td>طبق کد رنگ شهرداری یا سفارش کارفرما</td></tr><tr><th>استاندارد تولید</th><td>مطابق الزامات مبلمان شهری و فضای سبز</td></tr></table>',
    '<p>Cast iron park waste bin with elegant and durable design, suitable for parks, gardens, streets, and urban spaces. The body is made from high-strength ductile or gray cast iron with an electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Parks, gardens, streets, and urban spaces</td></tr><tr><th>Body Material</th><td>Ductile or gray cast iron with high strength</td></tr><tr><th>Coating</th><td>Electrostatic oven-baked paint, resistant to moisture and sunlight</td></tr><tr><th>Container Capacity</th><td>50 to 70 liters (customizable)</td></tr><tr><th>Structure</th><td>Perforated body for ventilation and odor prevention</td></tr><tr><th>Lid</th><td>Fixed or openable lid for easy emptying</td></tr><tr><th>Emptying System</th><td>Manual emptying with removable inner container</td></tr><tr><th>Inner Container</th><td>Washable galvanized sheet or polyethylene</td></tr><tr><th>Base</th><td>Cast iron base for ground installation</td></tr><tr><th>Installation</th><td>Roll-bolt or anchor bolt to floor</td></tr><tr><th>Approx. Dimensions</th><td>Height 80-100 cm – Width 40-50 cm</td></tr><tr><th>Approx. Weight</th><td>25 to 40 kg (depending on model)</td></tr><tr><th>Resistance</th><td>Impact, weather conditions, and public urban use</td></tr><tr><th>Maintenance</th><td>Washable with replaceable parts</td></tr><tr><th>Colors</th><td>Per municipality color code or client order</td></tr><tr><th>Production Standard</th><td>Compliant with urban furniture and landscaping requirements</td></tr></table>',
    'جنس بدنه|چدن داکتیل یا خاکستری|پوشش|رنگ کوره‌ای الکترواستاتیک|ظرفیت|۵۰ تا ۷۰ لیتر|ساختار|بدنه مشبک|درب|ثابت/قابل باز شدن|تخلیه|دستی با مخزن داخلی جداشونده|مخزن داخلی|گالوانیزه یا پلی‌اتیلن|نصب|رول‌بولت یا پیچ مهاری|ابعاد|ارتفاع ۸۰-۱۰۰ × عرض ۴۰-۵۰ سانتی‌متر|وزن|۲۵ تا ۴۰ کیلوگرم',
    'Body|Ductile or Gray Cast Iron|Coating|Electrostatic Oven-Baked Paint|Capacity|50-70 Liters|Structure|Perforated Body|Lid|Fixed/Openable|Emptying|Manual with Removable Inner Container|Inner Container|Galvanized or Polyethylene|Installation|Roll-bolt or Anchor Bolt|Dimensions|H 80-100 × W 40-50 cm|Weight|25-40 kg',
    'سطل زباله,پارکی,چدنی,مبلمان شهری,فضای سبز','waste bin,park,cast iron,urban furniture,landscaping','مبلمان شهری','Urban Furniture','SP-1009','',1,
    'سطل زباله پارکی چدنی مدل SP-1009 | پروشات','سطل زباله پارکی چدنی با پوشش الکترواستاتیک، مناسب پارک‌ها و فضاهای شهری',
    'Cast Iron Park Waste Bin SP-1009 | Proshut','Cast iron park waste bin with electrostatic coating for parks and urban spaces');

  P('سطل زباله پارکی چدنی مدل SP-1010','Cast Iron Park Waste Bin Model SP-1010',
    'park-bin-cast-iron-sp1010','bench-cast-iron','/images/uploads/1782631415302-779165.webp',
    'سطل زباله پارکی چدنی با پوشش رنگ کوره‌ای الکترواستاتیک، مناسب پارک‌ها، بوستان‌ها و فضاهای شهری.',
    'Cast iron park waste bin with electrostatic oven-baked coating, suitable for parks, gardens, and urban spaces.',
    'سطل زباله پارکی چدنی با بدنه مشبک از جنس چدن داکتیل، دارای مخزن داخلی گالوانیزه قابل شستشو و پایه چدنی جهت نصب روی زمین.',
    'Cast iron park waste bin with perforated ductile iron body, featuring a washable galvanized inner container and cast iron base for ground installation.',
    '<p>سطل زباله پارکی چدنی با طراحی زیبا و مقاوم، مناسب استفاده در پارک‌ها، بوستان‌ها، معابر و فضاهای شهری. بدنه از جنس چدن داکتیل یا چدن خاکستری با استحکام بالا ساخته شده و با رنگ کوره‌ای الکترواستاتیک پوشش داده شده است.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>استفاده در پارک‌ها، بوستان‌ها، معابر و فضاهای شهری</td></tr><tr><th>جنس بدنه</th><td>چدن داکتیل یا چدن خاکستری با استحکام بالا</td></tr><tr><th>نوع پوشش</th><td>رنگ کوره‌ای الکترواستاتیک مقاوم در برابر رطوبت و نور خورشید</td></tr><tr><th>ظرفیت مخزن</th><td>۵۰ تا ۷۰ لیتر (قابل سفارش)</td></tr><tr><th>ساختار</th><td>بدنه مشبک جهت تهویه و جلوگیری از تجمع بو</td></tr><tr><th>درب</th><td>دارای درب ثابت/قابل باز شدن جهت تخلیه آسان</td></tr><tr><th>سیستم تخلیه</th><td>تخلیه دستی با امکان جدا شدن مخزن داخلی</td></tr><tr><th>مخزن داخلی</th><td>ورق گالوانیزه یا پلی‌اتیلن قابل شستشو</td></tr><tr><th>پایه اتصال</th><td>دارای پایه چدنی جهت نصب روی زمین</td></tr><tr><th>روش نصب</th><td>نصب به وسیله رول‌بولت یا پیچ مهاری به کف</td></tr><tr><th>ابعاد تقریبی</th><td>ارتفاع ۸۰ تا ۱۰۰ سانتی‌متر – عرض ۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>وزن تقریبی</th><td>۲۵ تا ۴۰ کیلوگرم (بسته به مدل)</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر ضربه، شرایط جوی و استفاده عمومی شهری</td></tr><tr><th>نگهداری</th><td>قابلیت شستشو و تعویض قطعات</td></tr><tr><th>رنگ‌بندی</th><td>طبق کد رنگ شهرداری یا سفارش کارفرما</td></tr><tr><th>استاندارد تولید</th><td>مطابق الزامات مبلمان شهری و فضای سبز</td></tr></table>',
    '<p>Cast iron park waste bin with elegant and durable design, suitable for parks, gardens, streets, and urban spaces. The body is made from high-strength ductile or gray cast iron with an electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Parks, gardens, streets, and urban spaces</td></tr><tr><th>Body Material</th><td>Ductile or gray cast iron with high strength</td></tr><tr><th>Coating</th><td>Electrostatic oven-baked paint, resistant to moisture and sunlight</td></tr><tr><th>Container Capacity</th><td>50 to 70 liters (customizable)</td></tr><tr><th>Structure</th><td>Perforated body for ventilation and odor prevention</td></tr><tr><th>Lid</th><td>Fixed or openable lid for easy emptying</td></tr><tr><th>Emptying System</th><td>Manual emptying with removable inner container</td></tr><tr><th>Inner Container</th><td>Washable galvanized sheet or polyethylene</td></tr><tr><th>Base</th><td>Cast iron base for ground installation</td></tr><tr><th>Installation</th><td>Roll-bolt or anchor bolt to floor</td></tr><tr><th>Approx. Dimensions</th><td>Height 80-100 cm – Width 40-50 cm</td></tr><tr><th>Approx. Weight</th><td>25 to 40 kg (depending on model)</td></tr><tr><th>Resistance</th><td>Impact, weather conditions, and public urban use</td></tr><tr><th>Maintenance</th><td>Washable with replaceable parts</td></tr><tr><th>Colors</th><td>Per municipality color code or client order</td></tr><tr><th>Production Standard</th><td>Compliant with urban furniture and landscaping requirements</td></tr></table>',
    'جنس بدنه|چدن داکتیل یا خاکستری|پوشش|رنگ کوره‌ای الکترواستاتیک|ظرفیت|۵۰ تا ۷۰ لیتر|ساختار|بدنه مشبک|درب|ثابت/قابل باز شدن|تخلیه|دستی با مخزن داخلی جداشونده|مخزن داخلی|گالوانیزه یا پلی‌اتیلن|نصب|رول‌بولت یا پیچ مهاری|ابعاد|ارتفاع ۸۰-۱۰۰ × عرض ۴۰-۵۰ سانتی‌متر|وزن|۲۵ تا ۴۰ کیلوگرم',
    'Body|Ductile or Gray Cast Iron|Coating|Electrostatic Oven-Baked Paint|Capacity|50-70 Liters|Structure|Perforated Body|Lid|Fixed/Openable|Emptying|Manual with Removable Inner Container|Inner Container|Galvanized or Polyethylene|Installation|Roll-bolt or Anchor Bolt|Dimensions|H 80-100 × W 40-50 cm|Weight|25-40 kg',
    'سطل زباله,پارکی,چدنی,مبلمان شهری,فضای سبز','waste bin,park,cast iron,urban furniture,landscaping','مبلمان شهری','Urban Furniture','SP-1010','',1,
    'سطل زباله پارکی چدنی مدل SP-1010 | پروشات','سطل زباله پارکی چدنی با پوشش الکترواستاتیک، مناسب پارک‌ها و فضاهای شهری',
    'Cast Iron Park Waste Bin SP-1010 | Proshut','Cast iron park waste bin with electrostatic coating for parks and urban spaces');

  P('نیمکت طرح بهساز مدل SP-201','Behsaz Bench Model SP-201',
    'bench-behsaz-sp201','bench-metal','/images/uploads/1782659515146-915078.webp',
    'نیمکت طرح بهساز با چوب پلاست، مناسب پارک‌ها، بوستان‌ها و معابر شهری.',
    'Behsaz design bench with WPC wood-plastic composite, suitable for parks, gardens, and urban streets.',
    'نیمکت پارکی طرح بهساز با نشیمن و پشتی از پروفیل چوب پلاست (WPC) و شاسی فلزی با پوشش کوره‌ای الکترواستاتیک.',
    'Behsaz park bench with WPC wood-plastic composite seat and backrest on a metal chassis with electrostatic oven-baked coating.',
    '<p>نیمکت طرح بهساز با چوب پلاست، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، معابر شهری و محوطه سازمان‌ها. نشیمن و پشتی از پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب ساخته شده و شاسی از پروفیل فولادی یا چدن مقاوم با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی می‌باشد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>مدل</th><td>نیمکت طرح بهساز با چوب پلاست</td></tr><tr><th>کاربری</th><td>پارک، بوستان، معابر شهری، محوطه سازمان‌ها</td></tr><tr><th>طول تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع کل</th><td>۷۵ تا ۸۵ سانتی‌متر</td></tr><tr><th>ارتفاع نشیمن</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>عمق نشیمن</th><td>۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>جنس نشیمن و پشتی</th><td>پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب – چوب روس – چوب ترموود</td></tr><tr><th>شاسی و پایه</th><td>فلزی از پروفیل فولادی یا چدن مقاوم</td></tr><tr><th>پوشش فلز</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه/ضدزنگ</td></tr><tr><th>مقاومت</th><td>مناسب فضای باز، ضد پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Behsaz design bench with wood-plastic composite (WPC), designed for use in parks, gardens, urban streets, and organizational premises. The seat and backrest are made from WPC profile resistant to moisture and sunlight, with a chassis of steel profile or durable cast iron with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Model</th><td>Behsaz Design Bench with WPC</td></tr><tr><th>Application</th><td>Parks, gardens, urban streets, organizational premises</td></tr><tr><th>Approx. Length</th><td>150 to 180 cm</td></tr><tr><th>Total Height</th><td>75 to 85 cm</td></tr><tr><th>Seat Height</th><td>40 to 45 cm</td></tr><tr><th>Seat Depth</th><td>40 to 50 cm</td></tr><tr><th>Seat & Backrest</th><td>WPC wood-plastic composite profile, moisture & sun resistant – Russian wood – Thermowood</td></tr><tr><th>Chassis & Base</th><td>Metal from steel profile or durable cast iron</td></tr><tr><th>Metal Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Fasteners</th><td>Galvanized/stainless steel bolts and nuts</td></tr><tr><th>Resistance</th><td>Outdoor suitable, rot-proof, low maintenance</td></tr></table>',
    'مدل|نیمکت طرح بهساز با چوب پلاست|کاربری|پارک، بوستان، معابر شهری|طول|۱۵۰ تا ۱۸۰ سانتی‌متر|ارتفاع کل|۷۵ تا ۸۵ سانتی‌متر|ارتفاع نشیمن|۴۰ تا ۴۵ سانتی‌متر|عمق نشیمن|۴۰ تا ۵۰ سانتی‌متر|نشیمن|چوب پلاست WPC|شاسی|فولادی/چدن|پوشش|الکترواستاتیک کوره‌ای|اتصالات|گالوانیزه ضدزنگ',
    'Model|Behsaz Bench with WPC|Application|Parks, gardens, urban streets|Length|150-180 cm|Total Height|75-85 cm|Seat Height|40-45 cm|Seat Depth|40-50 cm|Seat|WPC Wood-Plastic|Chassis|Steel/Cast Iron|Coating|Electrostatic Oven-Baked|Fasteners|Galvanized Stainless',
    'نیمکت,پارکی,چوب پلاست,بهساز,مبلمان شهری','bench,park,WPC,wood plastic,urban furniture','مبلمان شهری','Urban Furniture','SP-201','',1,
    'نیمکت طرح بهساز SP-201 | پروشات','نیمکت پارکی طرح بهساز با چوب پلاست مدل SP-201',
    'Behsaz Bench SP-201 | Proshut','Behsaz design park bench with WPC model SP-201');

  P('نیمکت طرح بهساز فلزی مدل SP-201','Behsaz Metal Bench Model SP-201',
    'bench-behsaz-sp201-metal','bench-metal','/images/uploads/1782658359825-981408.webp',
    'نیمکت طرح بهساز با چوب پلاست، مناسب پارک‌ها، بوستان‌ها و معابر شهری.',
    'Behsaz design bench with WPC wood-plastic composite, suitable for parks, gardens, and urban streets.',
    'نیمکت پارکی طرح بهساز با نشیمن و پشتی از پروفیل چوب پلاست (WPC) و شاسی فلزی با پوشش کوره‌ای الکترواستاتیک.',
    'Behsaz park bench with WPC wood-plastic composite seat and backrest on a metal chassis with electrostatic oven-baked coating.',
    '<p>نیمکت طرح بهساز با چوب پلاست، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، معابر شهری و محوطه سازمان‌ها. نشیمن و پشتی از پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب ساخته شده و شاسی از پروفیل فولادی یا چدن مقاوم با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی می‌باشد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>مدل</th><td>نیمکت طرح بهساز با چوب پلاست</td></tr><tr><th>کاربری</th><td>پارک، بوستان، معابر شهری، محوطه سازمان‌ها</td></tr><tr><th>طول تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع کل</th><td>۷۵ تا ۸۵ سانتی‌متر</td></tr><tr><th>ارتفاع نشیمن</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>عمق نشیمن</th><td>۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>جنس نشیمن و پشتی</th><td>پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب – چوب روس – چوب ترموود</td></tr><tr><th>شاسی و پایه</th><td>فلزی از پروفیل فولادی یا چدن مقاوم</td></tr><tr><th>پوشش فلز</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه/ضدزنگ</td></tr><tr><th>مقاومت</th><td>مناسب فضای باز، ضد پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Behsaz design bench with wood-plastic composite (WPC), designed for use in parks, gardens, urban streets, and organizational premises. The seat and backrest are made from WPC profile resistant to moisture and sunlight, with a chassis of steel profile or durable cast iron with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Model</th><td>Behsaz Design Bench with WPC</td></tr><tr><th>Application</th><td>Parks, gardens, urban streets, organizational premises</td></tr><tr><th>Approx. Length</th><td>150 to 180 cm</td></tr><tr><th>Total Height</th><td>75 to 85 cm</td></tr><tr><th>Seat Height</th><td>40 to 45 cm</td></tr><tr><th>Seat Depth</th><td>40 to 50 cm</td></tr><tr><th>Seat & Backrest</th><td>WPC wood-plastic composite profile, moisture & sun resistant – Russian wood – Thermowood</td></tr><tr><th>Chassis & Base</th><td>Metal from steel profile or durable cast iron</td></tr><tr><th>Metal Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Fasteners</th><td>Galvanized/stainless steel bolts and nuts</td></tr><tr><th>Resistance</th><td>Outdoor suitable, rot-proof, low maintenance</td></tr></table>',
    'مدل|نیمکت طرح بهساز با چوب پلاست|کاربری|پارک، بوستان، معابر شهری|طول|۱۵۰ تا ۱۸۰ سانتی‌متر|ارتفاع کل|۷۵ تا ۸۵ سانتی‌متر|ارتفاع نشیمن|۴۰ تا ۴۵ سانتی‌متر|عمق نشیمن|۴۰ تا ۵۰ سانتی‌متر|نشیمن|چوب پلاست WPC|شاسی|فولادی/چدن|پوشش|الکترواستاتیک کوره‌ای|اتصالات|گالوانیزه ضدزنگ',
    'Model|Behsaz Bench with WPC|Application|Parks, gardens, urban streets|Length|150-180 cm|Total Height|75-85 cm|Seat Height|40-45 cm|Seat Depth|40-50 cm|Seat|WPC Wood-Plastic|Chassis|Steel/Cast Iron|Coating|Electrostatic Oven-Baked|Fasteners|Galvanized Stainless',
    'نیمکت,پارکی,چوب پلاست,بهساز,مبلمان شهری','bench,park,WPC,wood plastic,urban furniture','مبلمان شهری','Urban Furniture','SP-201F','',1,
    'نیمکت طرح بهساز فلزی SP-201 | پروشات','نیمکت پارکی طرح بهساز فلزی با چوب پلاست مدل SP-201',
    'Behsaz Metal Bench SP-201 | Proshut','Behsaz design metal park bench with WPC model SP-201');

  P('نیمکت طرح بهساز مدل SP-202','Behsaz Bench Model SP-202',
    'bench-behsaz-sp202','bench-metal','/images/uploads/1782659542625-150196.webp',
    'نیمکت طرح بهساز با چوب پلاست، مناسب پارک‌ها، بوستان‌ها و معابر شهری.',
    'Behsaz design bench with WPC wood-plastic composite, suitable for parks, gardens, and urban streets.',
    'نیمکت پارکی طرح بهساز با نشیمن و پشتی از پروفیل چوب پلاست (WPC) و شاسی فلزی با پوشش کوره‌ای الکترواستاتیک.',
    'Behsaz park bench with WPC wood-plastic composite seat and backrest on a metal chassis with electrostatic oven-baked coating.',
    '<p>نیمکت طرح بهساز با چوب پلاست، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، معابر شهری و محوطه سازمان‌ها. نشیمن و پشتی از پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب ساخته شده و شاسی از پروفیل فولادی یا چدن مقاوم با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی می‌باشد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>مدل</th><td>نیمکت طرح بهساز با چوب پلاست</td></tr><tr><th>کاربری</th><td>پارک، بوستان، معابر شهری، محوطه سازمان‌ها</td></tr><tr><th>طول تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع کل</th><td>۷۵ تا ۸۵ سانتی‌متر</td></tr><tr><th>ارتفاع نشیمن</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>عمق نشیمن</th><td>۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>جنس نشیمن و پشتی</th><td>پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب – چوب روس – چوب ترموود</td></tr><tr><th>شاسی و پایه</th><td>فلزی از پروفیل فولادی یا چدن مقاوم</td></tr><tr><th>پوشش فلز</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه/ضدزنگ</td></tr><tr><th>مقاومت</th><td>مناسب فضای باز، ضد پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Behsaz design bench with wood-plastic composite (WPC), designed for use in parks, gardens, urban streets, and organizational premises. The seat and backrest are made from WPC profile resistant to moisture and sunlight, with a chassis of steel profile or durable cast iron with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Model</th><td>Behsaz Design Bench with WPC</td></tr><tr><th>Application</th><td>Parks, gardens, urban streets, organizational premises</td></tr><tr><th>Approx. Length</th><td>150 to 180 cm</td></tr><tr><th>Total Height</th><td>75 to 85 cm</td></tr><tr><th>Seat Height</th><td>40 to 45 cm</td></tr><tr><th>Seat Depth</th><td>40 to 50 cm</td></tr><tr><th>Seat & Backrest</th><td>WPC wood-plastic composite profile, moisture & sun resistant – Russian wood – Thermowood</td></tr><tr><th>Chassis & Base</th><td>Metal from steel profile or durable cast iron</td></tr><tr><th>Metal Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Fasteners</th><td>Galvanized/stainless steel bolts and nuts</td></tr><tr><th>Resistance</th><td>Outdoor suitable, rot-proof, low maintenance</td></tr></table>',
    'مدل|نیمکت طرح بهساز با چوب پلاست|کاربری|پارک، بوستان، معابر شهری|طول|۱۵۰ تا ۱۸۰ سانتی‌متر|ارتفاع کل|۷۵ تا ۸۵ سانتی‌متر|ارتفاع نشیمن|۴۰ تا ۴۵ سانتی‌متر|عمق نشیمن|۴۰ تا ۵۰ سانتی‌متر|نشیمن|چوب پلاست WPC|شاسی|فولادی/چدن|پوشش|الکترواستاتیک کوره‌ای|اتصالات|گالوانیزه ضدزنگ',
    'Model|Behsaz Bench with WPC|Application|Parks, gardens, urban streets|Length|150-180 cm|Total Height|75-85 cm|Seat Height|40-45 cm|Seat Depth|40-50 cm|Seat|WPC Wood-Plastic|Chassis|Steel/Cast Iron|Coating|Electrostatic Oven-Baked|Fasteners|Galvanized Stainless',
    'نیمکت,پارکی,چوب پلاست,بهساز,مبلمان شهری','bench,park,WPC,wood plastic,urban furniture','مبلمان شهری','Urban Furniture','SP-202','',1,
    'نیمکت طرح بهساز SP-202 | پروشات','نیمکت پارکی طرح بهساز با چوب پلاست مدل SP-202',
    'Behsaz Bench SP-202 | Proshut','Behsaz design park bench with WPC model SP-202');

  P('نیمکت طرح بهساز مدل SP-203','Behsaz Bench Model SP-203',
    'bench-behsaz-sp203','bench-metal','/images/uploads/1782658425227-699620.webp',
    'نیمکت طرح بهساز با چوب پلاست، مناسب پارک‌ها، بوستان‌ها و معابر شهری.',
    'Behsaz design bench with WPC wood-plastic composite, suitable for parks, gardens, and urban streets.',
    'نیمکت پارکی طرح بهساز با نشیمن و پشتی از پروفیل چوب پلاست (WPC) و شاسی فلزی با پوشش کوره‌ای الکترواستاتیک.',
    'Behsaz park bench with WPC wood-plastic composite seat and backrest on a metal chassis with electrostatic oven-baked coating.',
    '<p>نیمکت طرح بهساز با چوب پلاست، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، معابر شهری و محوطه سازمان‌ها. نشیمن و پشتی از پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب ساخته شده و شاسی از پروفیل فولادی یا چدن مقاوم با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی می‌باشد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>مدل</th><td>نیمکت طرح بهساز با چوب پلاست</td></tr><tr><th>کاربری</th><td>پارک، بوستان، معابر شهری، محوطه سازمان‌ها</td></tr><tr><th>طول تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع کل</th><td>۷۵ تا ۸۵ سانتی‌متر</td></tr><tr><th>ارتفاع نشیمن</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>عمق نشیمن</th><td>۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>جنس نشیمن و پشتی</th><td>پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب – چوب روس – چوب ترموود</td></tr><tr><th>شاسی و پایه</th><td>فلزی از پروفیل فولادی یا چدن مقاوم</td></tr><tr><th>پوشش فلز</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه/ضدزنگ</td></tr><tr><th>مقاومت</th><td>مناسب فضای باز، ضد پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Behsaz design bench with wood-plastic composite (WPC), designed for use in parks, gardens, urban streets, and organizational premises. The seat and backrest are made from WPC profile resistant to moisture and sunlight, with a chassis of steel profile or durable cast iron with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Model</th><td>Behsaz Design Bench with WPC</td></tr><tr><th>Application</th><td>Parks, gardens, urban streets, organizational premises</td></tr><tr><th>Approx. Length</th><td>150 to 180 cm</td></tr><tr><th>Total Height</th><td>75 to 85 cm</td></tr><tr><th>Seat Height</th><td>40 to 45 cm</td></tr><tr><th>Seat Depth</th><td>40 to 50 cm</td></tr><tr><th>Seat & Backrest</th><td>WPC wood-plastic composite profile, moisture & sun resistant – Russian wood – Thermowood</td></tr><tr><th>Chassis & Base</th><td>Metal from steel profile or durable cast iron</td></tr><tr><th>Metal Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Fasteners</th><td>Galvanized/stainless steel bolts and nuts</td></tr><tr><th>Resistance</th><td>Outdoor suitable, rot-proof, low maintenance</td></tr></table>',
    'مدل|نیمکت طرح بهساز با چوب پلاست|کاربری|پارک، بوستان، معابر شهری|طول|۱۵۰ تا ۱۸۰ سانتی‌متر|ارتفاع کل|۷۵ تا ۸۵ سانتی‌متر|ارتفاع نشیمن|۴۰ تا ۴۵ سانتی‌متر|عمق نشیمن|۴۰ تا ۵۰ سانتی‌متر|نشیمن|چوب پلاست WPC|شاسی|فولادی/چدن|پوشش|الکترواستاتیک کوره‌ای|اتصالات|گالوانیزه ضدزنگ',
    'Model|Behsaz Bench with WPC|Application|Parks, gardens, urban streets|Length|150-180 cm|Total Height|75-85 cm|Seat Height|40-45 cm|Seat Depth|40-50 cm|Seat|WPC Wood-Plastic|Chassis|Steel/Cast Iron|Coating|Electrostatic Oven-Baked|Fasteners|Galvanized Stainless',
    'نیمکت,پارکی,چوب پلاست,بهساز,مبلمان شهری','bench,park,WPC,wood plastic,urban furniture','مبلمان شهری','Urban Furniture','SP-203','',1,
    'نیمکت طرح بهساز SP-203 | پروشات','نیمکت پارکی طرح بهساز با چوب پلاست مدل SP-203',
    'Behsaz Bench SP-203 | Proshut','Behsaz design park bench with WPC model SP-203');

  P('نیمکت طرح بهساز مدل SP-204','Behsaz Bench Model SP-204',
    'bench-behsaz-sp204','bench-metal','/images/uploads/1782658444828-733265.webp',
    'نیمکت طرح بهساز با چوب پلاست، مناسب پارک‌ها، بوستان‌ها و معابر شهری.',
    'Behsaz design bench with WPC wood-plastic composite, suitable for parks, gardens, and urban streets.',
    'نیمکت پارکی طرح بهساز با نشیمن و پشتی از پروفیل چوب پلاست (WPC) و شاسی فلزی با پوشش کوره‌ای الکترواستاتیک.',
    'Behsaz park bench with WPC wood-plastic composite seat and backrest on a metal chassis with electrostatic oven-baked coating.',
    '<p>نیمکت طرح بهساز با چوب پلاست، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، معابر شهری و محوطه سازمان‌ها. نشیمن و پشتی از پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب ساخته شده و شاسی از پروفیل فولادی یا چدن مقاوم با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی می‌باشد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>مدل</th><td>نیمکت طرح بهساز با چوب پلاست</td></tr><tr><th>کاربری</th><td>پارک، بوستان، معابر شهری، محوطه سازمان‌ها</td></tr><tr><th>طول تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع کل</th><td>۷۵ تا ۸۵ سانتی‌متر</td></tr><tr><th>ارتفاع نشیمن</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>عمق نشیمن</th><td>۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>جنس نشیمن و پشتی</th><td>پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب – چوب روس – چوب ترموود</td></tr><tr><th>شاسی و پایه</th><td>فلزی از پروفیل فولادی یا چدن مقاوم</td></tr><tr><th>پوشش فلز</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه/ضدزنگ</td></tr><tr><th>مقاومت</th><td>مناسب فضای باز، ضد پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Behsaz design bench with wood-plastic composite (WPC), designed for use in parks, gardens, urban streets, and organizational premises. The seat and backrest are made from WPC profile resistant to moisture and sunlight, with a chassis of steel profile or durable cast iron with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Model</th><td>Behsaz Design Bench with WPC</td></tr><tr><th>Application</th><td>Parks, gardens, urban streets, organizational premises</td></tr><tr><th>Approx. Length</th><td>150 to 180 cm</td></tr><tr><th>Total Height</th><td>75 to 85 cm</td></tr><tr><th>Seat Height</th><td>40 to 45 cm</td></tr><tr><th>Seat Depth</th><td>40 to 50 cm</td></tr><tr><th>Seat & Backrest</th><td>WPC wood-plastic composite profile, moisture & sun resistant – Russian wood – Thermowood</td></tr><tr><th>Chassis & Base</th><td>Metal from steel profile or durable cast iron</td></tr><tr><th>Metal Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Fasteners</th><td>Galvanized/stainless steel bolts and nuts</td></tr><tr><th>Resistance</th><td>Outdoor suitable, rot-proof, low maintenance</td></tr></table>',
    'مدل|نیمکت طرح بهساز با چوب پلاست|کاربری|پارک، بوستان، معابر شهری|طول|۱۵۰ تا ۱۸۰ سانتی‌متر|ارتفاع کل|۷۵ تا ۸۵ سانتی‌متر|ارتفاع نشیمن|۴۰ تا ۴۵ سانتی‌متر|عمق نشیمن|۴۰ تا ۵۰ سانتی‌متر|نشیمن|چوب پلاست WPC|شاسی|فولادی/چدن|پوشش|الکترواستاتیک کوره‌ای|اتصالات|گالوانیزه ضدزنگ',
    'Model|Behsaz Bench with WPC|Application|Parks, gardens, urban streets|Length|150-180 cm|Total Height|75-85 cm|Seat Height|40-45 cm|Seat Depth|40-50 cm|Seat|WPC Wood-Plastic|Chassis|Steel/Cast Iron|Coating|Electrostatic Oven-Baked|Fasteners|Galvanized Stainless',
    'نیمکت,پارکی,چوب پلاست,بهساز,مبلمان شهری','bench,park,WPC,wood plastic,urban furniture','مبلمان شهری','Urban Furniture','SP-204','',1,
    'نیمکت طرح بهساز SP-204 | پروشات','نیمکت پارکی طرح بهساز با چوب پلاست مدل SP-204',
    'Behsaz Bench SP-204 | Proshut','Behsaz design park bench with WPC model SP-204');

  P('نیمکت طرح بهساز مدل SP-207','Behsaz Bench Model SP-207',
    'bench-behsaz-sp207','bench-metal','/images/uploads/1781466137142-914035.png',
    'نیمکت طرح بهساز با چوب پلاست، مناسب پارک‌ها، بوستان‌ها و معابر شهری.',
    'Behsaz design bench with WPC wood-plastic composite, suitable for parks, gardens, and urban streets.',
    'نیمکت پارکی طرح بهساز با نشیمن و پشتی از پروفیل چوب پلاست (WPC) و شاسی فلزی با پوشش کوره‌ای الکترواستاتیک.',
    'Behsaz park bench with WPC wood-plastic composite seat and backrest on a metal chassis with electrostatic oven-baked coating.',
    '<p>نیمکت طرح بهساز با چوب پلاست، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، معابر شهری و محوطه سازمان‌ها. نشیمن و پشتی از پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب ساخته شده و شاسی از پروفیل فولادی یا چدن مقاوم با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی می‌باشد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>مدل</th><td>نیمکت طرح بهساز با چوب پلاست</td></tr><tr><th>کاربری</th><td>پارک، بوستان، معابر شهری، محوطه سازمان‌ها</td></tr><tr><th>طول تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع کل</th><td>۷۵ تا ۸۵ سانتی‌متر</td></tr><tr><th>ارتفاع نشیمن</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>عمق نشیمن</th><td>۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>جنس نشیمن و پشتی</th><td>پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب – چوب روس – چوب ترموود</td></tr><tr><th>شاسی و پایه</th><td>فلزی از پروفیل فولادی یا چدن مقاوم</td></tr><tr><th>پوشش فلز</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه/ضدزنگ</td></tr><tr><th>مقاومت</th><td>مناسب فضای باز، ضد پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Behsaz design bench with wood-plastic composite (WPC), designed for use in parks, gardens, urban streets, and organizational premises. The seat and backrest are made from WPC profile resistant to moisture and sunlight, with a chassis of steel profile or durable cast iron with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Model</th><td>Behsaz Design Bench with WPC</td></tr><tr><th>Application</th><td>Parks, gardens, urban streets, organizational premises</td></tr><tr><th>Approx. Length</th><td>150 to 180 cm</td></tr><tr><th>Total Height</th><td>75 to 85 cm</td></tr><tr><th>Seat Height</th><td>40 to 45 cm</td></tr><tr><th>Seat Depth</th><td>40 to 50 cm</td></tr><tr><th>Seat & Backrest</th><td>WPC wood-plastic composite profile, moisture & sun resistant – Russian wood – Thermowood</td></tr><tr><th>Chassis & Base</th><td>Metal from steel profile or durable cast iron</td></tr><tr><th>Metal Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Fasteners</th><td>Galvanized/stainless steel bolts and nuts</td></tr><tr><th>Resistance</th><td>Outdoor suitable, rot-proof, low maintenance</td></tr></table>',
    'مدل|نیمکت طرح بهساز با چوب پلاست|کاربری|پارک، بوستان، معابر شهری|طول|۱۵۰ تا ۱۸۰ سانتی‌متر|ارتفاع کل|۷۵ تا ۸۵ سانتی‌متر|ارتفاع نشیمن|۴۰ تا ۴۵ سانتی‌متر|عمق نشیمن|۴۰ تا ۵۰ سانتی‌متر|نشیمن|چوب پلاست WPC|شاسی|فولادی/چدن|پوشش|الکترواستاتیک کوره‌ای|اتصالات|گالوانیزه ضدزنگ',
    'Model|Behsaz Bench with WPC|Application|Parks, gardens, urban streets|Length|150-180 cm|Total Height|75-85 cm|Seat Height|40-45 cm|Seat Depth|40-50 cm|Seat|WPC Wood-Plastic|Chassis|Steel/Cast Iron|Coating|Electrostatic Oven-Baked|Fasteners|Galvanized Stainless',
    'نیمکت,پارکی,چوب پلاست,بهساز,مبلمان شهری','bench,park,WPC,wood plastic,urban furniture','مبلمان شهری','Urban Furniture','SP-207','',1,
    'نیمکت طرح بهساز SP-207 | پروشات','نیمکت پارکی طرح بهساز با چوب پلاست مدل SP-207',
    'Behsaz Bench SP-207 | Proshut','Behsaz design park bench with WPC model SP-207');

  P('نیمکت طرح بهساز مدل SP-208','Behsaz Bench Model SP-208',
    'bench-behsaz-sp208','bench-metal','/images/uploads/1782658470002-42495.webp',
    'نیمکت طرح بهساز با چوب پلاست، مناسب پارک‌ها، بوستان‌ها و معابر شهری.',
    'Behsaz design bench with WPC wood-plastic composite, suitable for parks, gardens, and urban streets.',
    'نیمکت پارکی طرح بهساز با نشیمن و پشتی از پروفیل چوب پلاست (WPC) و شاسی فلزی با پوشش کوره‌ای الکترواستاتیک.',
    'Behsaz park bench with WPC wood-plastic composite seat and backrest on a metal chassis with electrostatic oven-baked coating.',
    '<p>نیمکت طرح بهساز با چوب پلاست، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، معابر شهری و محوطه سازمان‌ها. نشیمن و پشتی از پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب ساخته شده و شاسی از پروفیل فولادی یا چدن مقاوم با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی می‌باشد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>مدل</th><td>نیمکت طرح بهساز با چوب پلاست</td></tr><tr><th>کاربری</th><td>پارک، بوستان، معابر شهری، محوطه سازمان‌ها</td></tr><tr><th>طول تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع کل</th><td>۷۵ تا ۸۵ سانتی‌متر</td></tr><tr><th>ارتفاع نشیمن</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>عمق نشیمن</th><td>۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>جنس نشیمن و پشتی</th><td>پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب – چوب روس – چوب ترموود</td></tr><tr><th>شاسی و پایه</th><td>فلزی از پروفیل فولادی یا چدن مقاوم</td></tr><tr><th>پوشش فلز</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه/ضدزنگ</td></tr><tr><th>مقاومت</th><td>مناسب فضای باز، ضد پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Behsaz design bench with wood-plastic composite (WPC), designed for use in parks, gardens, urban streets, and organizational premises. The seat and backrest are made from WPC profile resistant to moisture and sunlight, with a chassis of steel profile or durable cast iron with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Model</th><td>Behsaz Design Bench with WPC</td></tr><tr><th>Application</th><td>Parks, gardens, urban streets, organizational premises</td></tr><tr><th>Approx. Length</th><td>150 to 180 cm</td></tr><tr><th>Total Height</th><td>75 to 85 cm</td></tr><tr><th>Seat Height</th><td>40 to 45 cm</td></tr><tr><th>Seat Depth</th><td>40 to 50 cm</td></tr><tr><th>Seat & Backrest</th><td>WPC wood-plastic composite profile, moisture & sun resistant – Russian wood – Thermowood</td></tr><tr><th>Chassis & Base</th><td>Metal from steel profile or durable cast iron</td></tr><tr><th>Metal Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Fasteners</th><td>Galvanized/stainless steel bolts and nuts</td></tr><tr><th>Resistance</th><td>Outdoor suitable, rot-proof, low maintenance</td></tr></table>',
    'مدل|نیمکت طرح بهساز با چوب پلاست|کاربری|پارک، بوستان، معابر شهری|طول|۱۵۰ تا ۱۸۰ سانتی‌متر|ارتفاع کل|۷۵ تا ۸۵ سانتی‌متر|ارتفاع نشیمن|۴۰ تا ۴۵ سانتی‌متر|عمق نشیمن|۴۰ تا ۵۰ سانتی‌متر|نشیمن|چوب پلاست WPC|شاسی|فولادی/چدن|پوشش|الکترواستاتیک کوره‌ای|اتصالات|گالوانیزه ضدزنگ',
    'Model|Behsaz Bench with WPC|Application|Parks, gardens, urban streets|Length|150-180 cm|Total Height|75-85 cm|Seat Height|40-45 cm|Seat Depth|40-50 cm|Seat|WPC Wood-Plastic|Chassis|Steel/Cast Iron|Coating|Electrostatic Oven-Baked|Fasteners|Galvanized Stainless',
    'نیمکت,پارکی,چوب پلاست,بهساز,مبلمان شهری','bench,park,WPC,wood plastic,urban furniture','مبلمان شهری','Urban Furniture','SP-208','',1,
    'نیمکت طرح بهساز SP-208 | پروشات','نیمکت پارکی طرح بهساز با چوب پلاست مدل SP-208',
    'Behsaz Bench SP-208 | Proshut','Behsaz design park bench with WPC model SP-208');

  P('نیمکت طرح بهساز مدل SP-210','Behsaz Bench Model SP-210',
    'bench-behsaz-sp210','bench-metal','/images/uploads/1782658506963-118471.webp',
    'نیمکت طرح بهساز با چوب پلاست، مناسب پارک‌ها، بوستان‌ها و معابر شهری.',
    'Behsaz design bench with WPC wood-plastic composite, suitable for parks, gardens, and urban streets.',
    'نیمکت پارکی طرح بهساز با نشیمن و پشتی از پروفیل چوب پلاست (WPC) و شاسی فلزی با پوشش کوره‌ای الکترواستاتیک.',
    'Behsaz park bench with WPC wood-plastic composite seat and backrest on a metal chassis with electrostatic oven-baked coating.',
    '<p>نیمکت طرح بهساز با چوب پلاست، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، معابر شهری و محوطه سازمان‌ها. نشیمن و پشتی از پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب ساخته شده و شاسی از پروفیل فولادی یا چدن مقاوم با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی می‌باشد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>مدل</th><td>نیمکت طرح بهساز با چوب پلاست</td></tr><tr><th>کاربری</th><td>پارک، بوستان، معابر شهری، محوطه سازمان‌ها</td></tr><tr><th>طول تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع کل</th><td>۷۵ تا ۸۵ سانتی‌متر</td></tr><tr><th>ارتفاع نشیمن</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>عمق نشیمن</th><td>۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>جنس نشیمن و پشتی</th><td>پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب – چوب روس – چوب ترموود</td></tr><tr><th>شاسی و پایه</th><td>فلزی از پروفیل فولادی یا چدن مقاوم</td></tr><tr><th>پوشش فلز</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه/ضدزنگ</td></tr><tr><th>مقاومت</th><td>مناسب فضای باز، ضد پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Behsaz design bench with wood-plastic composite (WPC), designed for use in parks, gardens, urban streets, and organizational premises. The seat and backrest are made from WPC profile resistant to moisture and sunlight, with a chassis of steel profile or durable cast iron with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Model</th><td>Behsaz Design Bench with WPC</td></tr><tr><th>Application</th><td>Parks, gardens, urban streets, organizational premises</td></tr><tr><th>Approx. Length</th><td>150 to 180 cm</td></tr><tr><th>Total Height</th><td>75 to 85 cm</td></tr><tr><th>Seat Height</th><td>40 to 45 cm</td></tr><tr><th>Seat Depth</th><td>40 to 50 cm</td></tr><tr><th>Seat & Backrest</th><td>WPC wood-plastic composite profile, moisture & sun resistant – Russian wood – Thermowood</td></tr><tr><th>Chassis & Base</th><td>Metal from steel profile or durable cast iron</td></tr><tr><th>Metal Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Fasteners</th><td>Galvanized/stainless steel bolts and nuts</td></tr><tr><th>Resistance</th><td>Outdoor suitable, rot-proof, low maintenance</td></tr></table>',
    'مدل|نیمکت طرح بهساز با چوب پلاست|کاربری|پارک، بوستان، معابر شهری|طول|۱۵۰ تا ۱۸۰ سانتی‌متر|ارتفاع کل|۷۵ تا ۸۵ سانتی‌متر|ارتفاع نشیمن|۴۰ تا ۴۵ سانتی‌متر|عمق نشیمن|۴۰ تا ۵۰ سانتی‌متر|نشیمن|چوب پلاست WPC|شاسی|فولادی/چدن|پوشش|الکترواستاتیک کوره‌ای|اتصالات|گالوانیزه ضدزنگ',
    'Model|Behsaz Bench with WPC|Application|Parks, gardens, urban streets|Length|150-180 cm|Total Height|75-85 cm|Seat Height|40-45 cm|Seat Depth|40-50 cm|Seat|WPC Wood-Plastic|Chassis|Steel/Cast Iron|Coating|Electrostatic Oven-Baked|Fasteners|Galvanized Stainless',
    'نیمکت,پارکی,چوب پلاست,بهساز,مبلمان شهری','bench,park,WPC,wood plastic,urban furniture','مبلمان شهری','Urban Furniture','SP-210','',1,
    'نیمکت طرح بهساز SP-210 | پروشات','نیمکت پارکی طرح بهساز با چوب پلاست مدل SP-210',
    'Behsaz Bench SP-210 | Proshut','Behsaz design park bench with WPC model SP-210');

  P('نیمکت طرح بهساز مدل SP-211','Behsaz Bench Model SP-211',
    'bench-behsaz-sp211','bench-metal','/images/uploads/1782658528084-645243.webp',
    'نیمکت طرح بهساز با چوب پلاست، مناسب پارک‌ها، بوستان‌ها و معابر شهری.',
    'Behsaz design bench with WPC wood-plastic composite, suitable for parks, gardens, and urban streets.',
    'نیمکت پارکی طرح بهساز با نشیمن و پشتی از پروفیل چوب پلاست (WPC) و شاسی فلزی با پوشش کوره‌ای الکترواستاتیک.',
    'Behsaz park bench with WPC wood-plastic composite seat and backrest on a metal chassis with electrostatic oven-baked coating.',
    '<p>نیمکت طرح بهساز با چوب پلاست، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، معابر شهری و محوطه سازمان‌ها. نشیمن و پشتی از پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب ساخته شده و شاسی از پروفیل فولادی یا چدن مقاوم با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی می‌باشد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>مدل</th><td>نیمکت طرح بهساز با چوب پلاست</td></tr><tr><th>کاربری</th><td>پارک، بوستان، معابر شهری، محوطه سازمان‌ها</td></tr><tr><th>طول تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع کل</th><td>۷۵ تا ۸۵ سانتی‌متر</td></tr><tr><th>ارتفاع نشیمن</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>عمق نشیمن</th><td>۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>جنس نشیمن و پشتی</th><td>پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب – چوب روس – چوب ترموود</td></tr><tr><th>شاسی و پایه</th><td>فلزی از پروفیل فولادی یا چدن مقاوم</td></tr><tr><th>پوشش فلز</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه/ضدزنگ</td></tr><tr><th>مقاومت</th><td>مناسب فضای باز، ضد پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Behsaz design bench with wood-plastic composite (WPC), designed for use in parks, gardens, urban streets, and organizational premises. The seat and backrest are made from WPC profile resistant to moisture and sunlight, with a chassis of steel profile or durable cast iron with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Model</th><td>Behsaz Design Bench with WPC</td></tr><tr><th>Application</th><td>Parks, gardens, urban streets, organizational premises</td></tr><tr><th>Approx. Length</th><td>150 to 180 cm</td></tr><tr><th>Total Height</th><td>75 to 85 cm</td></tr><tr><th>Seat Height</th><td>40 to 45 cm</td></tr><tr><th>Seat Depth</th><td>40 to 50 cm</td></tr><tr><th>Seat & Backrest</th><td>WPC wood-plastic composite profile, moisture & sun resistant – Russian wood – Thermowood</td></tr><tr><th>Chassis & Base</th><td>Metal from steel profile or durable cast iron</td></tr><tr><th>Metal Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Fasteners</th><td>Galvanized/stainless steel bolts and nuts</td></tr><tr><th>Resistance</th><td>Outdoor suitable, rot-proof, low maintenance</td></tr></table>',
    'مدل|نیمکت طرح بهساز با چوب پلاست|کاربری|پارک، بوستان، معابر شهری|طول|۱۵۰ تا ۱۸۰ سانتی‌متر|ارتفاع کل|۷۵ تا ۸۵ سانتی‌متر|ارتفاع نشیمن|۴۰ تا ۴۵ سانتی‌متر|عمق نشیمن|۴۰ تا ۵۰ سانتی‌متر|نشیمن|چوب پلاست WPC|شاسی|فولادی/چدن|پوشش|الکترواستاتیک کوره‌ای|اتصالات|گالوانیزه ضدزنگ',
    'Model|Behsaz Bench with WPC|Application|Parks, gardens, urban streets|Length|150-180 cm|Total Height|75-85 cm|Seat Height|40-45 cm|Seat Depth|40-50 cm|Seat|WPC Wood-Plastic|Chassis|Steel/Cast Iron|Coating|Electrostatic Oven-Baked|Fasteners|Galvanized Stainless',
    'نیمکت,پارکی,چوب پلاست,بهساز,مبلمان شهری','bench,park,WPC,wood plastic,urban furniture','مبلمان شهری','Urban Furniture','SP-211','',1,
    'نیمکت طرح بهساز SP-211 | پروشات','نیمکت پارکی طرح بهساز با چوب پلاست مدل SP-211',
    'Behsaz Bench SP-211 | Proshut','Behsaz design park bench with WPC model SP-211');

  P('نیمکت طرح بهساز مدل SP-209','Behsaz Bench Model SP-209',
    'bench-behsaz-sp209','bench-metal','/images/uploads/1782658555723-737044.webp',
    'نیمکت طرح بهساز با چوب پلاست، مناسب پارک‌ها، بوستان‌ها و معابر شهری.',
    'Behsaz design bench with WPC wood-plastic composite, suitable for parks, gardens, and urban streets.',
    'نیمکت پارکی طرح بهساز با نشیمن و پشتی از پروفیل چوب پلاست (WPC) و شاسی فلزی با پوشش کوره‌ای الکترواستاتیک.',
    'Behsaz park bench with WPC wood-plastic composite seat and backrest on a metal chassis with electrostatic oven-baked coating.',
    '<p>نیمکت طرح بهساز با چوب پلاست، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، معابر شهری و محوطه سازمان‌ها. نشیمن و پشتی از پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب ساخته شده و شاسی از پروفیل فولادی یا چدن مقاوم با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی می‌باشد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>مدل</th><td>نیمکت طرح بهساز با چوب پلاست</td></tr><tr><th>کاربری</th><td>پارک، بوستان، معابر شهری، محوطه سازمان‌ها</td></tr><tr><th>طول تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع کل</th><td>۷۵ تا ۸۵ سانتی‌متر</td></tr><tr><th>ارتفاع نشیمن</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>عمق نشیمن</th><td>۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>جنس نشیمن و پشتی</th><td>پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب – چوب روس – چوب ترموود</td></tr><tr><th>شاسی و پایه</th><td>فلزی از پروفیل فولادی یا چدن مقاوم</td></tr><tr><th>پوشش فلز</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه/ضدزنگ</td></tr><tr><th>مقاومت</th><td>مناسب فضای باز، ضد پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Behsaz design bench with wood-plastic composite (WPC), designed for use in parks, gardens, urban streets, and organizational premises. The seat and backrest are made from WPC profile resistant to moisture and sunlight, with a chassis of steel profile or durable cast iron with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Model</th><td>Behsaz Design Bench with WPC</td></tr><tr><th>Application</th><td>Parks, gardens, urban streets, organizational premises</td></tr><tr><th>Approx. Length</th><td>150 to 180 cm</td></tr><tr><th>Total Height</th><td>75 to 85 cm</td></tr><tr><th>Seat Height</th><td>40 to 45 cm</td></tr><tr><th>Seat Depth</th><td>40 to 50 cm</td></tr><tr><th>Seat & Backrest</th><td>WPC wood-plastic composite profile, moisture & sun resistant – Russian wood – Thermowood</td></tr><tr><th>Chassis & Base</th><td>Metal from steel profile or durable cast iron</td></tr><tr><th>Metal Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Fasteners</th><td>Galvanized/stainless steel bolts and nuts</td></tr><tr><th>Resistance</th><td>Outdoor suitable, rot-proof, low maintenance</td></tr></table>',
    'مدل|نیمکت طرح بهساز با چوب پلاست|کاربری|پارک، بوستان، معابر شهری|طول|۱۵۰ تا ۱۸۰ سانتی‌متر|ارتفاع کل|۷۵ تا ۸۵ سانتی‌متر|ارتفاع نشیمن|۴۰ تا ۴۵ سانتی‌متر|عمق نشیمن|۴۰ تا ۵۰ سانتی‌متر|نشیمن|چوب پلاست WPC|شاسی|فولادی/چدن|پوشش|الکترواستاتیک کوره‌ای|اتصالات|گالوانیزه ضدزنگ',
    'Model|Behsaz Bench with WPC|Application|Parks, gardens, urban streets|Length|150-180 cm|Total Height|75-85 cm|Seat Height|40-45 cm|Seat Depth|40-50 cm|Seat|WPC Wood-Plastic|Chassis|Steel/Cast Iron|Coating|Electrostatic Oven-Baked|Fasteners|Galvanized Stainless',
    'نیمکت,پارکی,چوب پلاست,بهساز,مبلمان شهری','bench,park,WPC,wood plastic,urban furniture','مبلمان شهری','Urban Furniture','SP-209','',1,
    'نیمکت طرح بهساز SP-209 | پروشات','نیمکت پارکی طرح بهساز با چوب پلاست مدل SP-209',
    'Behsaz Bench SP-209 | Proshut','Behsaz design park bench with WPC model SP-209');

  P('نیمکت طرح بهساز مدل SP-206','Behsaz Bench Model SP-206',
    'bench-behsaz-sp206','bench-metal','/images/uploads/1782658585201-168395.webp',
    'نیمکت طرح بهساز با چوب پلاست، مناسب پارک‌ها، بوستان‌ها و معابر شهری.',
    'Behsaz design bench with WPC wood-plastic composite, suitable for parks, gardens, and urban streets.',
    'نیمکت پارکی طرح بهساز با نشیمن و پشتی از پروفیل چوب پلاست (WPC) و شاسی فلزی با پوشش کوره‌ای الکترواستاتیک.',
    'Behsaz park bench with WPC wood-plastic composite seat and backrest on a metal chassis with electrostatic oven-baked coating.',
    '<p>نیمکت طرح بهساز با چوب پلاست، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، معابر شهری و محوطه سازمان‌ها. نشیمن و پشتی از پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب ساخته شده و شاسی از پروفیل فولادی یا چدن مقاوم با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی می‌باشد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>مدل</th><td>نیمکت طرح بهساز با چوب پلاست</td></tr><tr><th>کاربری</th><td>پارک، بوستان، معابر شهری، محوطه سازمان‌ها</td></tr><tr><th>طول تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع کل</th><td>۷۵ تا ۸۵ سانتی‌متر</td></tr><tr><th>ارتفاع نشیمن</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>عمق نشیمن</th><td>۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>جنس نشیمن و پشتی</th><td>پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب – چوب روس – چوب ترموود</td></tr><tr><th>شاسی و پایه</th><td>فلزی از پروفیل فولادی یا چدن مقاوم</td></tr><tr><th>پوشش فلز</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه/ضدزنگ</td></tr><tr><th>مقاومت</th><td>مناسب فضای باز، ضد پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Behsaz design bench with wood-plastic composite (WPC), designed for use in parks, gardens, urban streets, and organizational premises. The seat and backrest are made from WPC profile resistant to moisture and sunlight, with a chassis of steel profile or durable cast iron with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Model</th><td>Behsaz Design Bench with WPC</td></tr><tr><th>Application</th><td>Parks, gardens, urban streets, organizational premises</td></tr><tr><th>Approx. Length</th><td>150 to 180 cm</td></tr><tr><th>Total Height</th><td>75 to 85 cm</td></tr><tr><th>Seat Height</th><td>40 to 45 cm</td></tr><tr><th>Seat Depth</th><td>40 to 50 cm</td></tr><tr><th>Seat & Backrest</th><td>WPC wood-plastic composite profile, moisture & sun resistant – Russian wood – Thermowood</td></tr><tr><th>Chassis & Base</th><td>Metal from steel profile or durable cast iron</td></tr><tr><th>Metal Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Fasteners</th><td>Galvanized/stainless steel bolts and nuts</td></tr><tr><th>Resistance</th><td>Outdoor suitable, rot-proof, low maintenance</td></tr></table>',
    'مدل|نیمکت طرح بهساز با چوب پلاست|کاربری|پارک، بوستان، معابر شهری|طول|۱۵۰ تا ۱۸۰ سانتی‌متر|ارتفاع کل|۷۵ تا ۸۵ سانتی‌متر|ارتفاع نشیمن|۴۰ تا ۴۵ سانتی‌متر|عمق نشیمن|۴۰ تا ۵۰ سانتی‌متر|نشیمن|چوب پلاست WPC|شاسی|فولادی/چدن|پوشش|الکترواستاتیک کوره‌ای|اتصالات|گالوانیزه ضدزنگ',
    'Model|Behsaz Bench with WPC|Application|Parks, gardens, urban streets|Length|150-180 cm|Total Height|75-85 cm|Seat Height|40-45 cm|Seat Depth|40-50 cm|Seat|WPC Wood-Plastic|Chassis|Steel/Cast Iron|Coating|Electrostatic Oven-Baked|Fasteners|Galvanized Stainless',
    'نیمکت,پارکی,چوب پلاست,بهساز,مبلمان شهری','bench,park,WPC,wood plastic,urban furniture','مبلمان شهری','Urban Furniture','SP-206','',1,
    'نیمکت طرح بهساز SP-206 | پروشات','نیمکت پارکی طرح بهساز با چوب پلاست مدل SP-206',
    'Behsaz Bench SP-206 | Proshut','Behsaz design park bench with WPC model SP-206');

  P('نیمکت طرح بهساز مدل SP-209B','Behsaz Bench Model SP-209B',
    'bench-behsaz-sp209b','bench-metal','/images/uploads/1782658612560-446113.webp',
    'نیمکت طرح بهساز با چوب پلاست، مناسب پارک‌ها، بوستان‌ها و معابر شهری.',
    'Behsaz design bench with WPC wood-plastic composite, suitable for parks, gardens, and urban streets.',
    'نیمکت پارکی طرح بهساز با نشیمن و پشتی از پروفیل چوب پلاست (WPC) و شاسی فلزی با پوشش کوره‌ای الکترواستاتیک.',
    'Behsaz park bench with WPC wood-plastic composite seat and backrest on a metal chassis with electrostatic oven-baked coating.',
    '<p>نیمکت طرح بهساز با چوب پلاست، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، معابر شهری و محوطه سازمان‌ها. نشیمن و پشتی از پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب ساخته شده و شاسی از پروفیل فولادی یا چدن مقاوم با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی می‌باشد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>مدل</th><td>نیمکت طرح بهساز با چوب پلاست</td></tr><tr><th>کاربری</th><td>پارک، بوستان، معابر شهری، محوطه سازمان‌ها</td></tr><tr><th>طول تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع کل</th><td>۷۵ تا ۸۵ سانتی‌متر</td></tr><tr><th>ارتفاع نشیمن</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>عمق نشیمن</th><td>۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>جنس نشیمن و پشتی</th><td>پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب – چوب روس – چوب ترموود</td></tr><tr><th>شاسی و پایه</th><td>فلزی از پروفیل فولادی یا چدن مقاوم</td></tr><tr><th>پوشش فلز</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه/ضدزنگ</td></tr><tr><th>مقاومت</th><td>مناسب فضای باز، ضد پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Behsaz design bench with wood-plastic composite (WPC), designed for use in parks, gardens, urban streets, and organizational premises. The seat and backrest are made from WPC profile resistant to moisture and sunlight, with a chassis of steel profile or durable cast iron with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Model</th><td>Behsaz Design Bench with WPC</td></tr><tr><th>Application</th><td>Parks, gardens, urban streets, organizational premises</td></tr><tr><th>Approx. Length</th><td>150 to 180 cm</td></tr><tr><th>Total Height</th><td>75 to 85 cm</td></tr><tr><th>Seat Height</th><td>40 to 45 cm</td></tr><tr><th>Seat Depth</th><td>40 to 50 cm</td></tr><tr><th>Seat & Backrest</th><td>WPC wood-plastic composite profile, moisture & sun resistant – Russian wood – Thermowood</td></tr><tr><th>Chassis & Base</th><td>Metal from steel profile or durable cast iron</td></tr><tr><th>Metal Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Fasteners</th><td>Galvanized/stainless steel bolts and nuts</td></tr><tr><th>Resistance</th><td>Outdoor suitable, rot-proof, low maintenance</td></tr></table>',
    'مدل|نیمکت طرح بهساز با چوب پلاست|کاربری|پارک، بوستان، معابر شهری|طول|۱۵۰ تا ۱۸۰ سانتی‌متر|ارتفاع کل|۷۵ تا ۸۵ سانتی‌متر|ارتفاع نشیمن|۴۰ تا ۴۵ سانتی‌متر|عمق نشیمن|۴۰ تا ۵۰ سانتی‌متر|نشیمن|چوب پلاست WPC|شاسی|فولادی/چدن|پوشش|الکترواستاتیک کوره‌ای|اتصالات|گالوانیزه ضدزنگ',
    'Model|Behsaz Bench with WPC|Application|Parks, gardens, urban streets|Length|150-180 cm|Total Height|75-85 cm|Seat Height|40-45 cm|Seat Depth|40-50 cm|Seat|WPC Wood-Plastic|Chassis|Steel/Cast Iron|Coating|Electrostatic Oven-Baked|Fasteners|Galvanized Stainless',
    'نیمکت,پارکی,چوب پلاست,بهساز,مبلمان شهری','bench,park,WPC,wood plastic,urban furniture','مبلمان شهری','Urban Furniture','SP-209B','',1,
    'نیمکت طرح بهساز SP-209B | پروشات','نیمکت پارکی طرح بهساز با چوب پلاست مدل SP-209B',
    'Behsaz Bench SP-209B | Proshut','Behsaz design park bench with WPC model SP-209B');

  P('نیمکت طرح بهساز مدل SP-205','Behsaz Bench Model SP-205',
    'bench-behsaz-sp205','bench-metal','/images/uploads/1782658650419-567210.webp',
    'نیمکت طرح بهساز با چوب پلاست، مناسب پارک‌ها، بوستان‌ها و معابر شهری.',
    'Behsaz design bench with WPC wood-plastic composite, suitable for parks, gardens, and urban streets.',
    'نیمکت پارکی طرح بهساز با نشیمن و پشتی از پروفیل چوب پلاست (WPC) و شاسی فلزی با پوشش کوره‌ای الکترواستاتیک.',
    'Behsaz park bench with WPC wood-plastic composite seat and backrest on a metal chassis with electrostatic oven-baked coating.',
    '<p>نیمکت طرح بهساز با چوب پلاست، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، معابر شهری و محوطه سازمان‌ها. نشیمن و پشتی از پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب ساخته شده و شاسی از پروفیل فولادی یا چدن مقاوم با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی می‌باشد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>مدل</th><td>نیمکت طرح بهساز با چوب پلاست</td></tr><tr><th>کاربری</th><td>پارک، بوستان، معابر شهری، محوطه سازمان‌ها</td></tr><tr><th>طول تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع کل</th><td>۷۵ تا ۸۵ سانتی‌متر</td></tr><tr><th>ارتفاع نشیمن</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>عمق نشیمن</th><td>۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>جنس نشیمن و پشتی</th><td>پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب – چوب روس – چوب ترموود</td></tr><tr><th>شاسی و پایه</th><td>فلزی از پروفیل فولادی یا چدن مقاوم</td></tr><tr><th>پوشش فلز</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه/ضدزنگ</td></tr><tr><th>مقاومت</th><td>مناسب فضای باز، ضد پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Behsaz design bench with wood-plastic composite (WPC), designed for use in parks, gardens, urban streets, and organizational premises. The seat and backrest are made from WPC profile resistant to moisture and sunlight, with a chassis of steel profile or durable cast iron with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Model</th><td>Behsaz Design Bench with WPC</td></tr><tr><th>Application</th><td>Parks, gardens, urban streets, organizational premises</td></tr><tr><th>Approx. Length</th><td>150 to 180 cm</td></tr><tr><th>Total Height</th><td>75 to 85 cm</td></tr><tr><th>Seat Height</th><td>40 to 45 cm</td></tr><tr><th>Seat Depth</th><td>40 to 50 cm</td></tr><tr><th>Seat & Backrest</th><td>WPC wood-plastic composite profile, moisture & sun resistant – Russian wood – Thermowood</td></tr><tr><th>Chassis & Base</th><td>Metal from steel profile or durable cast iron</td></tr><tr><th>Metal Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Fasteners</th><td>Galvanized/stainless steel bolts and nuts</td></tr><tr><th>Resistance</th><td>Outdoor suitable, rot-proof, low maintenance</td></tr></table>',
    'مدل|نیمکت طرح بهساز با چوب پلاست|کاربری|پارک، بوستان، معابر شهری|طول|۱۵۰ تا ۱۸۰ سانتی‌متر|ارتفاع کل|۷۵ تا ۸۵ سانتی‌متر|ارتفاع نشیمن|۴۰ تا ۴۵ سانتی‌متر|عمق نشیمن|۴۰ تا ۵۰ سانتی‌متر|نشیمن|چوب پلاست WPC|شاسی|فولادی/چدن|پوشش|الکترواستاتیک کوره‌ای|اتصالات|گالوانیزه ضدزنگ',
    'Model|Behsaz Bench with WPC|Application|Parks, gardens, urban streets|Length|150-180 cm|Total Height|75-85 cm|Seat Height|40-45 cm|Seat Depth|40-50 cm|Seat|WPC Wood-Plastic|Chassis|Steel/Cast Iron|Coating|Electrostatic Oven-Baked|Fasteners|Galvanized Stainless',
    'نیمکت,پارکی,چوب پلاست,بهساز,مبلمان شهری','bench,park,WPC,wood plastic,urban furniture','مبلمان شهری','Urban Furniture','SP-205','',1,
    'نیمکت طرح بهساز SP-205 | پروشات','نیمکت پارکی طرح بهساز با چوب پلاست مدل SP-205',
    'Behsaz Bench SP-205 | Proshut','Behsaz design park bench with WPC model SP-205');

  P('نیمکت طرح بهساز مدل SP-214','Behsaz Bench Model SP-214',
    'bench-behsaz-sp214','bench-metal','/images/uploads/1782658676366-514949.webp',
    'نیمکت طرح بهساز با چوب پلاست، مناسب پارک‌ها، بوستان‌ها و معابر شهری.',
    'Behsaz design bench with WPC wood-plastic composite, suitable for parks, gardens, and urban streets.',
    'نیمکت پارکی طرح بهساز با نشیمن و پشتی از پروفیل چوب پلاست (WPC) و شاسی فلزی با پوشش کوره‌ای الکترواستاتیک.',
    'Behsaz park bench with WPC wood-plastic composite seat and backrest on a metal chassis with electrostatic oven-baked coating.',
    '<p>نیمکت طرح بهساز با چوب پلاست، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، معابر شهری و محوطه سازمان‌ها. نشیمن و پشتی از پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب ساخته شده و شاسی از پروفیل فولادی یا چدن مقاوم با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی می‌باشد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>مدل</th><td>نیمکت طرح بهساز با چوب پلاست</td></tr><tr><th>کاربری</th><td>پارک، بوستان، معابر شهری، محوطه سازمان‌ها</td></tr><tr><th>طول تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع کل</th><td>۷۵ تا ۸۵ سانتی‌متر</td></tr><tr><th>ارتفاع نشیمن</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>عمق نشیمن</th><td>۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>جنس نشیمن و پشتی</th><td>پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب – چوب روس – چوب ترموود</td></tr><tr><th>شاسی و پایه</th><td>فلزی از پروفیل فولادی یا چدن مقاوم</td></tr><tr><th>پوشش فلز</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه/ضدزنگ</td></tr><tr><th>مقاومت</th><td>مناسب فضای باز، ضد پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Behsaz design bench with wood-plastic composite (WPC), designed for use in parks, gardens, urban streets, and organizational premises. The seat and backrest are made from WPC profile resistant to moisture and sunlight, with a chassis of steel profile or durable cast iron with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Model</th><td>Behsaz Design Bench with WPC</td></tr><tr><th>Application</th><td>Parks, gardens, urban streets, organizational premises</td></tr><tr><th>Approx. Length</th><td>150 to 180 cm</td></tr><tr><th>Total Height</th><td>75 to 85 cm</td></tr><tr><th>Seat Height</th><td>40 to 45 cm</td></tr><tr><th>Seat Depth</th><td>40 to 50 cm</td></tr><tr><th>Seat & Backrest</th><td>WPC wood-plastic composite profile, moisture & sun resistant – Russian wood – Thermowood</td></tr><tr><th>Chassis & Base</th><td>Metal from steel profile or durable cast iron</td></tr><tr><th>Metal Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Fasteners</th><td>Galvanized/stainless steel bolts and nuts</td></tr><tr><th>Resistance</th><td>Outdoor suitable, rot-proof, low maintenance</td></tr></table>',
    'مدل|نیمکت طرح بهساز با چوب پلاست|کاربری|پارک، بوستان، معابر شهری|طول|۱۵۰ تا ۱۸۰ سانتی‌متر|ارتفاع کل|۷۵ تا ۸۵ سانتی‌متر|ارتفاع نشیمن|۴۰ تا ۴۵ سانتی‌متر|عمق نشیمن|۴۰ تا ۵۰ سانتی‌متر|نشیمن|چوب پلاست WPC|شاسی|فولادی/چدن|پوشش|الکترواستاتیک کوره‌ای|اتصالات|گالوانیزه ضدزنگ',
    'Model|Behsaz Bench with WPC|Application|Parks, gardens, urban streets|Length|150-180 cm|Total Height|75-85 cm|Seat Height|40-45 cm|Seat Depth|40-50 cm|Seat|WPC Wood-Plastic|Chassis|Steel/Cast Iron|Coating|Electrostatic Oven-Baked|Fasteners|Galvanized Stainless',
    'نیمکت,پارکی,چوب پلاست,بهساز,مبلمان شهری','bench,park,WPC,wood plastic,urban furniture','مبلمان شهری','Urban Furniture','SP-214','',1,
    'نیمکت طرح بهساز SP-214 | پروشات','نیمکت پارکی طرح بهساز با چوب پلاست مدل SP-214',
    'Behsaz Bench SP-214 | Proshut','Behsaz design park bench with WPC model SP-214');

  P('نیمکت طرح بهساز مدل SP-215','Behsaz Bench Model SP-215',
    'bench-behsaz-sp215','bench-metal','/images/uploads/1782659653370-297833.webp',
    'نیمکت طرح بهساز با چوب پلاست، مناسب پارک‌ها، بوستان‌ها و معابر شهری.',
    'Behsaz design bench with WPC wood-plastic composite, suitable for parks, gardens, and urban streets.',
    'نیمکت پارکی طرح بهساز با نشیمن و پشتی از پروفیل چوب پلاست (WPC) و شاسی فلزی با پوشش کوره‌ای الکترواستاتیک.',
    'Behsaz park bench with WPC wood-plastic composite seat and backrest on a metal chassis with electrostatic oven-baked coating.',
    '<p>نیمکت طرح بهساز با چوب پلاست، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، معابر شهری و محوطه سازمان‌ها. نشیمن و پشتی از پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب ساخته شده و شاسی از پروفیل فولادی یا چدن مقاوم با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی می‌باشد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>مدل</th><td>نیمکت طرح بهساز با چوب پلاست</td></tr><tr><th>کاربری</th><td>پارک، بوستان، معابر شهری، محوطه سازمان‌ها</td></tr><tr><th>طول تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع کل</th><td>۷۵ تا ۸۵ سانتی‌متر</td></tr><tr><th>ارتفاع نشیمن</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>عمق نشیمن</th><td>۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>جنس نشیمن و پشتی</th><td>پروفیل چوب پلاست (WPC) مقاوم در برابر رطوبت و آفتاب – چوب روس – چوب ترموود</td></tr><tr><th>شاسی و پایه</th><td>فلزی از پروفیل فولادی یا چدن مقاوم</td></tr><tr><th>پوشش فلز</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه/ضدزنگ</td></tr><tr><th>مقاومت</th><td>مناسب فضای باز، ضد پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Behsaz design bench with wood-plastic composite (WPC), designed for use in parks, gardens, urban streets, and organizational premises. The seat and backrest are made from WPC profile resistant to moisture and sunlight, with a chassis of steel profile or durable cast iron with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Model</th><td>Behsaz Design Bench with WPC</td></tr><tr><th>Application</th><td>Parks, gardens, urban streets, organizational premises</td></tr><tr><th>Approx. Length</th><td>150 to 180 cm</td></tr><tr><th>Total Height</th><td>75 to 85 cm</td></tr><tr><th>Seat Height</th><td>40 to 45 cm</td></tr><tr><th>Seat Depth</th><td>40 to 50 cm</td></tr><tr><th>Seat & Backrest</th><td>WPC wood-plastic composite profile, moisture & sun resistant – Russian wood – Thermowood</td></tr><tr><th>Chassis & Base</th><td>Metal from steel profile or durable cast iron</td></tr><tr><th>Metal Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Fasteners</th><td>Galvanized/stainless steel bolts and nuts</td></tr><tr><th>Resistance</th><td>Outdoor suitable, rot-proof, low maintenance</td></tr></table>',
    'مدل|نیمکت طرح بهساز با چوب پلاست|کاربری|پارک، بوستان، معابر شهری|طول|۱۵۰ تا ۱۸۰ سانتی‌متر|ارتفاع کل|۷۵ تا ۸۵ سانتی‌متر|ارتفاع نشیمن|۴۰ تا ۴۵ سانتی‌متر|عمق نشیمن|۴۰ تا ۵۰ سانتی‌متر|نشیمن|چوب پلاست WPC|شاسی|فولادی/چدن|پوشش|الکترواستاتیک کوره‌ای|اتصالات|گالوانیزه ضدزنگ',
    'Model|Behsaz Bench with WPC|Application|Parks, gardens, urban streets|Length|150-180 cm|Total Height|75-85 cm|Seat Height|40-45 cm|Seat Depth|40-50 cm|Seat|WPC Wood-Plastic|Chassis|Steel/Cast Iron|Coating|Electrostatic Oven-Baked|Fasteners|Galvanized Stainless',
    'نیمکت,پارکی,چوب پلاست,بهساز,مبلمان شهری','bench,park,WPC,wood plastic,urban furniture','مبلمان شهری','Urban Furniture','SP-215','',1,
    'نیمکت طرح بهساز SP-215 | پروشات','نیمکت پارکی طرح بهساز با چوب پلاست مدل SP-215',
    'Behsaz Bench SP-215 | Proshut','Behsaz design park bench with WPC model SP-215');

  P('مجموعه بازی کودکان پارک شادی','Shadi Park Children Playground Set',
    'playground-park-shadi','combo-playground','/images/uploads/1781463381290-797725.png',
    'مجموعه بازی کامل شامل سرسره، تاب، پل معلق و برج صعود.',
    'Complete play set including slide, swing, suspension bridge, and climbing tower.',
    'مجموعه بازی ترکیبی مناسب کودکان ۳ تا ۱۲ سال، مطابق EN 1176.',
    'Combined playground set suitable for children ages 3-12, compliant with EN 1176.',
    '<p>شامل سرسره، تاب، پل معلق و برج صعود. تمام مواد مطابق استانداردهای EN 1176.</p>',
    '<p>Includes slide, swing, suspension bridge, and climbing tower. All materials comply with EN 1176 standards.</p>',
    'رده سنی|3 تا 12 سال|ابعاد|8x6x3.5 متر|سازه|فولاد گالوانیزه|سرسره|پلی‌اتیلن|استاندارد|EN 1176',
    'Age Group|3 to 12 years|Dimensions|8x6x3.5 m|Structure|Galvanized Steel|Slide|Polyethylene|Standard|EN 1176',
    'مجموعه بازی,سرسره,تاب,پارک کودک','playground set,slide,swing,children park','وسایل بازی کودکان','Children Play Equipment','PG-C-SHADI','',1,
    'مجموعه بازی پارک شادی | پروشات','مجموعه بازی کودکان پارک شادی',
    'Shadi Park Playground Set | Proshut','Combined children playground set');

  P('الاکلنگ فنری دو نفره','Double Spring Seesaw',
    'spring-seesaw-double','seesaw','/images/uploads/1781464174980-32734.png',
    'الاکلنگ فنری دو نفره با فنر صنعتی ضد خستگی.',
    'Double spring seesaw with anti-fatigue industrial spring.',
    'الاکلنگ فنری با بدنه پلی‌اتیلن و فنر فولادی مقاوم.',
    'Spring seesaw with polyethylene body and durable steel spring.',
    '<p>بدنه پلی‌اتیلنی با طرح حیوانات. فنر فولادی با عمر بالا و دسته‌های ایمنی.</p>',
    '<p>Polyethylene body with animal designs. Steel spring with long life and safety handles.</p>',
    'ظرفیت|2 نفر|رده سنی|3 تا 8 سال|فنر|فولاد ضد خستگی|بدنه|پلی‌اتیلن',
    'Capacity|2 Persons|Age Group|3 to 8 years|Spring|Anti-fatigue Steel|Body|Polyethylene',
    'الاکلنگ,فنری,وسایل بازی','seesaw,spring,playground equipment','وسایل بازی کودکان','Children Play Equipment','SS-SPR-002','',1,
    'الاکلنگ فنری | پروشات','الاکلنگ فنری دو نفره',
    'Double Spring Seesaw | Proshut','Double spring seesaw');

  P('برج صعود طنابی مدل اسپایدر','Spider Rope Climbing Tower',
    'rope-climb-spider','net-rope-play','/images/uploads/1781464371027-239720.png',
    'برج صعود طنابی با شبکه تور برای تقویت مهارت‌های حرکتی.',
    'Rope climbing tower with net for developing motor skills.',
    'برج تور و طناب با ارتفاع ۳ متر، مناسب کودکان ماجراجو.',
    '3-meter rope and net tower for adventurous children.',
    '<p>شبکه طنابی با گره‌های ایمنی. سازه فولادی گالوانیزه و طناب پلی‌آمید UV مقاوم.</p>',
    '<p>Rope net with safety knots. Galvanized steel structure and UV-resistant polyamide rope.</p>',
    'ارتفاع|3 متر|طناب|پلی‌آمید UV مقاوم|سازه|فولاد گالوانیزه|رده سنی|5 تا 14 سال',
    'Height|3 m|Rope|UV-resistant Polyamide|Structure|Galvanized Steel|Age Group|5 to 14 years',
    'برج طنابی,تور بازی,صعود','rope tower,net play,climbing','وسایل بازی کودکان','Children Play Equipment','NR-SPDR-001','',1,
    'برج صعود طنابی | پروشات','برج صعود طنابی اسپایدر',
    'Spider Rope Climbing Tower | Proshut','Rope climbing tower Spider model');

  P('دیوار صخره‌نوردی مصنوعی ۳ متری','3m Artificial Climbing Wall',
    'climbing-wall-3m','climbing','/images/uploads/1781464864736-61979.png',
    'دیوار صخره‌نوردی مصنوعی ارتفاع ۳ متر برای پارک‌ها.',
    '3-meter artificial climbing wall for parks.',
    'دیوار صخره‌نوردی با دستگیره‌های رنگی و سطح ضد لغزش.',
    'Climbing wall with colorful grips and anti-slip surface.',
    '<p>پنل‌های فایبرگلاس با دستگیره‌های پلی‌اورتان. قابل نصب در فضای باز و بسته.</p>',
    '<p>Fiberglass panels with polyurethane grips. Can be installed indoors and outdoors.</p>',
    'ارتفاع|3 متر|عرض|2.5 متر|جنس پنل|فایبرگلاس|دستگیره|پلی‌اورتان|استاندارد|EN 12572',
    'Height|3 m|Width|2.5 m|Panel Material|Fiberglass|Grips|Polyurethane|Standard|EN 12572',
    'صخره نوردی,دیوار صعود,ورزشی','climbing wall,climbing,sports','وسایل بازی کودکان','Children Play Equipment','CL-WALL-3M','',1,
    'دیوار صخره‌نوردی | پروشات','دیوار صخره‌نوردی مصنوعی',
    '3m Artificial Climbing Wall | Proshut','3-meter artificial climbing wall');

  P('کفپوش ایمنی گرانولی EPDM','EPDM Granular Safety Flooring',
    'epdm-granule-flooring','flooring-granule','/images/uploads/1781465122554-567339.png',
    'کفپوش لاستیکی گرانولی EPDM برای زمین بازی و پارک.',
    'EPDM rubber granular flooring for playgrounds and parks.',
    'کفپوش ایمنی از گرانول EPDM با ضخامت قابل تنظیم.',
    'EPDM safety flooring with adjustable thickness.',
    '<p>کفپوش EPDM با قابلیت اجرا در رنگ‌ها و طرح‌های مختلف. ضربه‌گیر و ضد لغزش.</p>',
    '<p>EPDM flooring available in various colors and patterns. Shock-absorbing and anti-slip.</p>',
    'جنس|EPDM گرانولی|ضخامت|2 تا 5 سانتی‌متر|استاندارد|EN 1177|ضد لغزش|بله|مقاوم UV|بله',
    'Material|EPDM Granular|Thickness|2 to 5 cm|Standard|EN 1177|Anti-slip|Yes|UV Resistant|Yes',
    'کفپوش ایمنی,EPDM,گرانولی,پارک','safety flooring,EPDM,granular,park','کفپوش ایمنی','Safety Flooring','FL-GR-EPDM','',1,
    'کفپوش گرانولی EPDM | پروشات','کفپوش ایمنی گرانولی EPDM',
    'EPDM Granular Safety Flooring | Proshut','EPDM granular safety flooring');

  P('کفپوش تاتامی ایمنی ۱×۱ متر','1x1m Tatami Safety Floor',
    'tatami-safety-floor','flooring-tatami','/images/uploads/1781465306020-16205.png',
    'کفپوش تاتامی قفل‌شونده ۱×۱ متر برای سالن و فضای بازی.',
    'Interlocking tatami floor tile 1x1m for halls and play areas.',
    'تاتامی EVA با سیستم قفل پازلی، نصب آسان بدون چسب.',
    'EVA tatami with puzzle-lock system, easy installation without glue.',
    '<p>از فوم EVA با دانسیته بالا. سیستم اتصال پازلی و قابل جداسازی.</p>',
    '<p>High-density EVA foam. Puzzle connection system, detachable.</p>',
    'ابعاد|100x100 cm|ضخامت|2 تا 4 cm|جنس|EVA|اتصال|پازلی|تحمل ضربه|بالا',
    'Dimensions|100x100 cm|Thickness|2 to 4 cm|Material|EVA|Connection|Puzzle-lock|Impact Absorption|High',
    'تاتامی,کفپوش,فوم,EVA','tatami,flooring,foam,EVA','کفپوش ایمنی','Safety Flooring','FL-TAT-100','',1,
    'کفپوش تاتامی | پروشات','کفپوش تاتامی ایمنی',
    '1x1m Tatami Safety Floor | Proshut','Interlocking EVA tatami safety flooring');

  P('کفپوش ورزشی سالنی ۸ میلیمتر','8mm Indoor Sports Flooring',
    'sport-floor-8mm','flooring-sport','/images/uploads/1781465538562-456053.jpg',
    'کفپوش ورزشی PVC مناسب سالن‌های چندمنظوره.',
    'PVC sports flooring for multi-purpose halls.',
    'کفپوش PVC ورزشی با لایه ضربه‌گیر و سطح ضد لغزش.',
    'PVC sports flooring with shock-absorbing layer and anti-slip surface.',
    '<p>کفپوش ورزشی PVC با ضخامت ۸ میلیمتر. مناسب بسکتبال، والیبال و بدمینتون.</p>',
    '<p>8mm PVC sports flooring. Suitable for basketball, volleyball, and badminton.</p>',
    'ضخامت|8 میلیمتر|جنس|PVC|عرض رول|1.5 متر|ضد لغزش|بله|کاربری|سالن ورزشی',
    'Thickness|8 mm|Material|PVC|Roll Width|1.5 m|Anti-slip|Yes|Application|Sports Hall',
    'کفپوش ورزشی,PVC,سالن ورزشی','sports flooring,PVC,sports hall','کفپوش ایمنی','Safety Flooring','FL-SP-8MM','',1,
    'کفپوش ورزشی سالنی | پروشات','کفپوش ورزشی PVC سالنی',
    '8mm Indoor Sports Flooring | Proshut','PVC indoor sports flooring 8mm');

  P('چمن مصنوعی فوتبالی مونوفیلامنت ۵۰ میلیمتر','50mm Monofilament Football Artificial Grass',
    'football-grass-50mm','grass-football','/images/uploads/1781469259316-869141.webp',
    'چمن مصنوعی فوتبالی ۵۰mm مونوفیلامنت با تأییدیه FIFA.',
    '50mm monofilament football artificial grass with FIFA certification.',
    'چمن فوتبالی حرفه‌ای با نخ مونوفیلامنت PE و بکینگ PU.',
    'Professional football grass with PE monofilament yarn and PU backing.',
    '<p>نخ مونوفیلامنت پلی‌اتیلن با شکل‌پذیری بالا. مناسب زمین‌های فوتبال حرفه‌ای و تمرینی.</p>',
    '<p>High-resilience PE monofilament yarn. Suitable for professional and training football fields.</p>',
    'ارتفاع نخ|50 میلیمتر|نوع نخ|مونوفیلامنت PE|بکینگ|PU|دانسیته|10500 نخ/m²|عرض رول|4 متر',
    'Yarn Height|50 mm|Yarn Type|Monofilament PE|Backing|PU|Density|10,500 yarns/m²|Roll Width|4 m',
    'چمن مصنوعی,فوتبالی,FIFA,مونوفیلامنت','artificial grass,football,FIFA,monofilament','چمن مصنوعی','Artificial Grass','AG-FB-50MM','',1,
    'چمن مصنوعی فوتبالی ۵۰mm | پروشات','چمن مصنوعی فوتبالی مونوفیلامنت',
    '50mm Football Artificial Grass | Proshut','50mm monofilament football artificial grass');

  P('چمن مصنوعی تزیینی ۲۵ میلیمتر','25mm Decorative Artificial Grass',
    'decorative-grass-25mm','grass-decorative','/images/uploads/1781469102994-874018.png',
    'چمن مصنوعی تزیینی ۲۵mm برای حیاط، بالکن و فضای سبز.',
    '25mm decorative artificial grass for yards, balconies, and landscaping.',
    'چمن تزیینی با ظاهر طبیعی، بدون نیاز به آبیاری و نگهداری.',
    'Decorative grass with natural appearance, no watering or maintenance needed.',
    '<p>ترکیب نخ‌های سبز و قهوه‌ای برای ظاهری طبیعی. مقاوم در برابر UV و باران.</p>',
    '<p>Blend of green and brown yarns for a natural look. UV and rain resistant.</p>',
    'ارتفاع نخ|25 میلیمتر|جنس|PE + PP|عرض رول|2 متر|مقاوم UV|بله|زهکشی|دارد',
    'Yarn Height|25 mm|Material|PE + PP|Roll Width|2 m|UV Resistant|Yes|Drainage|Yes',
    'چمن تزیینی,فضای سبز,بالکن,حیاط','decorative grass,landscaping,balcony,yard','چمن مصنوعی','Artificial Grass','AG-DC-25MM','',1,
    'چمن تزیینی ۲۵mm | پروشات','چمن مصنوعی تزیینی ۲۵ میلیمتر',
    '25mm Decorative Artificial Grass | Proshut','25mm decorative artificial grass');

  P('سطل زباله پارکی چدنی مدل SP-1006','Cast Iron Park Waste Bin Model SP-1006',
    'park-bin-cast-iron-sp1006','bench-cast-iron','/images/uploads/1782631512110-308057.webp',
    'سطل زباله پارکی چدنی با پوشش رنگ کوره‌ای الکترواستاتیک، مناسب پارک‌ها، بوستان‌ها و فضاهای شهری.',
    'Cast iron park waste bin with electrostatic oven-baked coating, suitable for parks, gardens, and urban spaces.',
    'سطل زباله پارکی چدنی با بدنه مشبک از جنس چدن داکتیل، دارای مخزن داخلی گالوانیزه قابل شستشو و پایه چدنی جهت نصب روی زمین.',
    'Cast iron park waste bin with perforated ductile iron body, featuring a washable galvanized inner container and cast iron base for ground installation.',
    '<p>سطل زباله پارکی چدنی با طراحی زیبا و مقاوم، مناسب استفاده در پارک‌ها، بوستان‌ها، معابر و فضاهای شهری. بدنه از جنس چدن داکتیل یا چدن خاکستری با استحکام بالا ساخته شده و با رنگ کوره‌ای الکترواستاتیک پوشش داده شده است.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>استفاده در پارک‌ها، بوستان‌ها، معابر و فضاهای شهری</td></tr><tr><th>جنس بدنه</th><td>چدن داکتیل یا چدن خاکستری با استحکام بالا</td></tr><tr><th>نوع پوشش</th><td>رنگ کوره‌ای الکترواستاتیک مقاوم در برابر رطوبت و نور خورشید</td></tr><tr><th>ظرفیت مخزن</th><td>۵۰ تا ۷۰ لیتر (قابل سفارش)</td></tr><tr><th>ساختار</th><td>بدنه مشبک جهت تهویه و جلوگیری از تجمع بو</td></tr><tr><th>درب</th><td>دارای درب ثابت/قابل باز شدن جهت تخلیه آسان</td></tr><tr><th>سیستم تخلیه</th><td>تخلیه دستی با امکان جدا شدن مخزن داخلی</td></tr><tr><th>مخزن داخلی</th><td>ورق گالوانیزه یا پلی‌اتیلن قابل شستشو</td></tr><tr><th>پایه اتصال</th><td>دارای پایه چدنی جهت نصب روی زمین</td></tr><tr><th>روش نصب</th><td>نصب به وسیله رول‌بولت یا پیچ مهاری به کف</td></tr><tr><th>ابعاد تقریبی</th><td>ارتفاع ۸۰ تا ۱۰۰ سانتی‌متر – عرض ۴۰ تا ۵۰ سانتی‌متر</td></tr><tr><th>وزن تقریبی</th><td>۲۵ تا ۴۰ کیلوگرم (بسته به مدل)</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر ضربه، شرایط جوی و استفاده عمومی شهری</td></tr><tr><th>نگهداری</th><td>قابلیت شستشو و تعویض قطعات</td></tr><tr><th>رنگ‌بندی</th><td>طبق کد رنگ شهرداری یا سفارش کارفرما</td></tr><tr><th>استاندارد تولید</th><td>مطابق الزامات مبلمان شهری و فضای سبز</td></tr></table>',
    '<p>Cast iron park waste bin with elegant and durable design, suitable for parks, gardens, streets, and urban spaces. The body is made from high-strength ductile or gray cast iron with an electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Parks, gardens, streets, and urban spaces</td></tr><tr><th>Body Material</th><td>Ductile or gray cast iron with high strength</td></tr><tr><th>Coating</th><td>Electrostatic oven-baked paint, resistant to moisture and sunlight</td></tr><tr><th>Container Capacity</th><td>50 to 70 liters (customizable)</td></tr><tr><th>Structure</th><td>Perforated body for ventilation and odor prevention</td></tr><tr><th>Lid</th><td>Fixed or openable lid for easy emptying</td></tr><tr><th>Emptying System</th><td>Manual emptying with removable inner container</td></tr><tr><th>Inner Container</th><td>Washable galvanized sheet or polyethylene</td></tr><tr><th>Base</th><td>Cast iron base for ground installation</td></tr><tr><th>Installation</th><td>Roll-bolt or anchor bolt to floor</td></tr><tr><th>Approx. Dimensions</th><td>Height 80-100 cm – Width 40-50 cm</td></tr><tr><th>Approx. Weight</th><td>25 to 40 kg (depending on model)</td></tr><tr><th>Resistance</th><td>Impact, weather conditions, and public urban use</td></tr><tr><th>Maintenance</th><td>Washable with replaceable parts</td></tr><tr><th>Colors</th><td>Per municipality color code or client order</td></tr><tr><th>Production Standard</th><td>Compliant with urban furniture and landscaping requirements</td></tr></table>',
    'جنس بدنه|چدن داکتیل یا خاکستری|پوشش|رنگ کوره‌ای الکترواستاتیک|ظرفیت|۵۰ تا ۷۰ لیتر|ساختار|بدنه مشبک|درب|ثابت/قابل باز شدن|تخلیه|دستی با مخزن داخلی جداشونده|مخزن داخلی|گالوانیزه یا پلی‌اتیلن|نصب|رول‌بولت یا پیچ مهاری|ابعاد|ارتفاع ۸۰-۱۰۰ × عرض ۴۰-۵۰ سانتی‌متر|وزن|۲۵ تا ۴۰ کیلوگرم',
    'Body|Ductile or Gray Cast Iron|Coating|Electrostatic Oven-Baked Paint|Capacity|50-70 Liters|Structure|Perforated Body|Lid|Fixed/Openable|Emptying|Manual with Removable Inner Container|Inner Container|Galvanized or Polyethylene|Installation|Roll-bolt or Anchor Bolt|Dimensions|H 80-100 × W 40-50 cm|Weight|25-40 kg',
    'سطل زباله,پارکی,چدنی,مبلمان شهری,فضای سبز','waste bin,park,cast iron,urban furniture,landscaping','مبلمان شهری','Urban Furniture','SP-1006','',1,
    'سطل زباله پارکی چدنی مدل SP-1006 | پروشات','سطل زباله پارکی چدنی با پوشش الکترواستاتیک، مناسب پارک‌ها و فضاهای شهری',
    'Cast Iron Park Waste Bin SP-1006 | Proshut','Cast iron park waste bin with electrostatic coating for parks and urban spaces');

  P('میز پیک‌نیک پارکی مدل SP-216','Park Picnic Table Model SP-301',
    'picnic-table-sp301','bench-metal','/images/uploads/1782661900589-205469.webp',
    'میز پیک‌نیک با دو نیمکت جانبی از چوب پلاست WPC و سازه فولادی، مناسب پارک‌ها و فضای سبز.',
    'Picnic table with two side benches made from WPC wood-plastic and steel structure, suitable for parks and green spaces.',
    'میز پیک‌نیک با دو نیمکت جانبی، رویه چوب پلاست WPC مقاوم فضای باز و سازه پروفیل فولادی با پوشش کوره‌ای الکترواستاتیک.',
    'Picnic table with two side benches, WPC wood-plastic outdoor-resistant surface and welded steel profile structure with electrostatic oven-baked coating.',
    '<p>میز پیک‌نیک با دو نیمکت جانبی، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، فضای سبز و محوطه‌های عمومی. رویه از چوب پلاست WPC مقاوم فضای باز و سازه از پروفیل فولادی جوشکاری شده با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربری</th><td>پارک، بوستان، فضای سبز و محوطه‌های عمومی</td></tr><tr><th>مدل</th><td>میز پیک‌نیک با دو نیمکت جانبی</td></tr><tr><th>جنس رویه</th><td>چوب پلاست WPC مقاوم فضای باز</td></tr><tr><th>سازه</th><td>پروفیل فولادی جوشکاری شده</td></tr><tr><th>پوشش سازه</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>طول تقریبی</th><td>۱۶۰ تا ۲۰۰ سانتی‌متر</td></tr><tr><th>عرض تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع میز</th><td>۷۰ تا ۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع نیمکت</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>ضخامت چوب پلاست</th><td>حدود ۲۵ تا ۳۵ میلی‌متر</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه یا ضدزنگ</td></tr><tr><th>مزایا</th><td>مقاوم در برابر رطوبت، آفتاب، پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Picnic table with two side benches, designed for use in parks, gardens, green spaces, and public areas. Surface made from outdoor-resistant WPC wood-plastic composite and welded steel profile structure with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Parks, gardens, green spaces, and public areas</td></tr><tr><th>Model</th><td>Picnic table with two side benches</td></tr><tr><th>Surface Material</th><td>Outdoor-resistant WPC wood-plastic composite</td></tr><tr><th>Structure</th><td>Welded steel profile</td></tr><tr><th>Structure Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Approx. Length</th><td>160 to 200 cm</td></tr><tr><th>Approx. Width</th><td>150 to 180 cm</td></tr><tr><th>Table Height</th><td>70 to 80 cm</td></tr><tr><th>Bench Height</th><td>40 to 45 cm</td></tr><tr><th>WPC Thickness</th><td>Approx. 25 to 35 mm</td></tr><tr><th>Fasteners</th><td>Galvanized or stainless steel bolts and nuts</td></tr><tr><th>Advantages</th><td>Resistant to moisture, sunlight, rot, and low maintenance</td></tr></table>',
    'مدل|میز پیک‌نیک با دو نیمکت|رویه|چوب پلاست WPC|سازه|فولادی جوشکاری|پوشش|الکترواستاتیک کوره‌ای|طول|۱۶۰-۲۰۰ سانتی‌متر|عرض|۱۵۰-۱۸۰ سانتی‌متر|ارتفاع میز|۷۰-۸۰ سانتی‌متر|ارتفاع نیمکت|۴۰-۴۵ سانتی‌متر|ضخامت WPC|۲۵-۳۵ میلی‌متر|اتصالات|گالوانیزه ضدزنگ',
    'Model|Picnic Table with Two Benches|Surface|WPC Wood-Plastic|Structure|Welded Steel|Coating|Electrostatic Oven-Baked|Length|160-200 cm|Width|150-180 cm|Table Height|70-80 cm|Bench Height|40-45 cm|WPC Thickness|25-35 mm|Fasteners|Galvanized Stainless',
    'میز پیک‌نیک,چوب پلاست,پارکی,مبلمان شهری,فضای سبز','picnic table,WPC,park,urban furniture,green space','مبلمان شهری','Urban Furniture','SP-216','',1,
    'میز پیک‌نیک پارکی SP-301 | پروشات','میز پیک‌نیک با دو نیمکت جانبی از چوب پلاست WPC، مناسب پارک‌ها و فضای سبز',
    'Park Picnic Table SP-301 | Proshut','Picnic table with two side benches made from WPC for parks and green spaces');

  P('میز پیک‌نیک پارکی مدل SP-217','Park Picnic Table Model SP-302',
    'picnic-table-sp302','bench-metal','/images/uploads/1782661927509-71133.webp',
    'میز پیک‌نیک با دو نیمکت جانبی از چوب پلاست WPC و سازه فولادی، مناسب پارک‌ها و فضای سبز.',
    'Picnic table with two side benches made from WPC wood-plastic and steel structure, suitable for parks and green spaces.',
    'میز پیک‌نیک با دو نیمکت جانبی، رویه چوب پلاست WPC مقاوم فضای باز و سازه پروفیل فولادی با پوشش کوره‌ای الکترواستاتیک.',
    'Picnic table with two side benches, WPC wood-plastic outdoor-resistant surface and welded steel profile structure with electrostatic oven-baked coating.',
    '<p>میز پیک‌نیک با دو نیمکت جانبی، طراحی شده برای استفاده در پارک‌ها، بوستان‌ها، فضای سبز و محوطه‌های عمومی. رویه از چوب پلاست WPC مقاوم فضای باز و سازه از پروفیل فولادی جوشکاری شده با پوشش رنگ کوره‌ای الکترواستاتیک ضد خوردگی.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربری</th><td>پارک، بوستان، فضای سبز و محوطه‌های عمومی</td></tr><tr><th>مدل</th><td>میز پیک‌نیک با دو نیمکت جانبی</td></tr><tr><th>جنس رویه</th><td>چوب پلاست WPC مقاوم فضای باز</td></tr><tr><th>سازه</th><td>پروفیل فولادی جوشکاری شده</td></tr><tr><th>پوشش سازه</th><td>رنگ کوره‌ای الکترواستاتیک ضد خوردگی</td></tr><tr><th>طول تقریبی</th><td>۱۶۰ تا ۲۰۰ سانتی‌متر</td></tr><tr><th>عرض تقریبی</th><td>۱۵۰ تا ۱۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع میز</th><td>۷۰ تا ۸۰ سانتی‌متر</td></tr><tr><th>ارتفاع نیمکت</th><td>۴۰ تا ۴۵ سانتی‌متر</td></tr><tr><th>ضخامت چوب پلاست</th><td>حدود ۲۵ تا ۳۵ میلی‌متر</td></tr><tr><th>اتصالات</th><td>پیچ و مهره گالوانیزه یا ضدزنگ</td></tr><tr><th>مزایا</th><td>مقاوم در برابر رطوبت، آفتاب، پوسیدگی و کم‌نیاز به نگهداری</td></tr></table>',
    '<p>Picnic table with two side benches, designed for use in parks, gardens, green spaces, and public areas. Surface made from outdoor-resistant WPC wood-plastic composite and welded steel profile structure with anti-corrosion electrostatic oven-baked coating.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Parks, gardens, green spaces, and public areas</td></tr><tr><th>Model</th><td>Picnic table with two side benches</td></tr><tr><th>Surface Material</th><td>Outdoor-resistant WPC wood-plastic composite</td></tr><tr><th>Structure</th><td>Welded steel profile</td></tr><tr><th>Structure Coating</th><td>Anti-corrosion electrostatic oven-baked paint</td></tr><tr><th>Approx. Length</th><td>160 to 200 cm</td></tr><tr><th>Approx. Width</th><td>150 to 180 cm</td></tr><tr><th>Table Height</th><td>70 to 80 cm</td></tr><tr><th>Bench Height</th><td>40 to 45 cm</td></tr><tr><th>WPC Thickness</th><td>Approx. 25 to 35 mm</td></tr><tr><th>Fasteners</th><td>Galvanized or stainless steel bolts and nuts</td></tr><tr><th>Advantages</th><td>Resistant to moisture, sunlight, rot, and low maintenance</td></tr></table>',
    'مدل|میز پیک‌نیک با دو نیمکت|رویه|چوب پلاست WPC|سازه|فولادی جوشکاری|پوشش|الکترواستاتیک کوره‌ای|طول|۱۶۰-۲۰۰ سانتی‌متر|عرض|۱۵۰-۱۸۰ سانتی‌متر|ارتفاع میز|۷۰-۸۰ سانتی‌متر|ارتفاع نیمکت|۴۰-۴۵ سانتی‌متر|ضخامت WPC|۲۵-۳۵ میلی‌متر|اتصالات|گالوانیزه ضدزنگ',
    'Model|Picnic Table with Two Benches|Surface|WPC Wood-Plastic|Structure|Welded Steel|Coating|Electrostatic Oven-Baked|Length|160-200 cm|Width|150-180 cm|Table Height|70-80 cm|Bench Height|40-45 cm|WPC Thickness|25-35 mm|Fasteners|Galvanized Stainless',
    'میز پیک‌نیک,چوب پلاست,پارکی,مبلمان شهری,فضای سبز','picnic table,WPC,park,urban furniture,green space','مبلمان شهری','Urban Furniture','SP-217','',1,
    'میز پیک‌نیک پارکی SP-302 | پروشات','میز پیک‌نیک با دو نیمکت جانبی از چوب پلاست WPC، مناسب پارک‌ها و فضای سبز',
    'Park Picnic Table SP-302 | Proshut','Picnic table with two side benches made from WPC for parks and green spaces');

  P('تاب سرسره دلفین مدل PS5101','Dolphin Swing Slide Model PS5101',
    'dolphin-swing-slide-ps5101','nursery-home','/images/uploads/1782659868934-413548.png',
    'تجهیزات بازی مهدکودکی پلی‌اتیلنی، ساخت به روش قالب‌گیری دورانی، ایمن و بهداشتی.',
    'Polyethylene nursery play equipment, rotational molding, safe and hygienic.',
    'تجهیزات بازی مهدکودکی از پلی‌اتیلن فشرده HDPE، یکپارچه و بدون درز، مناسب مهدکودک و فضای سرپوشیده.',
    'Nursery play equipment made from HDPE polyethylene, one-piece and seamless, suitable for nurseries and indoor spaces.',
    '<p>تجهیزات بازی مهدکودکی پلی‌اتیلنی با طراحی ایمن و جذاب برای کودکان. ساخته شده از پلی‌اتیلن فشرده (HDPE) به روش قالب‌گیری دورانی، یکپارچه و بدون درز با لبه‌های گرد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>مناسب مهدکودک، خانه بازی، فضاهای سرپوشیده و بازی کودک</td></tr><tr><th>جنس بدنه</th><td>پلی‌اتیلن فشرده (HDPE) مقاوم و بهداشتی</td></tr><tr><th>روش تولید</th><td>قالب‌گیری دورانی (Rotational Molding)</td></tr><tr><th>ساختار</th><td>یکپارچه، بدون درز و دارای لبه‌های گرد</td></tr><tr><th>مواد اولیه</th><td>پلی‌اتیلن گرید مرغوب و غیرسمی</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر ضربه و استفاده مداوم کودکان</td></tr><tr><th>رنگ‌بندی</th><td>رنگ‌های شاد کودکانه با مواد پایدار</td></tr><tr><th>سرسره</th><td>پلی‌اتیلن یکپارچه با سطح صاف و ایمن</td></tr><tr><th>ایمنی</th><td>فاقد گوشه تیز و قطعات خطرناک</td></tr><tr><th>شستشو</th><td>قابل شستشو و مقاوم در برابر رطوبت</td></tr><tr><th>رده سنی</th><td>معمولاً ۲ تا ۸ سال متناسب با مدل</td></tr><tr><th>نصب</th><td>نصب آسان و بدون عملیات عمرانی سنگین</td></tr><tr><th>نگهداری</th><td>بدون نیاز به رنگ‌آمیزی دوره‌ای</td></tr><tr><th>کنترل کیفیت</th><td>بررسی استحکام، ایمنی و کیفیت مواد اولیه</td></tr><tr><th>تایید نهایی</th><td>تایید نمونه توسط کارفرما قبل از تحویل</td></tr><tr><th>ابعاد</th><td>۲۱۰×۱۳۰×۱۲۵ سانتی‌متر</td></tr><tr><th>حجم بسته‌بندی</th><td>0.28 m3</td></tr><tr><th>رنگ‌بندی</th><td>سبزآبی، طوسی / آبی روشن، طوسی</td></tr></table>',
    '<p>Polyethylene nursery play equipment with safe and attractive design for children. Made from high-density polyethylene (HDPE) by rotational molding, seamless and one-piece with rounded edges.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Nurseries, playhouses, indoor spaces, and children play areas</td></tr><tr><th>Body Material</th><td>High-density polyethylene (HDPE), durable and hygienic</td></tr><tr><th>Production Method</th><td>Rotational Molding</td></tr><tr><th>Structure</th><td>One-piece, seamless with rounded edges</td></tr><tr><th>Raw Materials</th><td>Premium grade non-toxic polyethylene</td></tr><tr><th>Resistance</th><td>Impact resistant, suitable for continuous children use</td></tr><tr><th>Colors</th><td>Cheerful children colors with stable materials</td></tr><tr><th>Slide</th><td>One-piece polyethylene with smooth and safe surface</td></tr><tr><th>Safety</th><td>No sharp corners or hazardous parts</td></tr><tr><th>Washing</th><td>Washable and moisture resistant</td></tr><tr><th>Age Group</th><td>Usually 2 to 8 years depending on model</td></tr><tr><th>Installation</th><td>Easy installation without heavy construction</td></tr><tr><th>Maintenance</th><td>No periodic painting required</td></tr><tr><th>Quality Control</th><td>Strength, safety, and raw material quality inspection</td></tr><tr><th>Final Approval</th><td>Sample approval by client before delivery</td></tr><tr><th>Dimensions</th><td>210×130×125 cm</td></tr><tr><th>Package Volume</th><td>0.28 m3</td></tr><tr><th>Colors</th><td>Aqua Green, Gray / Light Blue, Gray</td></tr></table>',
    'جنس|پلی‌اتیلن HDPE|روش تولید|قالب‌گیری دورانی|ابعاد|۲۱۰×۱۳۰×۱۲۵ سانتی‌متر|حجم بسته‌بندی|0.28 m3|رنگ‌بندی|سبزآبی، طوسی / آبی روشن، طوسی|رده سنی|۲ تا ۸ سال|ایمنی|بدون گوشه تیز',
    'Material|HDPE Polyethylene|Production|Rotational Molding|Dimensions|210×130×125 cm|Package Volume|0.28 m3|Colors|Aqua Green, Gray / Light Blue, Gray|Age Group|2-8 years|Safety|No sharp corners',
    'سرسره,تاب,مهدکودک,پلی‌اتیلن,بازی کودک','slide,swing,nursery,polyethylene,kids play','وسایل بازی خانگی','Home Play Equipment','PS5101','',1,
    'تاب سرسره دلفین PS5101 | پروشات','تاب سرسره دلفین پلی‌اتیلنی مدل PS5101',
    'Dolphin Swing Slide PS5101 | Proshut','Dolphin Swing Slide polyethylene model PS5101');

  P('سرسره دلفین مدل PS5102','Dolphin Slide Model PS5102',
    'dolphin-slide-ps5102','nursery-home','/images/uploads/1782659896586-174049.png',
    'تجهیزات بازی مهدکودکی پلی‌اتیلنی، ساخت به روش قالب‌گیری دورانی، ایمن و بهداشتی.',
    'Polyethylene nursery play equipment, rotational molding, safe and hygienic.',
    'تجهیزات بازی مهدکودکی از پلی‌اتیلن فشرده HDPE، یکپارچه و بدون درز، مناسب مهدکودک و فضای سرپوشیده.',
    'Nursery play equipment made from HDPE polyethylene, one-piece and seamless, suitable for nurseries and indoor spaces.',
    '<p>تجهیزات بازی مهدکودکی پلی‌اتیلنی با طراحی ایمن و جذاب برای کودکان. ساخته شده از پلی‌اتیلن فشرده (HDPE) به روش قالب‌گیری دورانی، یکپارچه و بدون درز با لبه‌های گرد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>مناسب مهدکودک، خانه بازی، فضاهای سرپوشیده و بازی کودک</td></tr><tr><th>جنس بدنه</th><td>پلی‌اتیلن فشرده (HDPE) مقاوم و بهداشتی</td></tr><tr><th>روش تولید</th><td>قالب‌گیری دورانی (Rotational Molding)</td></tr><tr><th>ساختار</th><td>یکپارچه، بدون درز و دارای لبه‌های گرد</td></tr><tr><th>مواد اولیه</th><td>پلی‌اتیلن گرید مرغوب و غیرسمی</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر ضربه و استفاده مداوم کودکان</td></tr><tr><th>رنگ‌بندی</th><td>رنگ‌های شاد کودکانه با مواد پایدار</td></tr><tr><th>سرسره</th><td>پلی‌اتیلن یکپارچه با سطح صاف و ایمن</td></tr><tr><th>ایمنی</th><td>فاقد گوشه تیز و قطعات خطرناک</td></tr><tr><th>شستشو</th><td>قابل شستشو و مقاوم در برابر رطوبت</td></tr><tr><th>رده سنی</th><td>معمولاً ۲ تا ۸ سال متناسب با مدل</td></tr><tr><th>نصب</th><td>نصب آسان و بدون عملیات عمرانی سنگین</td></tr><tr><th>نگهداری</th><td>بدون نیاز به رنگ‌آمیزی دوره‌ای</td></tr><tr><th>کنترل کیفیت</th><td>بررسی استحکام، ایمنی و کیفیت مواد اولیه</td></tr><tr><th>تایید نهایی</th><td>تایید نمونه توسط کارفرما قبل از تحویل</td></tr><tr><th>ابعاد</th><td>۱۹۰×۵۰×۱۰۵ سانتی‌متر</td></tr><tr><th>حجم بسته‌بندی</th><td>0.18 m3</td></tr><tr><th>رنگ‌بندی</th><td>سبزآبی، طوسی / آبی روشن، طوسی</td></tr></table>',
    '<p>Polyethylene nursery play equipment with safe and attractive design for children. Made from high-density polyethylene (HDPE) by rotational molding, seamless and one-piece with rounded edges.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Nurseries, playhouses, indoor spaces, and children play areas</td></tr><tr><th>Body Material</th><td>High-density polyethylene (HDPE), durable and hygienic</td></tr><tr><th>Production Method</th><td>Rotational Molding</td></tr><tr><th>Structure</th><td>One-piece, seamless with rounded edges</td></tr><tr><th>Raw Materials</th><td>Premium grade non-toxic polyethylene</td></tr><tr><th>Resistance</th><td>Impact resistant, suitable for continuous children use</td></tr><tr><th>Colors</th><td>Cheerful children colors with stable materials</td></tr><tr><th>Slide</th><td>One-piece polyethylene with smooth and safe surface</td></tr><tr><th>Safety</th><td>No sharp corners or hazardous parts</td></tr><tr><th>Washing</th><td>Washable and moisture resistant</td></tr><tr><th>Age Group</th><td>Usually 2 to 8 years depending on model</td></tr><tr><th>Installation</th><td>Easy installation without heavy construction</td></tr><tr><th>Maintenance</th><td>No periodic painting required</td></tr><tr><th>Quality Control</th><td>Strength, safety, and raw material quality inspection</td></tr><tr><th>Final Approval</th><td>Sample approval by client before delivery</td></tr><tr><th>Dimensions</th><td>190×50×105 cm</td></tr><tr><th>Package Volume</th><td>0.18 m3</td></tr><tr><th>Colors</th><td>Aqua Green, Gray / Light Blue, Gray</td></tr></table>',
    'جنس|پلی‌اتیلن HDPE|روش تولید|قالب‌گیری دورانی|ابعاد|۱۹۰×۵۰×۱۰۵ سانتی‌متر|حجم بسته‌بندی|0.18 m3|رنگ‌بندی|سبزآبی، طوسی / آبی روشن، طوسی|رده سنی|۲ تا ۸ سال|ایمنی|بدون گوشه تیز',
    'Material|HDPE Polyethylene|Production|Rotational Molding|Dimensions|190×50×105 cm|Package Volume|0.18 m3|Colors|Aqua Green, Gray / Light Blue, Gray|Age Group|2-8 years|Safety|No sharp corners',
    'سرسره,تاب,مهدکودک,پلی‌اتیلن,بازی کودک','slide,swing,nursery,polyethylene,kids play','وسایل بازی خانگی','Home Play Equipment','PS5102','',1,
    'سرسره دلفین PS5102 | پروشات','سرسره دلفین پلی‌اتیلنی مدل PS5102',
    'Dolphin Slide PS5102 | Proshut','Dolphin Slide polyethylene model PS5102');

  P('تاب سرسره سنجاب مدل PS5107','Squirrel Swing Slide Model PS5107',
    'squirrel-swing-slide-ps5107','nursery-home','/images/uploads/1782659932504-407636.png',
    'تجهیزات بازی مهدکودکی پلی‌اتیلنی، ساخت به روش قالب‌گیری دورانی، ایمن و بهداشتی.',
    'Polyethylene nursery play equipment, rotational molding, safe and hygienic.',
    'تجهیزات بازی مهدکودکی از پلی‌اتیلن فشرده HDPE، یکپارچه و بدون درز، مناسب مهدکودک و فضای سرپوشیده.',
    'Nursery play equipment made from HDPE polyethylene, one-piece and seamless, suitable for nurseries and indoor spaces.',
    '<p>تجهیزات بازی مهدکودکی پلی‌اتیلنی با طراحی ایمن و جذاب برای کودکان. ساخته شده از پلی‌اتیلن فشرده (HDPE) به روش قالب‌گیری دورانی، یکپارچه و بدون درز با لبه‌های گرد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>مناسب مهدکودک، خانه بازی، فضاهای سرپوشیده و بازی کودک</td></tr><tr><th>جنس بدنه</th><td>پلی‌اتیلن فشرده (HDPE) مقاوم و بهداشتی</td></tr><tr><th>روش تولید</th><td>قالب‌گیری دورانی (Rotational Molding)</td></tr><tr><th>ساختار</th><td>یکپارچه، بدون درز و دارای لبه‌های گرد</td></tr><tr><th>مواد اولیه</th><td>پلی‌اتیلن گرید مرغوب و غیرسمی</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر ضربه و استفاده مداوم کودکان</td></tr><tr><th>رنگ‌بندی</th><td>رنگ‌های شاد کودکانه با مواد پایدار</td></tr><tr><th>سرسره</th><td>پلی‌اتیلن یکپارچه با سطح صاف و ایمن</td></tr><tr><th>ایمنی</th><td>فاقد گوشه تیز و قطعات خطرناک</td></tr><tr><th>شستشو</th><td>قابل شستشو و مقاوم در برابر رطوبت</td></tr><tr><th>رده سنی</th><td>معمولاً ۲ تا ۸ سال متناسب با مدل</td></tr><tr><th>نصب</th><td>نصب آسان و بدون عملیات عمرانی سنگین</td></tr><tr><th>نگهداری</th><td>بدون نیاز به رنگ‌آمیزی دوره‌ای</td></tr><tr><th>کنترل کیفیت</th><td>بررسی استحکام، ایمنی و کیفیت مواد اولیه</td></tr><tr><th>تایید نهایی</th><td>تایید نمونه توسط کارفرما قبل از تحویل</td></tr><tr><th>ابعاد</th><td>۱۸۵×۱۳۰×۱۳۰ سانتی‌متر</td></tr><tr><th>حجم بسته‌بندی</th><td>0.36 m3</td></tr><tr><th>رنگ‌بندی</th><td>زرد، طوسی</td></tr></table>',
    '<p>Polyethylene nursery play equipment with safe and attractive design for children. Made from high-density polyethylene (HDPE) by rotational molding, seamless and one-piece with rounded edges.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Nurseries, playhouses, indoor spaces, and children play areas</td></tr><tr><th>Body Material</th><td>High-density polyethylene (HDPE), durable and hygienic</td></tr><tr><th>Production Method</th><td>Rotational Molding</td></tr><tr><th>Structure</th><td>One-piece, seamless with rounded edges</td></tr><tr><th>Raw Materials</th><td>Premium grade non-toxic polyethylene</td></tr><tr><th>Resistance</th><td>Impact resistant, suitable for continuous children use</td></tr><tr><th>Colors</th><td>Cheerful children colors with stable materials</td></tr><tr><th>Slide</th><td>One-piece polyethylene with smooth and safe surface</td></tr><tr><th>Safety</th><td>No sharp corners or hazardous parts</td></tr><tr><th>Washing</th><td>Washable and moisture resistant</td></tr><tr><th>Age Group</th><td>Usually 2 to 8 years depending on model</td></tr><tr><th>Installation</th><td>Easy installation without heavy construction</td></tr><tr><th>Maintenance</th><td>No periodic painting required</td></tr><tr><th>Quality Control</th><td>Strength, safety, and raw material quality inspection</td></tr><tr><th>Final Approval</th><td>Sample approval by client before delivery</td></tr><tr><th>Dimensions</th><td>185×130×130 cm</td></tr><tr><th>Package Volume</th><td>0.36 m3</td></tr><tr><th>Colors</th><td>Yellow, Gray</td></tr></table>',
    'جنس|پلی‌اتیلن HDPE|روش تولید|قالب‌گیری دورانی|ابعاد|۱۸۵×۱۳۰×۱۳۰ سانتی‌متر|حجم بسته‌بندی|0.36 m3|رنگ‌بندی|زرد، طوسی|رده سنی|۲ تا ۸ سال|ایمنی|بدون گوشه تیز',
    'Material|HDPE Polyethylene|Production|Rotational Molding|Dimensions|185×130×130 cm|Package Volume|0.36 m3|Colors|Yellow, Gray|Age Group|2-8 years|Safety|No sharp corners',
    'سرسره,تاب,مهدکودک,پلی‌اتیلن,بازی کودک','slide,swing,nursery,polyethylene,kids play','وسایل بازی خانگی','Home Play Equipment','PS5107','',1,
    'تاب سرسره سنجاب PS5107 | پروشات','تاب سرسره سنجاب پلی‌اتیلنی مدل PS5107',
    'Squirrel Swing Slide PS5107 | Proshut','Squirrel Swing Slide polyethylene model PS5107');

  P('سرسره سنجاب مدل PS5108','Squirrel Slide Model PS5108',
    'squirrel-slide-ps5108','nursery-home','/images/uploads/1782661726996-282963.png',
    'تجهیزات بازی مهدکودکی پلی‌اتیلنی، ساخت به روش قالب‌گیری دورانی، ایمن و بهداشتی.',
    'Polyethylene nursery play equipment, rotational molding, safe and hygienic.',
    'تجهیزات بازی مهدکودکی از پلی‌اتیلن فشرده HDPE، یکپارچه و بدون درز، مناسب مهدکودک و فضای سرپوشیده.',
    'Nursery play equipment made from HDPE polyethylene, one-piece and seamless, suitable for nurseries and indoor spaces.',
    '<p>تجهیزات بازی مهدکودکی پلی‌اتیلنی با طراحی ایمن و جذاب برای کودکان. ساخته شده از پلی‌اتیلن فشرده (HDPE) به روش قالب‌گیری دورانی، یکپارچه و بدون درز با لبه‌های گرد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>مناسب مهدکودک، خانه بازی، فضاهای سرپوشیده و بازی کودک</td></tr><tr><th>جنس بدنه</th><td>پلی‌اتیلن فشرده (HDPE) مقاوم و بهداشتی</td></tr><tr><th>روش تولید</th><td>قالب‌گیری دورانی (Rotational Molding)</td></tr><tr><th>ساختار</th><td>یکپارچه، بدون درز و دارای لبه‌های گرد</td></tr><tr><th>مواد اولیه</th><td>پلی‌اتیلن گرید مرغوب و غیرسمی</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر ضربه و استفاده مداوم کودکان</td></tr><tr><th>رنگ‌بندی</th><td>رنگ‌های شاد کودکانه با مواد پایدار</td></tr><tr><th>سرسره</th><td>پلی‌اتیلن یکپارچه با سطح صاف و ایمن</td></tr><tr><th>ایمنی</th><td>فاقد گوشه تیز و قطعات خطرناک</td></tr><tr><th>شستشو</th><td>قابل شستشو و مقاوم در برابر رطوبت</td></tr><tr><th>رده سنی</th><td>معمولاً ۲ تا ۸ سال متناسب با مدل</td></tr><tr><th>نصب</th><td>نصب آسان و بدون عملیات عمرانی سنگین</td></tr><tr><th>نگهداری</th><td>بدون نیاز به رنگ‌آمیزی دوره‌ای</td></tr><tr><th>کنترل کیفیت</th><td>بررسی استحکام، ایمنی و کیفیت مواد اولیه</td></tr><tr><th>تایید نهایی</th><td>تایید نمونه توسط کارفرما قبل از تحویل</td></tr><tr><th>ابعاد</th><td>۱۸۵×۵۰×۱۱۰ سانتی‌متر</td></tr><tr><th>حجم بسته‌بندی</th><td>0.2 m3</td></tr><tr><th>رنگ‌بندی</th><td>زرد، طوسی</td></tr></table>',
    '<p>Polyethylene nursery play equipment with safe and attractive design for children. Made from high-density polyethylene (HDPE) by rotational molding, seamless and one-piece with rounded edges.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Nurseries, playhouses, indoor spaces, and children play areas</td></tr><tr><th>Body Material</th><td>High-density polyethylene (HDPE), durable and hygienic</td></tr><tr><th>Production Method</th><td>Rotational Molding</td></tr><tr><th>Structure</th><td>One-piece, seamless with rounded edges</td></tr><tr><th>Raw Materials</th><td>Premium grade non-toxic polyethylene</td></tr><tr><th>Resistance</th><td>Impact resistant, suitable for continuous children use</td></tr><tr><th>Colors</th><td>Cheerful children colors with stable materials</td></tr><tr><th>Slide</th><td>One-piece polyethylene with smooth and safe surface</td></tr><tr><th>Safety</th><td>No sharp corners or hazardous parts</td></tr><tr><th>Washing</th><td>Washable and moisture resistant</td></tr><tr><th>Age Group</th><td>Usually 2 to 8 years depending on model</td></tr><tr><th>Installation</th><td>Easy installation without heavy construction</td></tr><tr><th>Maintenance</th><td>No periodic painting required</td></tr><tr><th>Quality Control</th><td>Strength, safety, and raw material quality inspection</td></tr><tr><th>Final Approval</th><td>Sample approval by client before delivery</td></tr><tr><th>Dimensions</th><td>185×50×110 cm</td></tr><tr><th>Package Volume</th><td>0.2 m3</td></tr><tr><th>Colors</th><td>Yellow, Gray</td></tr></table>',
    'جنس|پلی‌اتیلن HDPE|روش تولید|قالب‌گیری دورانی|ابعاد|۱۸۵×۵۰×۱۱۰ سانتی‌متر|حجم بسته‌بندی|0.2 m3|رنگ‌بندی|زرد، طوسی|رده سنی|۲ تا ۸ سال|ایمنی|بدون گوشه تیز',
    'Material|HDPE Polyethylene|Production|Rotational Molding|Dimensions|185×50×110 cm|Package Volume|0.2 m3|Colors|Yellow, Gray|Age Group|2-8 years|Safety|No sharp corners',
    'سرسره,تاب,مهدکودک,پلی‌اتیلن,بازی کودک','slide,swing,nursery,polyethylene,kids play','وسایل بازی خانگی','Home Play Equipment','PS5108','',1,
    'سرسره سنجاب PS5108 | پروشات','سرسره سنجاب پلی‌اتیلنی مدل PS5108',
    'Squirrel Slide PS5108 | Proshut','Squirrel Slide polyethylene model PS5108');

  P('تاب سرسره ABCD مدل PS5110','ABCD Swing Slide Model PS5110',
    'abcd-swing-slide-ps5110','nursery-home','/images/uploads/1782660046361-350356.png',
    'تجهیزات بازی مهدکودکی پلی‌اتیلنی، ساخت به روش قالب‌گیری دورانی، ایمن و بهداشتی.',
    'Polyethylene nursery play equipment, rotational molding, safe and hygienic.',
    'تجهیزات بازی مهدکودکی از پلی‌اتیلن فشرده HDPE، یکپارچه و بدون درز، مناسب مهدکودک و فضای سرپوشیده.',
    'Nursery play equipment made from HDPE polyethylene, one-piece and seamless, suitable for nurseries and indoor spaces.',
    '<p>تجهیزات بازی مهدکودکی پلی‌اتیلنی با طراحی ایمن و جذاب برای کودکان. ساخته شده از پلی‌اتیلن فشرده (HDPE) به روش قالب‌گیری دورانی، یکپارچه و بدون درز با لبه‌های گرد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>مناسب مهدکودک، خانه بازی، فضاهای سرپوشیده و بازی کودک</td></tr><tr><th>جنس بدنه</th><td>پلی‌اتیلن فشرده (HDPE) مقاوم و بهداشتی</td></tr><tr><th>روش تولید</th><td>قالب‌گیری دورانی (Rotational Molding)</td></tr><tr><th>ساختار</th><td>یکپارچه، بدون درز و دارای لبه‌های گرد</td></tr><tr><th>مواد اولیه</th><td>پلی‌اتیلن گرید مرغوب و غیرسمی</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر ضربه و استفاده مداوم کودکان</td></tr><tr><th>رنگ‌بندی</th><td>رنگ‌های شاد کودکانه با مواد پایدار</td></tr><tr><th>سرسره</th><td>پلی‌اتیلن یکپارچه با سطح صاف و ایمن</td></tr><tr><th>ایمنی</th><td>فاقد گوشه تیز و قطعات خطرناک</td></tr><tr><th>شستشو</th><td>قابل شستشو و مقاوم در برابر رطوبت</td></tr><tr><th>رده سنی</th><td>معمولاً ۲ تا ۸ سال متناسب با مدل</td></tr><tr><th>نصب</th><td>نصب آسان و بدون عملیات عمرانی سنگین</td></tr><tr><th>نگهداری</th><td>بدون نیاز به رنگ‌آمیزی دوره‌ای</td></tr><tr><th>کنترل کیفیت</th><td>بررسی استحکام، ایمنی و کیفیت مواد اولیه</td></tr><tr><th>تایید نهایی</th><td>تایید نمونه توسط کارفرما قبل از تحویل</td></tr><tr><th>ابعاد</th><td>۱۷۵×۱۲۵×۱۲۵ سانتی‌متر</td></tr><tr><th>حجم بسته‌بندی</th><td>0.32 m3</td></tr><tr><th>رنگ‌بندی</th><td>سبزآبی، طوسی</td></tr></table>',
    '<p>Polyethylene nursery play equipment with safe and attractive design for children. Made from high-density polyethylene (HDPE) by rotational molding, seamless and one-piece with rounded edges.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Nurseries, playhouses, indoor spaces, and children play areas</td></tr><tr><th>Body Material</th><td>High-density polyethylene (HDPE), durable and hygienic</td></tr><tr><th>Production Method</th><td>Rotational Molding</td></tr><tr><th>Structure</th><td>One-piece, seamless with rounded edges</td></tr><tr><th>Raw Materials</th><td>Premium grade non-toxic polyethylene</td></tr><tr><th>Resistance</th><td>Impact resistant, suitable for continuous children use</td></tr><tr><th>Colors</th><td>Cheerful children colors with stable materials</td></tr><tr><th>Slide</th><td>One-piece polyethylene with smooth and safe surface</td></tr><tr><th>Safety</th><td>No sharp corners or hazardous parts</td></tr><tr><th>Washing</th><td>Washable and moisture resistant</td></tr><tr><th>Age Group</th><td>Usually 2 to 8 years depending on model</td></tr><tr><th>Installation</th><td>Easy installation without heavy construction</td></tr><tr><th>Maintenance</th><td>No periodic painting required</td></tr><tr><th>Quality Control</th><td>Strength, safety, and raw material quality inspection</td></tr><tr><th>Final Approval</th><td>Sample approval by client before delivery</td></tr><tr><th>Dimensions</th><td>175×125×125 cm</td></tr><tr><th>Package Volume</th><td>0.32 m3</td></tr><tr><th>Colors</th><td>Aqua Green, Gray</td></tr></table>',
    'جنس|پلی‌اتیلن HDPE|روش تولید|قالب‌گیری دورانی|ابعاد|۱۷۵×۱۲۵×۱۲۵ سانتی‌متر|حجم بسته‌بندی|0.32 m3|رنگ‌بندی|سبزآبی، طوسی|رده سنی|۲ تا ۸ سال|ایمنی|بدون گوشه تیز',
    'Material|HDPE Polyethylene|Production|Rotational Molding|Dimensions|175×125×125 cm|Package Volume|0.32 m3|Colors|Aqua Green, Gray|Age Group|2-8 years|Safety|No sharp corners',
    'سرسره,تاب,مهدکودک,پلی‌اتیلن,بازی کودک','slide,swing,nursery,polyethylene,kids play','وسایل بازی خانگی','Home Play Equipment','PS5110','',1,
    'تاب سرسره ABCD PS5110 | پروشات','تاب سرسره ABCD پلی‌اتیلنی مدل PS5110',
    'ABCD Swing Slide PS5110 | Proshut','ABCD Swing Slide polyethylene model PS5110');

  P('سرسره ABCD مدل PS5111','ABCD Slide Model PS5111',
    'abcd-slide-ps5111','nursery-home','/images/uploads/1782660057407-370310.png',
    'تجهیزات بازی مهدکودکی پلی‌اتیلنی، ساخت به روش قالب‌گیری دورانی، ایمن و بهداشتی.',
    'Polyethylene nursery play equipment, rotational molding, safe and hygienic.',
    'تجهیزات بازی مهدکودکی از پلی‌اتیلن فشرده HDPE، یکپارچه و بدون درز، مناسب مهدکودک و فضای سرپوشیده.',
    'Nursery play equipment made from HDPE polyethylene, one-piece and seamless, suitable for nurseries and indoor spaces.',
    '<p>تجهیزات بازی مهدکودکی پلی‌اتیلنی با طراحی ایمن و جذاب برای کودکان. ساخته شده از پلی‌اتیلن فشرده (HDPE) به روش قالب‌گیری دورانی، یکپارچه و بدون درز با لبه‌های گرد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>مناسب مهدکودک، خانه بازی، فضاهای سرپوشیده و بازی کودک</td></tr><tr><th>جنس بدنه</th><td>پلی‌اتیلن فشرده (HDPE) مقاوم و بهداشتی</td></tr><tr><th>روش تولید</th><td>قالب‌گیری دورانی (Rotational Molding)</td></tr><tr><th>ساختار</th><td>یکپارچه، بدون درز و دارای لبه‌های گرد</td></tr><tr><th>مواد اولیه</th><td>پلی‌اتیلن گرید مرغوب و غیرسمی</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر ضربه و استفاده مداوم کودکان</td></tr><tr><th>رنگ‌بندی</th><td>رنگ‌های شاد کودکانه با مواد پایدار</td></tr><tr><th>سرسره</th><td>پلی‌اتیلن یکپارچه با سطح صاف و ایمن</td></tr><tr><th>ایمنی</th><td>فاقد گوشه تیز و قطعات خطرناک</td></tr><tr><th>شستشو</th><td>قابل شستشو و مقاوم در برابر رطوبت</td></tr><tr><th>رده سنی</th><td>معمولاً ۲ تا ۸ سال متناسب با مدل</td></tr><tr><th>نصب</th><td>نصب آسان و بدون عملیات عمرانی سنگین</td></tr><tr><th>نگهداری</th><td>بدون نیاز به رنگ‌آمیزی دوره‌ای</td></tr><tr><th>کنترل کیفیت</th><td>بررسی استحکام، ایمنی و کیفیت مواد اولیه</td></tr><tr><th>تایید نهایی</th><td>تایید نمونه توسط کارفرما قبل از تحویل</td></tr><tr><th>ابعاد</th><td>۱۷۰×۵۰×۱۱۰ سانتی‌متر</td></tr><tr><th>حجم بسته‌بندی</th><td>0.19 m3</td></tr><tr><th>رنگ‌بندی</th><td>سبزآبی، طوسی</td></tr></table>',
    '<p>Polyethylene nursery play equipment with safe and attractive design for children. Made from high-density polyethylene (HDPE) by rotational molding, seamless and one-piece with rounded edges.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Nurseries, playhouses, indoor spaces, and children play areas</td></tr><tr><th>Body Material</th><td>High-density polyethylene (HDPE), durable and hygienic</td></tr><tr><th>Production Method</th><td>Rotational Molding</td></tr><tr><th>Structure</th><td>One-piece, seamless with rounded edges</td></tr><tr><th>Raw Materials</th><td>Premium grade non-toxic polyethylene</td></tr><tr><th>Resistance</th><td>Impact resistant, suitable for continuous children use</td></tr><tr><th>Colors</th><td>Cheerful children colors with stable materials</td></tr><tr><th>Slide</th><td>One-piece polyethylene with smooth and safe surface</td></tr><tr><th>Safety</th><td>No sharp corners or hazardous parts</td></tr><tr><th>Washing</th><td>Washable and moisture resistant</td></tr><tr><th>Age Group</th><td>Usually 2 to 8 years depending on model</td></tr><tr><th>Installation</th><td>Easy installation without heavy construction</td></tr><tr><th>Maintenance</th><td>No periodic painting required</td></tr><tr><th>Quality Control</th><td>Strength, safety, and raw material quality inspection</td></tr><tr><th>Final Approval</th><td>Sample approval by client before delivery</td></tr><tr><th>Dimensions</th><td>170×50×110 cm</td></tr><tr><th>Package Volume</th><td>0.19 m3</td></tr><tr><th>Colors</th><td>Aqua Green, Gray</td></tr></table>',
    'جنس|پلی‌اتیلن HDPE|روش تولید|قالب‌گیری دورانی|ابعاد|۱۷۰×۵۰×۱۱۰ سانتی‌متر|حجم بسته‌بندی|0.19 m3|رنگ‌بندی|سبزآبی، طوسی|رده سنی|۲ تا ۸ سال|ایمنی|بدون گوشه تیز',
    'Material|HDPE Polyethylene|Production|Rotational Molding|Dimensions|170×50×110 cm|Package Volume|0.19 m3|Colors|Aqua Green, Gray|Age Group|2-8 years|Safety|No sharp corners',
    'سرسره,تاب,مهدکودک,پلی‌اتیلن,بازی کودک','slide,swing,nursery,polyethylene,kids play','وسایل بازی خانگی','Home Play Equipment','PS5111','',1,
    'سرسره ABCD PS5111 | پروشات','سرسره ABCD پلی‌اتیلنی مدل PS5111',
    'ABCD Slide PS5111 | Proshut','ABCD Slide polyethylene model PS5111');

  P('سرسره ۲۲۰ خرگوش مدل PS5135','Rabbit 220 Slide Model PS5135',
    'rabbit-220-slide-ps5135','nursery-home','/images/uploads/1782660077372-299017.png',
    'تجهیزات بازی مهدکودکی پلی‌اتیلنی، ساخت به روش قالب‌گیری دورانی، ایمن و بهداشتی.',
    'Polyethylene nursery play equipment, rotational molding, safe and hygienic.',
    'تجهیزات بازی مهدکودکی از پلی‌اتیلن فشرده HDPE، یکپارچه و بدون درز، مناسب مهدکودک و فضای سرپوشیده.',
    'Nursery play equipment made from HDPE polyethylene, one-piece and seamless, suitable for nurseries and indoor spaces.',
    '<p>تجهیزات بازی مهدکودکی پلی‌اتیلنی با طراحی ایمن و جذاب برای کودکان. ساخته شده از پلی‌اتیلن فشرده (HDPE) به روش قالب‌گیری دورانی، یکپارچه و بدون درز با لبه‌های گرد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>مناسب مهدکودک، خانه بازی، فضاهای سرپوشیده و بازی کودک</td></tr><tr><th>جنس بدنه</th><td>پلی‌اتیلن فشرده (HDPE) مقاوم و بهداشتی</td></tr><tr><th>روش تولید</th><td>قالب‌گیری دورانی (Rotational Molding)</td></tr><tr><th>ساختار</th><td>یکپارچه، بدون درز و دارای لبه‌های گرد</td></tr><tr><th>مواد اولیه</th><td>پلی‌اتیلن گرید مرغوب و غیرسمی</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر ضربه و استفاده مداوم کودکان</td></tr><tr><th>رنگ‌بندی</th><td>رنگ‌های شاد کودکانه با مواد پایدار</td></tr><tr><th>سرسره</th><td>پلی‌اتیلن یکپارچه با سطح صاف و ایمن</td></tr><tr><th>ایمنی</th><td>فاقد گوشه تیز و قطعات خطرناک</td></tr><tr><th>شستشو</th><td>قابل شستشو و مقاوم در برابر رطوبت</td></tr><tr><th>رده سنی</th><td>معمولاً ۲ تا ۸ سال متناسب با مدل</td></tr><tr><th>نصب</th><td>نصب آسان و بدون عملیات عمرانی سنگین</td></tr><tr><th>نگهداری</th><td>بدون نیاز به رنگ‌آمیزی دوره‌ای</td></tr><tr><th>کنترل کیفیت</th><td>بررسی استحکام، ایمنی و کیفیت مواد اولیه</td></tr><tr><th>تایید نهایی</th><td>تایید نمونه توسط کارفرما قبل از تحویل</td></tr><tr><th>ابعاد</th><td>۲۵۰×۶۰×۱۳۰ سانتی‌متر</td></tr><tr><th>حجم بسته‌بندی</th><td>0.36 m3</td></tr><tr><th>رنگ‌بندی</th><td>سفید، سرمه‌ای، نارنجی</td></tr></table>',
    '<p>Polyethylene nursery play equipment with safe and attractive design for children. Made from high-density polyethylene (HDPE) by rotational molding, seamless and one-piece with rounded edges.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Nurseries, playhouses, indoor spaces, and children play areas</td></tr><tr><th>Body Material</th><td>High-density polyethylene (HDPE), durable and hygienic</td></tr><tr><th>Production Method</th><td>Rotational Molding</td></tr><tr><th>Structure</th><td>One-piece, seamless with rounded edges</td></tr><tr><th>Raw Materials</th><td>Premium grade non-toxic polyethylene</td></tr><tr><th>Resistance</th><td>Impact resistant, suitable for continuous children use</td></tr><tr><th>Colors</th><td>Cheerful children colors with stable materials</td></tr><tr><th>Slide</th><td>One-piece polyethylene with smooth and safe surface</td></tr><tr><th>Safety</th><td>No sharp corners or hazardous parts</td></tr><tr><th>Washing</th><td>Washable and moisture resistant</td></tr><tr><th>Age Group</th><td>Usually 2 to 8 years depending on model</td></tr><tr><th>Installation</th><td>Easy installation without heavy construction</td></tr><tr><th>Maintenance</th><td>No periodic painting required</td></tr><tr><th>Quality Control</th><td>Strength, safety, and raw material quality inspection</td></tr><tr><th>Final Approval</th><td>Sample approval by client before delivery</td></tr><tr><th>Dimensions</th><td>250×60×130 cm</td></tr><tr><th>Package Volume</th><td>0.36 m3</td></tr><tr><th>Colors</th><td>White, Navy, Orange</td></tr></table>',
    'جنس|پلی‌اتیلن HDPE|روش تولید|قالب‌گیری دورانی|ابعاد|۲۵۰×۶۰×۱۳۰ سانتی‌متر|حجم بسته‌بندی|0.36 m3|رنگ‌بندی|سفید، سرمه‌ای، نارنجی|رده سنی|۲ تا ۸ سال|ایمنی|بدون گوشه تیز',
    'Material|HDPE Polyethylene|Production|Rotational Molding|Dimensions|250×60×130 cm|Package Volume|0.36 m3|Colors|White, Navy, Orange|Age Group|2-8 years|Safety|No sharp corners',
    'سرسره,تاب,مهدکودک,پلی‌اتیلن,بازی کودک','slide,swing,nursery,polyethylene,kids play','وسایل بازی خانگی','Home Play Equipment','PS5135','',1,
    'سرسره ۲۲۰ خرگوش PS5135 | پروشات','سرسره ۲۲۰ خرگوش پلی‌اتیلنی مدل PS5135',
    'Rabbit 220 Slide PS5135 | Proshut','Rabbit 220 Slide polyethylene model PS5135');

  P('تاب دلفین مدل PS5103','Dolphin Swing Model PS5103',
    'dolphin-swing-ps5103','swing','/images/uploads/1782663223739-725077.webp',
    'تجهیزات بازی مهدکودکی پلی‌اتیلنی، ساخت به روش قالب‌گیری دورانی، ایمن و بهداشتی.',
    'Polyethylene nursery play equipment, rotational molding, safe and hygienic.',
    'تجهیزات بازی مهدکودکی از پلی‌اتیلن فشرده HDPE، یکپارچه و بدون درز، مناسب مهدکودک و فضای سرپوشیده.',
    'Nursery play equipment made from HDPE polyethylene, one-piece and seamless, suitable for nurseries and indoor spaces.',
    '<p>تجهیزات بازی مهدکودکی پلی‌اتیلنی با طراحی ایمن و جذاب برای کودکان. ساخته شده از پلی‌اتیلن فشرده (HDPE) به روش قالب‌گیری دورانی، یکپارچه و بدون درز با لبه‌های گرد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>مناسب مهدکودک، خانه بازی، فضاهای سرپوشیده و بازی کودک</td></tr><tr><th>جنس بدنه</th><td>پلی‌اتیلن فشرده (HDPE) مقاوم و بهداشتی</td></tr><tr><th>روش تولید</th><td>قالب‌گیری دورانی (Rotational Molding)</td></tr><tr><th>ساختار</th><td>یکپارچه، بدون درز و دارای لبه‌های گرد</td></tr><tr><th>مواد اولیه</th><td>پلی‌اتیلن گرید مرغوب و غیرسمی</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر ضربه و استفاده مداوم کودکان</td></tr><tr><th>رنگ‌بندی</th><td>رنگ‌های شاد کودکانه با مواد پایدار</td></tr><tr><th>ایمنی</th><td>فاقد گوشه تیز و قطعات خطرناک</td></tr><tr><th>شستشو</th><td>قابل شستشو و مقاوم در برابر رطوبت</td></tr><tr><th>رده سنی</th><td>معمولاً ۲ تا ۸ سال متناسب با مدل</td></tr><tr><th>نصب</th><td>نصب آسان و بدون عملیات عمرانی سنگین</td></tr><tr><th>نگهداری</th><td>بدون نیاز به رنگ‌آمیزی دوره‌ای</td></tr><tr><th>کنترل کیفیت</th><td>بررسی استحکام، ایمنی و کیفیت مواد اولیه</td></tr><tr><th>تایید نهایی</th><td>تایید نمونه توسط کارفرما قبل از تحویل</td></tr><tr><th>ابعاد</th><td>۸۵×۸۵×۱۲۵ سانتی‌متر</td></tr><tr><th>حجم بسته‌بندی</th><td>0.17 m3</td></tr><tr><th>رنگ‌بندی</th><td>سبزآبی، طوسی / آبی روشن، طوسی</td></tr></table>',
    '<p>Polyethylene nursery play equipment with safe and attractive design for children. Made from high-density polyethylene (HDPE) by rotational molding, seamless and one-piece with rounded edges.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Nurseries, playhouses, indoor spaces, and children play areas</td></tr><tr><th>Body Material</th><td>High-density polyethylene (HDPE), durable and hygienic</td></tr><tr><th>Production Method</th><td>Rotational Molding</td></tr><tr><th>Structure</th><td>One-piece, seamless with rounded edges</td></tr><tr><th>Raw Materials</th><td>Premium grade non-toxic polyethylene</td></tr><tr><th>Resistance</th><td>Impact resistant, suitable for continuous children use</td></tr><tr><th>Colors</th><td>Cheerful children colors with stable materials</td></tr><tr><th>Safety</th><td>No sharp corners or hazardous parts</td></tr><tr><th>Washing</th><td>Washable and moisture resistant</td></tr><tr><th>Age Group</th><td>Usually 2 to 8 years depending on model</td></tr><tr><th>Installation</th><td>Easy installation without heavy construction</td></tr><tr><th>Maintenance</th><td>No periodic painting required</td></tr><tr><th>Quality Control</th><td>Strength, safety, and raw material quality inspection</td></tr><tr><th>Final Approval</th><td>Sample approval by client before delivery</td></tr><tr><th>Dimensions</th><td>85×85×125 cm</td></tr><tr><th>Package Volume</th><td>0.17 m3</td></tr><tr><th>Colors</th><td>Aqua Green, Gray / Light Blue, Gray</td></tr></table>',
    'جنس|پلی‌اتیلن HDPE|روش تولید|قالب‌گیری دورانی|ابعاد|۸۵×۸۵×۱۲۵ سانتی‌متر|حجم بسته‌بندی|0.17 m3|رنگ‌بندی|سبزآبی، طوسی / آبی روشن، طوسی|رده سنی|۲ تا ۸ سال|ایمنی|بدون گوشه تیز',
    'Material|HDPE Polyethylene|Production|Rotational Molding|Dimensions|85×85×125 cm|Package Volume|0.17 m3|Colors|Aqua Green, Gray / Light Blue, Gray|Age Group|2-8 years|Safety|No sharp corners',
    'تاب,مهدکودک,پلی‌اتیلن,بازی کودک','swing,nursery,polyethylene,kids play','وسایل بازی کودکان','Children Play Equipment','PS5103','',1,
    'تاب دلفین PS5103 | پروشات','تاب دلفین پلی‌اتیلنی مدل PS5103',
    'Dolphin Swing PS5103 | Proshut','Dolphin Swing polyethylene model PS5103');

  P('تاب سنجاب مدل PS5109','Squirrel Swing Model PS5109',
    'squirrel-swing-ps5109','swing','/images/uploads/1782661708192-672781.webp',
    'تجهیزات بازی مهدکودکی پلی‌اتیلنی، ساخت به روش قالب‌گیری دورانی، ایمن و بهداشتی.',
    'Polyethylene nursery play equipment, rotational molding, safe and hygienic.',
    'تجهیزات بازی مهدکودکی از پلی‌اتیلن فشرده HDPE، یکپارچه و بدون درز، مناسب مهدکودک و فضای سرپوشیده.',
    'Nursery play equipment made from HDPE polyethylene, one-piece and seamless, suitable for nurseries and indoor spaces.',
    '<p>تجهیزات بازی مهدکودکی پلی‌اتیلنی با طراحی ایمن و جذاب برای کودکان. ساخته شده از پلی‌اتیلن فشرده (HDPE) به روش قالب‌گیری دورانی، یکپارچه و بدون درز با لبه‌های گرد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>مناسب مهدکودک، خانه بازی، فضاهای سرپوشیده و بازی کودک</td></tr><tr><th>جنس بدنه</th><td>پلی‌اتیلن فشرده (HDPE) مقاوم و بهداشتی</td></tr><tr><th>روش تولید</th><td>قالب‌گیری دورانی (Rotational Molding)</td></tr><tr><th>ساختار</th><td>یکپارچه، بدون درز و دارای لبه‌های گرد</td></tr><tr><th>مواد اولیه</th><td>پلی‌اتیلن گرید مرغوب و غیرسمی</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر ضربه و استفاده مداوم کودکان</td></tr><tr><th>رنگ‌بندی</th><td>رنگ‌های شاد کودکانه با مواد پایدار</td></tr><tr><th>ایمنی</th><td>فاقد گوشه تیز و قطعات خطرناک</td></tr><tr><th>شستشو</th><td>قابل شستشو و مقاوم در برابر رطوبت</td></tr><tr><th>رده سنی</th><td>معمولاً ۲ تا ۸ سال متناسب با مدل</td></tr><tr><th>نصب</th><td>نصب آسان و بدون عملیات عمرانی سنگین</td></tr><tr><th>نگهداری</th><td>بدون نیاز به رنگ‌آمیزی دوره‌ای</td></tr><tr><th>کنترل کیفیت</th><td>بررسی استحکام، ایمنی و کیفیت مواد اولیه</td></tr><tr><th>تایید نهایی</th><td>تایید نمونه توسط کارفرما قبل از تحویل</td></tr><tr><th>ابعاد</th><td>۸۰×۸۵×۱۳۰ سانتی‌متر</td></tr><tr><th>حجم بسته‌بندی</th><td>0.2 m3</td></tr><tr><th>رنگ‌بندی</th><td>زرد، طوسی</td></tr></table>',
    '<p>Polyethylene nursery play equipment with safe and attractive design for children. Made from high-density polyethylene (HDPE) by rotational molding, seamless and one-piece with rounded edges.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Nurseries, playhouses, indoor spaces, and children play areas</td></tr><tr><th>Body Material</th><td>High-density polyethylene (HDPE), durable and hygienic</td></tr><tr><th>Production Method</th><td>Rotational Molding</td></tr><tr><th>Structure</th><td>One-piece, seamless with rounded edges</td></tr><tr><th>Raw Materials</th><td>Premium grade non-toxic polyethylene</td></tr><tr><th>Resistance</th><td>Impact resistant, suitable for continuous children use</td></tr><tr><th>Colors</th><td>Cheerful children colors with stable materials</td></tr><tr><th>Safety</th><td>No sharp corners or hazardous parts</td></tr><tr><th>Washing</th><td>Washable and moisture resistant</td></tr><tr><th>Age Group</th><td>Usually 2 to 8 years depending on model</td></tr><tr><th>Installation</th><td>Easy installation without heavy construction</td></tr><tr><th>Maintenance</th><td>No periodic painting required</td></tr><tr><th>Quality Control</th><td>Strength, safety, and raw material quality inspection</td></tr><tr><th>Final Approval</th><td>Sample approval by client before delivery</td></tr><tr><th>Dimensions</th><td>80×85×130 cm</td></tr><tr><th>Package Volume</th><td>0.2 m3</td></tr><tr><th>Colors</th><td>Yellow, Gray</td></tr></table>',
    'جنس|پلی‌اتیلن HDPE|روش تولید|قالب‌گیری دورانی|ابعاد|۸۰×۸۵×۱۳۰ سانتی‌متر|حجم بسته‌بندی|0.2 m3|رنگ‌بندی|زرد، طوسی|رده سنی|۲ تا ۸ سال|ایمنی|بدون گوشه تیز',
    'Material|HDPE Polyethylene|Production|Rotational Molding|Dimensions|80×85×130 cm|Package Volume|0.2 m3|Colors|Yellow, Gray|Age Group|2-8 years|Safety|No sharp corners',
    'تاب,مهدکودک,پلی‌اتیلن,بازی کودک','swing,nursery,polyethylene,kids play','وسایل بازی کودکان','Children Play Equipment','PS5109','',1,
    'تاب سنجاب PS5109 | پروشات','تاب سنجاب پلی‌اتیلنی مدل PS5109',
    'Squirrel Swing PS5109 | Proshut','Squirrel Swing polyethylene model PS5109');

  P('تاب ABCD مدل PS5112','ABCD Swing Model PS5112',
    'abcd-swing-ps5112','swing','/images/uploads/1782660651482-622355.webp',
    'تجهیزات بازی مهدکودکی پلی‌اتیلنی، ساخت به روش قالب‌گیری دورانی، ایمن و بهداشتی.',
    'Polyethylene nursery play equipment, rotational molding, safe and hygienic.',
    'تجهیزات بازی مهدکودکی از پلی‌اتیلن فشرده HDPE، یکپارچه و بدون درز، مناسب مهدکودک و فضای سرپوشیده.',
    'Nursery play equipment made from HDPE polyethylene, one-piece and seamless, suitable for nurseries and indoor spaces.',
    '<p>تجهیزات بازی مهدکودکی پلی‌اتیلنی با طراحی ایمن و جذاب برای کودکان. ساخته شده از پلی‌اتیلن فشرده (HDPE) به روش قالب‌گیری دورانی، یکپارچه و بدون درز با لبه‌های گرد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>مناسب مهدکودک، خانه بازی، فضاهای سرپوشیده و بازی کودک</td></tr><tr><th>جنس بدنه</th><td>پلی‌اتیلن فشرده (HDPE) مقاوم و بهداشتی</td></tr><tr><th>روش تولید</th><td>قالب‌گیری دورانی (Rotational Molding)</td></tr><tr><th>ساختار</th><td>یکپارچه، بدون درز و دارای لبه‌های گرد</td></tr><tr><th>مواد اولیه</th><td>پلی‌اتیلن گرید مرغوب و غیرسمی</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر ضربه و استفاده مداوم کودکان</td></tr><tr><th>رنگ‌بندی</th><td>رنگ‌های شاد کودکانه با مواد پایدار</td></tr><tr><th>ایمنی</th><td>فاقد گوشه تیز و قطعات خطرناک</td></tr><tr><th>شستشو</th><td>قابل شستشو و مقاوم در برابر رطوبت</td></tr><tr><th>رده سنی</th><td>معمولاً ۲ تا ۸ سال متناسب با مدل</td></tr><tr><th>نصب</th><td>نصب آسان و بدون عملیات عمرانی سنگین</td></tr><tr><th>نگهداری</th><td>بدون نیاز به رنگ‌آمیزی دوره‌ای</td></tr><tr><th>کنترل کیفیت</th><td>بررسی استحکام، ایمنی و کیفیت مواد اولیه</td></tr><tr><th>تایید نهایی</th><td>تایید نمونه توسط کارفرما قبل از تحویل</td></tr><tr><th>ابعاد</th><td>۸۰×۸۰×۱۲۵ سانتی‌متر</td></tr><tr><th>حجم بسته‌بندی</th><td>0.19 m3</td></tr><tr><th>رنگ‌بندی</th><td>سبزآبی، طوسی</td></tr></table>',
    '<p>Polyethylene nursery play equipment with safe and attractive design for children. Made from high-density polyethylene (HDPE) by rotational molding, seamless and one-piece with rounded edges.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Nurseries, playhouses, indoor spaces, and children play areas</td></tr><tr><th>Body Material</th><td>High-density polyethylene (HDPE), durable and hygienic</td></tr><tr><th>Production Method</th><td>Rotational Molding</td></tr><tr><th>Structure</th><td>One-piece, seamless with rounded edges</td></tr><tr><th>Raw Materials</th><td>Premium grade non-toxic polyethylene</td></tr><tr><th>Resistance</th><td>Impact resistant, suitable for continuous children use</td></tr><tr><th>Colors</th><td>Cheerful children colors with stable materials</td></tr><tr><th>Safety</th><td>No sharp corners or hazardous parts</td></tr><tr><th>Washing</th><td>Washable and moisture resistant</td></tr><tr><th>Age Group</th><td>Usually 2 to 8 years depending on model</td></tr><tr><th>Installation</th><td>Easy installation without heavy construction</td></tr><tr><th>Maintenance</th><td>No periodic painting required</td></tr><tr><th>Quality Control</th><td>Strength, safety, and raw material quality inspection</td></tr><tr><th>Final Approval</th><td>Sample approval by client before delivery</td></tr><tr><th>Dimensions</th><td>80×80×125 cm</td></tr><tr><th>Package Volume</th><td>0.19 m3</td></tr><tr><th>Colors</th><td>Aqua Green, Gray</td></tr></table>',
    'جنس|پلی‌اتیلن HDPE|روش تولید|قالب‌گیری دورانی|ابعاد|۸۰×۸۰×۱۲۵ سانتی‌متر|حجم بسته‌بندی|0.19 m3|رنگ‌بندی|سبزآبی، طوسی|رده سنی|۲ تا ۸ سال|ایمنی|بدون گوشه تیز',
    'Material|HDPE Polyethylene|Production|Rotational Molding|Dimensions|80×80×125 cm|Package Volume|0.19 m3|Colors|Aqua Green, Gray|Age Group|2-8 years|Safety|No sharp corners',
    'تاب,مهدکودک,پلی‌اتیلن,بازی کودک','swing,nursery,polyethylene,kids play','وسایل بازی کودکان','Children Play Equipment','PS5112','',1,
    'تاب ABCD PS5112 | پروشات','تاب ABCD پلی‌اتیلنی مدل PS5112',
    'ABCD Swing PS5112 | Proshut','ABCD Swing polyethylene model PS5112');

  P('تاب کشتی مدل PS5124','Ship Swing Model PS5124',
    'ship-swing-ps5124','swing','/images/uploads/1782660387301-165062.png',
    'تجهیزات بازی مهدکودکی پلی‌اتیلنی، ساخت به روش قالب‌گیری دورانی، ایمن و بهداشتی.',
    'Polyethylene nursery play equipment, rotational molding, safe and hygienic.',
    'تجهیزات بازی مهدکودکی از پلی‌اتیلن فشرده HDPE، یکپارچه و بدون درز، مناسب مهدکودک و فضای سرپوشیده.',
    'Nursery play equipment made from HDPE polyethylene, one-piece and seamless, suitable for nurseries and indoor spaces.',
    '<p>تجهیزات بازی مهدکودکی پلی‌اتیلنی با طراحی ایمن و جذاب برای کودکان. ساخته شده از پلی‌اتیلن فشرده (HDPE) به روش قالب‌گیری دورانی، یکپارچه و بدون درز با لبه‌های گرد.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>مناسب مهدکودک، خانه بازی، فضاهای سرپوشیده و بازی کودک</td></tr><tr><th>جنس بدنه</th><td>پلی‌اتیلن فشرده (HDPE) مقاوم و بهداشتی</td></tr><tr><th>روش تولید</th><td>قالب‌گیری دورانی (Rotational Molding)</td></tr><tr><th>ساختار</th><td>یکپارچه، بدون درز و دارای لبه‌های گرد</td></tr><tr><th>مواد اولیه</th><td>پلی‌اتیلن گرید مرغوب و غیرسمی</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر ضربه و استفاده مداوم کودکان</td></tr><tr><th>رنگ‌بندی</th><td>رنگ‌های شاد کودکانه با مواد پایدار</td></tr><tr><th>ایمنی</th><td>فاقد گوشه تیز و قطعات خطرناک</td></tr><tr><th>شستشو</th><td>قابل شستشو و مقاوم در برابر رطوبت</td></tr><tr><th>رده سنی</th><td>معمولاً ۲ تا ۸ سال متناسب با مدل</td></tr><tr><th>نصب</th><td>نصب آسان و بدون عملیات عمرانی سنگین</td></tr><tr><th>نگهداری</th><td>بدون نیاز به رنگ‌آمیزی دوره‌ای</td></tr><tr><th>کنترل کیفیت</th><td>بررسی استحکام، ایمنی و کیفیت مواد اولیه</td></tr><tr><th>تایید نهایی</th><td>تایید نمونه توسط کارفرما قبل از تحویل</td></tr><tr><th>ابعاد</th><td>۲۱۵×۱۴۰×۱۹۵ سانتی‌متر</td></tr><tr><th>حجم بسته‌بندی</th><td>0.6 m3</td></tr><tr><th>رنگ‌بندی</th><td>عمده‌فروشی</td></tr></table>',
    '<p>Polyethylene nursery play equipment with safe and attractive design for children. Made from high-density polyethylene (HDPE) by rotational molding, seamless and one-piece with rounded edges.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Nurseries, playhouses, indoor spaces, and children play areas</td></tr><tr><th>Body Material</th><td>High-density polyethylene (HDPE), durable and hygienic</td></tr><tr><th>Production Method</th><td>Rotational Molding</td></tr><tr><th>Structure</th><td>One-piece, seamless with rounded edges</td></tr><tr><th>Raw Materials</th><td>Premium grade non-toxic polyethylene</td></tr><tr><th>Resistance</th><td>Impact resistant, suitable for continuous children use</td></tr><tr><th>Colors</th><td>Cheerful children colors with stable materials</td></tr><tr><th>Safety</th><td>No sharp corners or hazardous parts</td></tr><tr><th>Washing</th><td>Washable and moisture resistant</td></tr><tr><th>Age Group</th><td>Usually 2 to 8 years depending on model</td></tr><tr><th>Installation</th><td>Easy installation without heavy construction</td></tr><tr><th>Maintenance</th><td>No periodic painting required</td></tr><tr><th>Quality Control</th><td>Strength, safety, and raw material quality inspection</td></tr><tr><th>Final Approval</th><td>Sample approval by client before delivery</td></tr><tr><th>Dimensions</th><td>215×140×195 cm</td></tr><tr><th>Package Volume</th><td>0.6 m3</td></tr><tr><th>Colors</th><td>Wholesale</td></tr></table>',
    'جنس|پلی‌اتیلن HDPE|روش تولید|قالب‌گیری دورانی|ابعاد|۲۱۵×۱۴۰×۱۹۵ سانتی‌متر|حجم بسته‌بندی|0.6 m3|رنگ‌بندی|عمده‌فروشی|رده سنی|۲ تا ۸ سال|ایمنی|بدون گوشه تیز',
    'Material|HDPE Polyethylene|Production|Rotational Molding|Dimensions|215×140×195 cm|Package Volume|0.6 m3|Colors|Wholesale|Age Group|2-8 years|Safety|No sharp corners',
    'تاب,مهدکودک,پلی‌اتیلن,بازی کودک','swing,nursery,polyethylene,kids play','وسایل بازی کودکان','Children Play Equipment','PS5124','',1,
    'تاب کشتی PS5124 | پروشات','تاب کشتی پلی‌اتیلنی مدل PS5124',
    'Ship Swing PS5124 | Proshut','Ship Swing polyethylene model PS5124');

  P('مخزن زباله گالوانیزه ۱۱۰۰ لیتری مدل SP-300','1100L Galvanized Waste Bin Model SP-300',
    'galvanized-bin-1100-sp300','bin-galvanized','/images/uploads/1782668285462-380602.webp',
    'مخزن زباله گالوانیزه مکانیزه شهری ۱۱۰۰ لیتری، مناسب جمع‌آوری پسماند شهری، پارک‌ها، معابر و مناطق مسکونی.',
    '1100-liter mechanized galvanized municipal waste bin, suitable for urban waste collection in parks, streets, and residential areas.',
    'مخزن زباله گالوانیزه مکانیزه شهری ۱۱۰۰ لیتری از ورق فولادی گالوانیزه گرم با ضخامت ۱.۵ تا ۲ میلی‌متر، دارای چهار چرخ گردان صنعتی و قابلیت تخلیه مکانیزه.',
    '1100-liter mechanized galvanized municipal waste bin made from hot-dip galvanized steel sheet (1.5-2mm thick), with four industrial swivel casters and mechanized emptying capability.',
    '<p>مخزن زباله گالوانیزه مکانیزه شهری از ورق فولادی گالوانیزه گرم مقاوم در برابر خوردگی ساخته شده است. با ظرفیت ۱۱۰۰ لیتر.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>جمع‌آوری پسماند شهری، پارک‌ها، معابر و مناطق مسکونی</td></tr><tr><th>جنس بدنه</th><td>ورق فولادی گالوانیزه گرم مقاوم در برابر خوردگی</td></tr><tr><th>ضخامت ورق</th><td>حدود ۱.۵ تا ۲ میلی‌متر متناسب با ظرفیت</td></tr><tr><th>پوشش</th><td>گالوانیزه گرم کامل سطوح داخلی و خارجی</td></tr><tr><th>ظرفیت‌های تولید</th><td>۲۴۰، ۶۶۰، ۷۷۰، ۱۰۰۰ و ۱۱۰۰ لیتر</td></tr><tr><th>نوع تخلیه</th><td>مکانیزه توسط خودروهای حمل زباله شهری</td></tr><tr><th>درب مخزن</th><td>تک لنگه یا دو لنگه با لولاهای صنعتی</td></tr><tr><th>چرخ‌ها</th><td>چهار چرخ گردان صنعتی با قابلیت ترمز</td></tr><tr><th>کف مخزن</th><td>تقویت شده جهت تحمل وزن پسماند و شستشو</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر رطوبت، ضربه و شرایط جوی</td></tr><tr><th>شستشو</th><td>قابل شستشو با تجهیزات شستشوی مخازن شهری</td></tr><tr><th>علائم شهری</th><td>امکان درج لوگو و مشخصات شهرداری</td></tr><tr><th>کنترل کیفیت</th><td>بررسی جوش، ابعاد، گالوانیزه و عملکرد قبل از تحویل</td></tr></table>',
    '<p>Mechanized galvanized municipal waste bin made from hot-dip galvanized steel sheet resistant to corrosion. with 1100-liter capacity.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Urban waste collection in parks, streets, and residential areas</td></tr><tr><th>Body Material</th><td>Hot-dip galvanized steel sheet, corrosion resistant</td></tr><tr><th>Sheet Thickness</th><td>Approx. 1.5 to 2 mm depending on capacity</td></tr><tr><th>Coating</th><td>Full hot-dip galvanized on interior and exterior surfaces</td></tr><tr><th>Production Capacities</th><td>240, 660, 770, 1000, and 1100 liters</td></tr><tr><th>Emptying Type</th><td>Mechanized by municipal waste collection vehicles</td></tr><tr><th>Lid</th><td>Single or double-flap with industrial hinges</td></tr><tr><th>Wheels</th><td>Four industrial swivel casters with brake capability</td></tr><tr><th>Floor</th><td>Reinforced to withstand waste weight and washing</td></tr><tr><th>Resistance</th><td>Resistant to moisture, impact, and weather conditions</td></tr><tr><th>Washing</th><td>Washable with municipal bin washing equipment</td></tr><tr><th>Municipal Markings</th><td>Option to print municipality logo and specifications</td></tr><tr><th>Quality Control</th><td>Weld, dimensions, galvanization, and function inspection before delivery</td></tr></table>',
    'ظرفیت|۱۱۰۰ لیتر|جنس بدنه|فولاد گالوانیزه گرم|ضخامت ورق|۱.۵ تا ۲ میلی‌متر|پوشش|گالوانیزه گرم کامل|نوع تخلیه|مکانیزه|درب|تک/دو لنگه صنعتی|چرخ‌ها|۴ چرخ گردان با ترمز|کف|تقویت شده|مقاومت|رطوبت، ضربه، شرایط جوی',
    'Capacity|1100 Liters|Body|Hot-dip Galvanized Steel|Sheet Thickness|1.5-2 mm|Coating|Full Hot-dip Galvanized|Emptying|Mechanized|Lid|Single/Double Industrial|Wheels|4 Swivel with Brake|Floor|Reinforced|Resistance|Moisture, Impact, Weather',
    'مخزن زباله,گالوانیزه,مکانیزه,شهرداری','waste bin,galvanized,mechanized,municipal','مخزن زباله صنعتی','Industrial Waste Bins','SP-300','',1,
    'مخزن زباله گالوانیزه ۱۱۰۰ لیتری SP-300 | پروشات','مخزن زباله گالوانیزه ۱۱۰۰ لیتری مکانیزه شهری مدل SP-300',
    '1100L Galvanized Waste Bin SP-300 | Proshut','1100L Galvanized Waste Bin mechanized municipal model SP-300');

  P('مخزن زباله گالوانیزه ۱۱۰۰ لیتری مدل SP-302','1100L Galvanized Waste Bin Model SP-302',
    'galvanized-bin-1100-sp302','bin-galvanized','/images/uploads/1782668370416-359310.webp',
    'مخزن زباله گالوانیزه مکانیزه شهری ۱۱۰۰ لیتری، مناسب جمع‌آوری پسماند شهری، پارک‌ها، معابر و مناطق مسکونی.',
    '1100-liter mechanized galvanized municipal waste bin, suitable for urban waste collection in parks, streets, and residential areas.',
    'مخزن زباله گالوانیزه مکانیزه شهری ۱۱۰۰ لیتری از ورق فولادی گالوانیزه گرم با ضخامت ۱.۵ تا ۲ میلی‌متر، دارای چهار چرخ گردان صنعتی و قابلیت تخلیه مکانیزه.',
    '1100-liter mechanized galvanized municipal waste bin made from hot-dip galvanized steel sheet (1.5-2mm thick), with four industrial swivel casters and mechanized emptying capability.',
    '<p>مخزن زباله گالوانیزه مکانیزه شهری از ورق فولادی گالوانیزه گرم مقاوم در برابر خوردگی ساخته شده است. با ظرفیت ۱۱۰۰ لیتر.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>جمع‌آوری پسماند شهری، پارک‌ها، معابر و مناطق مسکونی</td></tr><tr><th>جنس بدنه</th><td>ورق فولادی گالوانیزه گرم مقاوم در برابر خوردگی</td></tr><tr><th>ضخامت ورق</th><td>حدود ۱.۵ تا ۲ میلی‌متر متناسب با ظرفیت</td></tr><tr><th>پوشش</th><td>گالوانیزه گرم کامل سطوح داخلی و خارجی</td></tr><tr><th>ظرفیت‌های تولید</th><td>۲۴۰، ۶۶۰، ۷۷۰، ۱۰۰۰ و ۱۱۰۰ لیتر</td></tr><tr><th>نوع تخلیه</th><td>مکانیزه توسط خودروهای حمل زباله شهری</td></tr><tr><th>درب مخزن</th><td>تک لنگه یا دو لنگه با لولاهای صنعتی</td></tr><tr><th>چرخ‌ها</th><td>چهار چرخ گردان صنعتی با قابلیت ترمز</td></tr><tr><th>کف مخزن</th><td>تقویت شده جهت تحمل وزن پسماند و شستشو</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر رطوبت، ضربه و شرایط جوی</td></tr><tr><th>شستشو</th><td>قابل شستشو با تجهیزات شستشوی مخازن شهری</td></tr><tr><th>علائم شهری</th><td>امکان درج لوگو و مشخصات شهرداری</td></tr><tr><th>کنترل کیفیت</th><td>بررسی جوش، ابعاد، گالوانیزه و عملکرد قبل از تحویل</td></tr></table>',
    '<p>Mechanized galvanized municipal waste bin made from hot-dip galvanized steel sheet resistant to corrosion. with 1100-liter capacity.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Urban waste collection in parks, streets, and residential areas</td></tr><tr><th>Body Material</th><td>Hot-dip galvanized steel sheet, corrosion resistant</td></tr><tr><th>Sheet Thickness</th><td>Approx. 1.5 to 2 mm depending on capacity</td></tr><tr><th>Coating</th><td>Full hot-dip galvanized on interior and exterior surfaces</td></tr><tr><th>Production Capacities</th><td>240, 660, 770, 1000, and 1100 liters</td></tr><tr><th>Emptying Type</th><td>Mechanized by municipal waste collection vehicles</td></tr><tr><th>Lid</th><td>Single or double-flap with industrial hinges</td></tr><tr><th>Wheels</th><td>Four industrial swivel casters with brake capability</td></tr><tr><th>Floor</th><td>Reinforced to withstand waste weight and washing</td></tr><tr><th>Resistance</th><td>Resistant to moisture, impact, and weather conditions</td></tr><tr><th>Washing</th><td>Washable with municipal bin washing equipment</td></tr><tr><th>Municipal Markings</th><td>Option to print municipality logo and specifications</td></tr><tr><th>Quality Control</th><td>Weld, dimensions, galvanization, and function inspection before delivery</td></tr></table>',
    'ظرفیت|۱۱۰۰ لیتر|جنس بدنه|فولاد گالوانیزه گرم|ضخامت ورق|۱.۵ تا ۲ میلی‌متر|پوشش|گالوانیزه گرم کامل|نوع تخلیه|مکانیزه|درب|تک/دو لنگه صنعتی|چرخ‌ها|۴ چرخ گردان با ترمز|کف|تقویت شده|مقاومت|رطوبت، ضربه، شرایط جوی',
    'Capacity|1100 Liters|Body|Hot-dip Galvanized Steel|Sheet Thickness|1.5-2 mm|Coating|Full Hot-dip Galvanized|Emptying|Mechanized|Lid|Single/Double Industrial|Wheels|4 Swivel with Brake|Floor|Reinforced|Resistance|Moisture, Impact, Weather',
    'مخزن زباله,گالوانیزه,مکانیزه,شهرداری','waste bin,galvanized,mechanized,municipal','مخزن زباله صنعتی','Industrial Waste Bins','SP-302','',1,
    'مخزن زباله گالوانیزه ۱۱۰۰ لیتری SP-302 | پروشات','مخزن زباله گالوانیزه ۱۱۰۰ لیتری مکانیزه شهری مدل SP-302',
    '1100L Galvanized Waste Bin SP-302 | Proshut','1100L Galvanized Waste Bin mechanized municipal model SP-302');

  P('مخزن زباله گالوانیزه ۷۷۰ لیتری مدل SP-303','770L Galvanized Waste Bin Model SP-303',
    'galvanized-bin-770-sp303','bin-galvanized','/images/uploads/1782668329816-334563.webp',
    'مخزن زباله گالوانیزه مکانیزه شهری ۷۷۰ لیتری، مناسب جمع‌آوری پسماند شهری، پارک‌ها، معابر و مناطق مسکونی.',
    '770-liter mechanized galvanized municipal waste bin, suitable for urban waste collection in parks, streets, and residential areas.',
    'مخزن زباله گالوانیزه مکانیزه شهری ۷۷۰ لیتری از ورق فولادی گالوانیزه گرم با ضخامت ۱.۵ تا ۲ میلی‌متر، دارای چهار چرخ گردان صنعتی و قابلیت تخلیه مکانیزه.',
    '770-liter mechanized galvanized municipal waste bin made from hot-dip galvanized steel sheet (1.5-2mm thick), with four industrial swivel casters and mechanized emptying capability.',
    '<p>مخزن زباله گالوانیزه مکانیزه شهری از ورق فولادی گالوانیزه گرم مقاوم در برابر خوردگی ساخته شده است. با ظرفیت ۷۷۰ لیتر.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>جمع‌آوری پسماند شهری، پارک‌ها، معابر و مناطق مسکونی</td></tr><tr><th>جنس بدنه</th><td>ورق فولادی گالوانیزه گرم مقاوم در برابر خوردگی</td></tr><tr><th>ضخامت ورق</th><td>حدود ۱.۵ تا ۲ میلی‌متر متناسب با ظرفیت</td></tr><tr><th>پوشش</th><td>گالوانیزه گرم کامل سطوح داخلی و خارجی</td></tr><tr><th>ظرفیت‌های تولید</th><td>۲۴۰، ۶۶۰، ۷۷۰، ۱۰۰۰ و ۱۱۰۰ لیتر</td></tr><tr><th>نوع تخلیه</th><td>مکانیزه توسط خودروهای حمل زباله شهری</td></tr><tr><th>درب مخزن</th><td>تک لنگه یا دو لنگه با لولاهای صنعتی</td></tr><tr><th>چرخ‌ها</th><td>چهار چرخ گردان صنعتی با قابلیت ترمز</td></tr><tr><th>کف مخزن</th><td>تقویت شده جهت تحمل وزن پسماند و شستشو</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر رطوبت، ضربه و شرایط جوی</td></tr><tr><th>شستشو</th><td>قابل شستشو با تجهیزات شستشوی مخازن شهری</td></tr><tr><th>علائم شهری</th><td>امکان درج لوگو و مشخصات شهرداری</td></tr><tr><th>کنترل کیفیت</th><td>بررسی جوش، ابعاد، گالوانیزه و عملکرد قبل از تحویل</td></tr></table>',
    '<p>Mechanized galvanized municipal waste bin made from hot-dip galvanized steel sheet resistant to corrosion. with 770-liter capacity.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Urban waste collection in parks, streets, and residential areas</td></tr><tr><th>Body Material</th><td>Hot-dip galvanized steel sheet, corrosion resistant</td></tr><tr><th>Sheet Thickness</th><td>Approx. 1.5 to 2 mm depending on capacity</td></tr><tr><th>Coating</th><td>Full hot-dip galvanized on interior and exterior surfaces</td></tr><tr><th>Production Capacities</th><td>240, 660, 770, 1000, and 1100 liters</td></tr><tr><th>Emptying Type</th><td>Mechanized by municipal waste collection vehicles</td></tr><tr><th>Lid</th><td>Single or double-flap with industrial hinges</td></tr><tr><th>Wheels</th><td>Four industrial swivel casters with brake capability</td></tr><tr><th>Floor</th><td>Reinforced to withstand waste weight and washing</td></tr><tr><th>Resistance</th><td>Resistant to moisture, impact, and weather conditions</td></tr><tr><th>Washing</th><td>Washable with municipal bin washing equipment</td></tr><tr><th>Municipal Markings</th><td>Option to print municipality logo and specifications</td></tr><tr><th>Quality Control</th><td>Weld, dimensions, galvanization, and function inspection before delivery</td></tr></table>',
    'ظرفیت|۷۷۰ لیتر|جنس بدنه|فولاد گالوانیزه گرم|ضخامت ورق|۱.۵ تا ۲ میلی‌متر|پوشش|گالوانیزه گرم کامل|نوع تخلیه|مکانیزه|درب|تک/دو لنگه صنعتی|چرخ‌ها|۴ چرخ گردان با ترمز|کف|تقویت شده|مقاومت|رطوبت، ضربه، شرایط جوی',
    'Capacity|770 Liters|Body|Hot-dip Galvanized Steel|Sheet Thickness|1.5-2 mm|Coating|Full Hot-dip Galvanized|Emptying|Mechanized|Lid|Single/Double Industrial|Wheels|4 Swivel with Brake|Floor|Reinforced|Resistance|Moisture, Impact, Weather',
    'مخزن زباله,گالوانیزه,مکانیزه,شهرداری','waste bin,galvanized,mechanized,municipal','مخزن زباله صنعتی','Industrial Waste Bins','SP-303','',1,
    'مخزن زباله گالوانیزه ۷۷۰ لیتری SP-303 | پروشات','مخزن زباله گالوانیزه ۷۷۰ لیتری مکانیزه شهری مدل SP-303',
    '770L Galvanized Waste Bin SP-303 | Proshut','770L Galvanized Waste Bin mechanized municipal model SP-303');

  P('مخزن زباله گالوانیزه ۷۷۰ لیتری مدل SP-304','770L Galvanized Waste Bin Model SP-304',
    'galvanized-bin-770-sp304','bin-galvanized','/images/uploads/1782668342308-816758.webp',
    'مخزن زباله گالوانیزه مکانیزه شهری ۷۷۰ لیتری، مناسب جمع‌آوری پسماند شهری، پارک‌ها، معابر و مناطق مسکونی.',
    '770-liter mechanized galvanized municipal waste bin, suitable for urban waste collection in parks, streets, and residential areas.',
    'مخزن زباله گالوانیزه مکانیزه شهری ۷۷۰ لیتری از ورق فولادی گالوانیزه گرم با ضخامت ۱.۵ تا ۲ میلی‌متر، دارای چهار چرخ گردان صنعتی و قابلیت تخلیه مکانیزه.',
    '770-liter mechanized galvanized municipal waste bin made from hot-dip galvanized steel sheet (1.5-2mm thick), with four industrial swivel casters and mechanized emptying capability.',
    '<p>مخزن زباله گالوانیزه مکانیزه شهری از ورق فولادی گالوانیزه گرم مقاوم در برابر خوردگی ساخته شده است. با ظرفیت ۷۷۰ لیتر.</p><h5>مشخصات فنی:</h5><table class="table table-bordered"><tr><th>کاربرد</th><td>جمع‌آوری پسماند شهری، پارک‌ها، معابر و مناطق مسکونی</td></tr><tr><th>جنس بدنه</th><td>ورق فولادی گالوانیزه گرم مقاوم در برابر خوردگی</td></tr><tr><th>ضخامت ورق</th><td>حدود ۱.۵ تا ۲ میلی‌متر متناسب با ظرفیت</td></tr><tr><th>پوشش</th><td>گالوانیزه گرم کامل سطوح داخلی و خارجی</td></tr><tr><th>ظرفیت‌های تولید</th><td>۲۴۰، ۶۶۰، ۷۷۰، ۱۰۰۰ و ۱۱۰۰ لیتر</td></tr><tr><th>نوع تخلیه</th><td>مکانیزه توسط خودروهای حمل زباله شهری</td></tr><tr><th>درب مخزن</th><td>تک لنگه یا دو لنگه با لولاهای صنعتی</td></tr><tr><th>چرخ‌ها</th><td>چهار چرخ گردان صنعتی با قابلیت ترمز</td></tr><tr><th>کف مخزن</th><td>تقویت شده جهت تحمل وزن پسماند و شستشو</td></tr><tr><th>مقاومت</th><td>مقاوم در برابر رطوبت، ضربه و شرایط جوی</td></tr><tr><th>شستشو</th><td>قابل شستشو با تجهیزات شستشوی مخازن شهری</td></tr><tr><th>علائم شهری</th><td>امکان درج لوگو و مشخصات شهرداری</td></tr><tr><th>کنترل کیفیت</th><td>بررسی جوش، ابعاد، گالوانیزه و عملکرد قبل از تحویل</td></tr></table>',
    '<p>Mechanized galvanized municipal waste bin made from hot-dip galvanized steel sheet resistant to corrosion. with 770-liter capacity.</p><h5>Technical Specifications:</h5><table class="table table-bordered"><tr><th>Application</th><td>Urban waste collection in parks, streets, and residential areas</td></tr><tr><th>Body Material</th><td>Hot-dip galvanized steel sheet, corrosion resistant</td></tr><tr><th>Sheet Thickness</th><td>Approx. 1.5 to 2 mm depending on capacity</td></tr><tr><th>Coating</th><td>Full hot-dip galvanized on interior and exterior surfaces</td></tr><tr><th>Production Capacities</th><td>240, 660, 770, 1000, and 1100 liters</td></tr><tr><th>Emptying Type</th><td>Mechanized by municipal waste collection vehicles</td></tr><tr><th>Lid</th><td>Single or double-flap with industrial hinges</td></tr><tr><th>Wheels</th><td>Four industrial swivel casters with brake capability</td></tr><tr><th>Floor</th><td>Reinforced to withstand waste weight and washing</td></tr><tr><th>Resistance</th><td>Resistant to moisture, impact, and weather conditions</td></tr><tr><th>Washing</th><td>Washable with municipal bin washing equipment</td></tr><tr><th>Municipal Markings</th><td>Option to print municipality logo and specifications</td></tr><tr><th>Quality Control</th><td>Weld, dimensions, galvanization, and function inspection before delivery</td></tr></table>',
    'ظرفیت|۷۷۰ لیتر|جنس بدنه|فولاد گالوانیزه گرم|ضخامت ورق|۱.۵ تا ۲ میلی‌متر|پوشش|گالوانیزه گرم کامل|نوع تخلیه|مکانیزه|درب|تک/دو لنگه صنعتی|چرخ‌ها|۴ چرخ گردان با ترمز|کف|تقویت شده|مقاومت|رطوبت، ضربه، شرایط جوی',
    'Capacity|770 Liters|Body|Hot-dip Galvanized Steel|Sheet Thickness|1.5-2 mm|Coating|Full Hot-dip Galvanized|Emptying|Mechanized|Lid|Single/Double Industrial|Wheels|4 Swivel with Brake|Floor|Reinforced|Resistance|Moisture, Impact, Weather',
    'مخزن زباله,گالوانیزه,مکانیزه,شهرداری','waste bin,galvanized,mechanized,municipal','مخزن زباله صنعتی','Industrial Waste Bins','SP-304','',1,
    'مخزن زباله گالوانیزه ۷۷۰ لیتری SP-304 | پروشات','مخزن زباله گالوانیزه ۷۷۰ لیتری مکانیزه شهری مدل SP-304',
    '770L Galvanized Waste Bin SP-304 | Proshut','770L Galvanized Waste Bin mechanized municipal model SP-304');

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
  const s = db.prepare('INSERT INTO services (title, title_en, description, description_en, long_description, long_description_en, icon, image, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  s.run('طراحی و مشاوره','Design & Consulting','مشاوره تخصصی در طراحی و چیدمان مبلمان شهری و زمین‌های بازی کودکان','Expert consulting in design and layout of urban furniture and playgrounds','تیم طراحی ما با بررسی فضای پارک یا محیط شهری شما، بهترین چیدمان و محصولات را پیشنهاد می‌دهد. ارائه نقشه سه‌بعدی و طرح اولیه رایگان.','Our design team evaluates your park or urban space and recommends the best layout and products. Free 3D rendering and initial design provided.','fas fa-pencil-ruler','/images/services/s1.jpg',1);
  s.run('تولید سفارشی','Custom Manufacturing','تولید محصولات سفارشی مطابق نیاز و سلیقه مشتری','Custom product manufacturing to meet client needs and preferences','امکان تولید نیمکت، سطل زباله و زمین‌های بازی کودکان با ابعاد، رنگ و طرح دلخواه شما. از طراحی تا تولید نهایی.','We can manufacture benches, waste bins, and playground equipment with custom dimensions, colors, and designs. From design to final production.','fas fa-hammer','/images/services/s2.jpg',2);
  s.run('نصب و اجرا','Installation & Execution','نصب حرفه‌ای زمین‌های بازی کودکان و مبلمان شهری در محل','Professional on-site installation of playgrounds and urban furniture','تیم نصب مجرب ما با تجهیزات کامل، نصب ایمن و استاندارد محصولات را در کوتاه‌ترین زمان انجام می‌دهد.','Our experienced installation team with full equipment performs safe and standard product installation in the shortest time.','fas fa-tools','/images/services/s3.jpg',3);
  s.run('تعمیر و نگهداری','Repair & Maintenance','خدمات تعمیر و نگهداری دوره‌ای زمین‌های بازی کودکان','Periodic repair and maintenance services for playground equipment','با سرویس‌های نگهداری دوره‌ای، عمر مفید زمین‌های بازی کودکان خود را افزایش دهید. شامل رنگ‌آمیزی مجدد، تعویض قطعات و بازسازی.','Extend the service life of your playground equipment with periodic maintenance. Includes repainting, parts replacement, and refurbishment.','fas fa-wrench','/images/services/s4.jpg',4);
  s.run('ایمنی و استاندارد','Safety & Standards','بازرسی و ارزیابی ایمنی تجهیزات بازی کودکان','Safety inspection and assessment of playground equipment','بازرسی تجهیزات بازی مطابق استانداردهای EN 1176 و ارائه گزارش ایمنی و پیشنهادات بهبود.','Equipment inspection according to EN 1176 standards with safety reports and improvement recommendations.','fas fa-shield-alt','/images/services/s5.jpg',5);
  s.run('پشتیبانی و گارانتی','Support & Warranty','گارانتی محصولات و پشتیبانی پس از فروش','Product warranty and after-sales support','تمامی محصولات دارای گارانتی معتبر هستند. تیم پشتیبانی ما آماده پاسخگویی به سوالات شماست.','All products come with a valid warranty. Our support team is ready to answer your questions.','fas fa-headset','/images/services/s6.jpg',6);
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
  const s = db.prepare(`INSERT INTO blog_posts
    (title, title_en, slug, excerpt, excerpt_en, content, content_en,
     image, category, category_en, meta_title, meta_description, meta_title_en, meta_description_en)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  s.run(
    'راهنمای جامع انتخاب وسایل بازی پارکی ایمن برای کودکان',
    'Complete Guide to Choosing Safe Playground Equipment for Children',
    'guide-safe-playground-equipment',
    'انتخاب وسایل بازی مناسب و ایمن برای پارک‌ها و زمین‌های بازی کودکان نیازمند توجه به استانداردها، جنس مواد و رده سنی است. در این مقاله به بررسی کامل نکات مهم می‌پردازیم.',
    'Learn about safety standards and design principles for children playgrounds in parks and public spaces.',
    '<h3>چرا انتخاب وسایل بازی ایمن اهمیت دارد؟</h3><p>هر ساله هزاران کودک در اثر استفاده از وسایل بازی غیراستاندارد دچار آسیب می‌شوند. انتخاب تجهیزات بازی مطابق با استانداردهای بین‌المللی مانند <strong>EN 1176</strong> و <strong>EN 1177</strong> نقش حیاتی در ایمنی کودکان دارد.</p><h3>استانداردهای ایمنی وسایل بازی</h3><p>استاندارد <strong>EN 1176</strong> مربوط به طراحی و ساخت تجهیزات بازی و استاندارد <strong>EN 1177</strong> مربوط به کفپوش‌های ضربه‌گیر زمین بازی است.</p><h3>انتخاب بر اساس رده سنی</h3><ul><li><strong>۱ تا ۳ سال:</strong> سرسره‌های کوتاه، تاب با صندلی محافظ</li><li><strong>۳ تا ۶ سال:</strong> مجموعه‌های بازی ترکیبی کوچک، الاکلنگ</li><li><strong>۶ تا ۱۲ سال:</strong> برج‌های صعود، تور و طناب، دیوار صخره‌نوردی</li></ul>',
    'EN 1176 and EN 1177 are the most important international standards for children playground equipment safety. This comprehensive guide covers everything you need to know about selecting safe, durable, and engaging playground equipment for parks, schools, and residential complexes. Key factors include age-appropriate design, fall height zones, impact-absorbing surfaces, material durability, and regular maintenance schedules.',
    '/images/uploads/1781664931979-90645.jpg',
    'آموزشی','Educational',
    'راهنمای انتخاب وسایل بازی ایمن | پروشات','راهنمای جامع انتخاب وسایل بازی پارکی ایمن برای کودکان',
    'Guide to Safe Playground Equipment | Proshut','Complete guide to choosing safe playground equipment for children'
  );

  s.run(
    'مبلمان شهری چیست؟ انواع، کاربردها و نکات انتخاب',
    'What is Urban Furniture? Types, Applications & Selection Tips',
    'urban-furniture-guide',
    'مبلمان شهری شامل نیمکت، سطل زباله، آبخوری، ایستگاه اتوبوس و سایر تجهیزاتی است که در فضاهای عمومی شهرها نصب می‌شوند. در این مقاله با انواع و نکات انتخاب آشنا شوید.',
    'A guide to selecting the right park bench based on material, design, and intended use of the space.',
    '<h3>تعریف مبلمان شهری</h3><p>مبلمان شهری به مجموعه تجهیزات و المان‌هایی گفته می‌شود که در فضاهای عمومی شهرها برای رفاه، زیبایی و کارایی نصب می‌شوند.</p><h3>انواع مبلمان شهری</h3><h4>۱. نیمکت پارکی و شهری</h4><ul><li><strong>نیمکت چوب و فلز:</strong> ترکیب زیبایی چوب ترموود با استحکام فولاد گالوانیزه</li><li><strong>نیمکت چدنی:</strong> طرح‌های کلاسیک و ماندگار</li></ul><h4>۲. سطل زباله شهری</h4><ul><li><strong>مخازن مکانیزه گالوانیزه:</strong> ظرفیت ۷۷۰ تا ۱۱۰۰ لیتر</li><li><strong>مخازن زیرزمینی:</strong> مدرن و بدون آلودگی بصری</li></ul>',
    'Urban furniture refers to the functional and aesthetic elements installed in public spaces to enhance comfort and visual appeal. This includes park benches, waste bins, light poles, bollards, planters, and shelters. When selecting urban furniture, consider material durability, weather resistance, ergonomic design, vandal resistance, and aesthetic harmony with the surrounding environment.',
    '/images/uploads/1781664954988-646957.jpg',
    'آموزشی','Educational',
    'مبلمان شهری چیست؟ | پروشات','راهنمای انواع مبلمان شهری و نکات انتخاب',
    'What is Urban Furniture? | Proshut','Guide to urban furniture types and selection'
  );

  s.run(
    'کفپوش ایمنی زمین بازی: انواع، مزایا و راهنمای نصب',
    'Playground Safety Flooring: Types, Benefits & Installation Guide',
    'safety-flooring-guide',
    'کفپوش ایمنی یکی از مهم‌ترین اجزای زمین بازی کودکان است که از آسیب‌های ناشی از سقوط جلوگیری می‌کند. در این مقاله انواع کفپوش و نحوه انتخاب صحیح را بررسی می‌کنیم.',
    'The role of safety flooring in playground injury prevention and how to choose the right type.',
    '<h3>اهمیت کفپوش ایمنی در زمین بازی</h3><p>طبق آمار، بیش از <strong>۷۰ درصد</strong> آسیب‌های زمین بازی ناشی از سقوط کودکان روی سطوح سخت است.</p><h3>انواع کفپوش ایمنی</h3><h4>۱. کفپوش گرانولی EPDM</h4><ul><li>قابلیت اجرا در رنگ‌ها و طرح‌های مختلف</li><li>مقاوم در برابر اشعه UV</li><li>ضربه‌گیری عالی</li><li>عمر مفید ۱۰ تا ۱۵ سال</li></ul><h4>۲. کفپوش تاتامی EVA</h4><ul><li>سیستم اتصال پازلی</li><li>مناسب فضاهای سرپوشیده</li></ul><h3>استاندارد EN 1177</h3><p>ضخامت کفپوش باید متناسب با ارتفاع سقوط آزاد بحرانی تجهیزات باشد.</p>',
    'Safety flooring is essential for any playground to minimize injury from falls. The main types include EPDM granular rubber (seamless, customizable colors), interlocking rubber tiles, tatami EVA foam (budget-friendly for indoor use), and PVC sports flooring for multi-purpose halls. Key selection criteria include critical fall height rating (EN 1177), drainage capability, UV resistance, and maintenance requirements.',
    '/images/uploads/1781664982688-210391.jpg',
    'آموزشی','Educational',
    'کفپوش ایمنی زمین بازی | پروشات','انواع و مزایای کفپوش ایمنی زمین بازی',
    'Playground Safety Flooring Guide | Proshut','Types and benefits of playground safety flooring'
  );
});

// Projects
seedIfEmpty('projects', () => {
  const s = db.prepare(`INSERT INTO projects
    (title, title_en, slug, client, client_en, description, description_en, image, year, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  s.run(
    'تجهیز پارک بزرگ ملت','Mellat Grand Park Equipment',
    'mellat-park-project',
    'شهرداری منطقه ۳ تهران','Tehran Municipality District 3',
    'طراحی و نصب مجموعه کامل مبلمان شهری شامل نیمکت، سطل زباله، آبخوری و مجموعه بازی کودکان',
    'Design and installation of complete urban furniture set including benches, waste bins, drinking fountains, and children playground equipment',
    '/images/uploads/1781656471697-708276.png','۱۴۰۲',1);
  s.run(
    'زمین بازی مجتمع مسکونی آسمان','Asman Residential Complex Playground',
    'asman-playground',
    'مجتمع مسکونی آسمان','Asman Residential Complex',
    'طراحی و اجرای زمین بازی ایمن با کفپوش EPDM و مجموعه بازی ترکیبی برای سنین مختلف',
    'Design and execution of a safe playground with EPDM flooring and combined play sets for various age groups',
    '/images/uploads/1781656506436-689429.jpeg','۱۴۰۳',2);
  s.run(
    'نصب مبلمان شهری بلوار اصلی','Main Boulevard Urban Furniture Installation',
    'boulevard-furniture',
    'شهرداری اصفهان','Isfahan Municipality',
    'تأمین و نصب ۲۰۰ عدد نیمکت و ۱۵۰ سطل زباله تفکیکی در بلوار اصلی شهر',
    'Supply and installation of 200 benches and 150 segregated waste bins along the main city boulevard',
    '/images/uploads/1781655686828-645004.jpeg','۱۴۰۳',3);
  s.run(
    'تجهیز پارک ساحلی بندرعباس','Bandar Abbas Coastal Park Equipment',
    'bandarabbas-park',
    'شهرداری بندرعباس','Bandar Abbas Municipality',
    'طراحی و نصب تجهیزات بازی کودکان و کفپوش ایمنی EPDM در پارک ساحلی',
    'Design and installation of children playground equipment and EPDM safety flooring at the coastal park',
    '/images/uploads/1781657416091-940441.jpg','۱۴۰۴',4);
});

module.exports = db;
