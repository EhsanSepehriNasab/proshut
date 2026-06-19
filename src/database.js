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

  // ── مخزن زباله گالوانیزه ──
  P('مخزن زباله فلزی مکعب ۱۱۰۰ لیتر','1100L Cubic Metal Waste Bin',
    'metal-bin-1100','bin-galvanized','/images/uploads/1781467194547-262094.jpg',
    'مخزن زباله فلزی ۱۱۰۰ لیتری گالوانیزه، مناسب شهرداری‌ها و کارخانجات.',
    '1100-liter galvanized metal waste bin, suitable for municipalities and factories.',
    'مخزن زباله فلزی مکعب ۱۱۰۰ لیتری از ورق ۲ میلیمتر گالوانیزه.',
    '1100-liter cubic metal waste bin made from 2mm hot-rolled galvanized sheet.',
    '<p>مخزن زباله فلزی مکعب از ورق ۲ میلیمتر گالوانیزه گرم نورد شده.</p><h5>مزایا:</h5><ul><li>شاسی پروفیل در بالا و پایین</li><li>ضربه‌گیر مقاوم</li><li>گوشواره‌های جوش‌شده</li></ul>',
    '<p>Cubic metal waste bin made from 2mm hot-rolled galvanized sheet.</p><h5>Advantages:</h5><ul><li>Profile chassis on top and bottom</li><li>Heavy-duty bumper</li><li>Welded brackets</li></ul>',
    'ظرفیت|1100 لیتر|ضخامت ورق|2 میلیمتر|چرخ|4 عدد (2 قفل‌دار)|وزن|95 کیلوگرم|جنس|گالوانیزه',
    'Capacity|1100 Liters|Sheet Thickness|2 mm|Wheels|4 pcs (2 lockable)|Weight|95 kg|Material|Galvanized Steel',
    'مخزن زباله,گالوانیزه,شهرداری,مخزن فلزی','waste bin,galvanized,municipal,metal bin','مخزن زباله صنعتی','Industrial Waste Bins','TB-G-1100','',1,
    'مخزن زباله فلزی ۱۱۰۰ لیتر | پروشات','مخزن زباله فلزی گالوانیزه ۱۱۰۰ لیتر',
    '1100L Metal Waste Bin | Proshut','1100L Galvanized Metal Waste Bin');

  // ── مخزن زباله پلی اتیلن ──
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

  // ── مخزن زیر مخزنی ──
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

  // ── چرخ مخزن ──
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

  // ── نیمکت فلزی ──
  P('نیمکت پارکی چوب و فلز مدل رویال','Royal Wood & Metal Park Bench',
    'park-bench-royal','bench-metal','/images/uploads/1781466137142-914035.png',
    'نیمکت پارکی با بدنه فلزی گالوانیزه و نشیمن چوب ترمو.',
    'Park bench with galvanized metal body and thermowood seat.',
    'نیمکت رویال با طراحی ارگونومیک، مقاوم در برابر شرایط آب و هوایی.',
    'Royal bench with ergonomic design, weather-resistant.',
    '<p>ترکیب فولاد گالوانیزه و چوب ترموود. مقاوم در برابر خوردگی و زنگ‌زدگی.</p>',
    '<p>Combination of galvanized steel and thermowood. Resistant to corrosion and rust.</p>',
    'بدنه|فولاد گالوانیزه|نشیمن|چوب ترموود|ابعاد|180x60x80 cm|وزن|45 kg|ظرفیت|3 نفر',
    'Body|Galvanized Steel|Seat|Thermowood|Dimensions|180x60x80 cm|Weight|45 kg|Capacity|3 Persons',
    'نیمکت,پارکی,چوب و فلز,مبلمان شهری','bench,park,wood and metal,urban furniture','مبلمان شهری','Urban Furniture','PB-M-ROYAL','',1,
    'نیمکت پارکی رویال | پروشات','نیمکت پارکی چوب و فلز رویال',
    'Royal Park Bench | Proshut','Wood and metal park bench Royal model');

  // ── نیمکت چدنی ──
  P('نیمکت چدنی کلاسیک مدل ویکتوریا','Victoria Classic Cast Iron Bench',
    'bench-victoria','bench-cast-iron','/images/uploads/1781466420953-36498.png',
    'نیمکت چدنی با طرح کلاسیک ویکتوریایی و نشیمن چوبی.',
    'Cast iron bench with classic Victorian design and wooden seat.',
    'نیمکت چدنی با پایه‌های طرح‌دار و نشیمن چوب روسی.',
    'Cast iron bench with patterned legs and Russian wood seat.',
    '<p>پایه‌های چدنی با طرح کلاسیک ویکتوریایی. نشیمن از چوب روسی آغشته به روغن.</p>',
    '<p>Cast iron legs with classic Victorian pattern. Seat made from Russian wood treated with oil.</p>',
    'پایه|چدن|نشیمن|چوب روسی|ابعاد|160x55x75 cm|وزن|60 kg',
    'Legs|Cast Iron|Seat|Russian Wood|Dimensions|160x55x75 cm|Weight|60 kg',
    'نیمکت چدنی,کلاسیک,ویکتوریا','cast iron bench,classic,victoria','مبلمان شهری','Urban Furniture','PB-CI-VIC','',1,
    'نیمکت چدنی ویکتوریا | پروشات','نیمکت چدنی کلاسیک ویکتوریا',
    'Victoria Cast Iron Bench | Proshut','Classic Victorian cast iron bench');

  // ── مجموعه بازی ترکیبی ──
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

  // ── تاب ──
  P('تاب دو نفره فلزی','Double Metal Swing',
    'double-swing-metal','swing','/images/uploads/1781463081316-699403.png',
    'تاب دو نفره با سازه فلزی مستحکم و صندلی ایمنی‌دار.',
    'Double swing with sturdy metal structure and safety seats.',
    'تاب دو نفره فلزی با صندلی EVA ضدضربه.',
    'Double metal swing with anti-shock EVA seats.',
    '<p>سازه لوله فولادی ضخیم با صندلی EVA ضدضربه. مناسب پارک‌ها و مهدکودک‌ها.</p>',
    '<p>Thick steel tube structure with anti-shock EVA seats. Suitable for parks and nurseries.</p>',
    'ظرفیت|2 نفر|سازه|لوله فولادی 3mm|ارتفاع|2.5 متر|صندلی|EVA ضد ضربه',
    'Capacity|2 Persons|Structure|3mm Steel Tube|Height|2.5 m|Seat|Anti-shock EVA',
    'تاب,فلزی,پارکی,دو نفره','swing,metal,park,double','وسایل بازی کودکان','Children Play Equipment','SW-DBL-001','',1,
    'تاب دو نفره فلزی | پروشات','تاب دو نفره فلزی پارکی',
    'Double Metal Swing | Proshut','Double metal park swing');

  // ── الاکلنگ ──
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

  // ── بازی تور و طناب ──
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

  // ── مهد کودکی و خانگی ──
  P('سرسره خانگی کودک مدل خرسی','Bear Design Home Slide for Kids',
    'home-slide-bear','nursery-home','/images/uploads/1781464549020-167369.png',
    'سرسره پلاستیکی خانگی با طرح خرس، مناسب فضای داخلی.',
    'Plastic home slide with bear design, suitable for indoor use.',
    'سرسره کوچک پلی‌اتیلنی برای استفاده در منزل و مهدکودک.',
    'Small polyethylene slide for home and nursery use.',
    '<p>جنس پلی‌اتیلن بدون BPA. قابل جمع‌شدن و حمل آسان.</p>',
    '<p>BPA-free polyethylene material. Foldable and easy to carry.</p>',
    'رده سنی|1 تا 5 سال|ارتفاع|80 cm|جنس|پلی‌اتیلن بدون BPA|وزن|8 kg',
    'Age Group|1 to 5 years|Height|80 cm|Material|BPA-free Polyethylene|Weight|8 kg',
    'سرسره خانگی,مهدکودک,کودک','home slide,nursery,kids','وسایل بازی خانگی','Home Play Equipment','NH-SLD-BEAR','',1,
    'سرسره خانگی کودک | پروشات','سرسره پلاستیکی خانگی کودک',
    'Bear Home Slide for Kids | Proshut','Plastic home slide for children');

  // ── صخره‌نوردی ──
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

  // ── کفپوش گرانولی ──
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

  // ── کفپوش تاتامی ──
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

  // ── کفپوش ورزشی ──
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

  // ── چمن مصنوعی فوتبالی ──
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

  // ── چمن مصنوعی تزیینی ──
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
