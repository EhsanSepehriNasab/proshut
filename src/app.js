const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const compression = require('compression');
const db = require('./database');
const frontRoutes = require('./routes/front');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(compression());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '7d' }));

app.use(session({
  secret: 'proshut-aria-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// ── Global locals ──
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const s = {};
  rows.forEach(r => s[r.key] = r.value);
  return s;
}

// ── Translations ──
const translations = {
  fa: {
    home: 'صفحه اصلی', products: 'محصولات', services: 'خدمات', academy: 'آکادمی',
    projects: 'پروژه‌ها', about: 'درباره ما', contact: 'تماس', search_placeholder: 'جستجو در محصولات و خدمات...',
    all_products: 'همه محصولات', featured: 'ویژه', view_details: 'مشاهده جزئیات',
    newsletter_title: 'عضویت در خبرنامه', newsletter_desc: 'از آخرین اخبار و محصولات مطلع شوید',
    newsletter_placeholder: 'ایمیل خود را وارد کنید...', newsletter_btn: 'عضویت',
    quick_access: 'دسترسی سریع', our_services: 'خدمات ما', contact_info: 'اطلاعات تماس',
    consulting: 'مشاوره فنی', installation: 'نصب و راه‌اندازی', maintenance: 'تعمیر و نگهداری',
    support: 'پشتیبانی فنی', rights_reserved: 'تمامی حقوق محفوظ است.',
    designed_with: 'طراحی و توسعه با', categories_title: 'دسته‌بندی محصولات',
    our_specialties: 'حوزه‌های تخصصی ما', about_us: 'درباره ما',
    premium_materials: 'تولید با مواد مرغوب', safety_standards: 'رعایت استانداردهای ایمنی',
    custom_design: 'طراحی سفارشی', warranty_support: 'گارانتی و پشتیبانی',
    read_more: 'بیشتر بخوانید', view_all_products: 'مشاهده همه محصولات',
    years_exp: 'سال تجربه', successful_projects: 'پروژه موفق', happy_clients: 'مشتری راضی',
    our_projects: 'نمونه کارها', successful_projects_title: 'پروژه‌های موفق ما',
    projects_desc: 'شرکت پروشات آریا با افتخار پروژه‌های متعددی را در سراسر کشور اجرا کرده است. از تجهیز پارک‌های شهری و نصب مبلمان شهری گرفته تا طراحی و اجرای زمین‌های بازی ایمن برای کودکان، هر پروژه با دقت و کیفیت بالا انجام شده است.',
    view_all_projects: 'مشاهده همه پروژه‌ها', office_address: 'آدرس دفتر',
    phone_number: 'شماره تماس', working_hours: 'ساعت کاری', email: 'ایمیل',
    send_message: 'ارسال پیام در واتساپ', need_consulting: 'نیاز به مشاوره دارید؟',
    experts_ready: 'کارشناسان ما آماده راهنمایی شما در انتخاب بهترین محصول هستند',
    product_count: 'محصول', no_products: 'محصولی یافت نشد', no_products_desc: 'در حال حاضر محصولی در این دسته‌بندی موجود نیست.',
    share: 'اشتراک‌گذاری', zoom: 'بزرگ‌نمایی', all: 'همه', categories: 'دسته‌بندی‌ها',
    code: 'کد', scroll_right: 'اسکرول به راست', scroll_left: 'اسکرول به چپ',
    our_services_title: 'خدمات تخصصی', more_details: 'جزئیات بیشتر', services_page_desc: 'ما با بهره‌گیری از تجربه و دانش فنی، طیف گسترده‌ای از خدمات صنعتی را به مشتریان خود ارائه می‌دهیم.',
    why_us: 'چرا ما؟', service_advantages: 'مزایای خدمات ما',
    guaranteed_quality: 'کیفیت تضمین شده', guaranteed_quality_desc: 'تمامی خدمات ما با بالاترین استانداردهای کیفی ارائه می‌شود و دارای گارانتی معتبر هستند.',
    expert_team: 'تیم متخصص', expert_team_desc: 'کارشناسان و مهندسان مجرب ما با تجربه‌ای بالا آماده خدمت‌رسانی هستند.',
    support_24: 'پشتیبانی ۲۴ ساعته', support_24_desc: 'تیم پشتیبانی ما به صورت شبانه‌روزی آماده پاسخگویی و رفع مشکلات شماست.',
    fair_price: 'قیمت منصفانه', fair_price_desc: 'خدمات با کیفیت عالی و قیمت‌های رقابتی ارائه می‌شود.',
    need_consulting_cta: 'نیاز به مشاوره دارید؟', consulting_cta_desc: 'همین حالا با کارشناسان ما تماس بگیرید و از مشاوره رایگان بهره‌مند شوید',
    contact_us: 'تماس با ما',
    articles: 'مقالات و مطالب آموزشی', articles_desc: 'جدیدترین مقالات آموزشی و تخصصی را مطالعه کنید.',
    no_articles: 'هنوز مطلبی منتشر نشده است', no_articles_desc: 'به زودی مقالات آموزشی و تخصصی منتشر خواهد شد.',
    read_article: 'ادامه مطلب', related_posts: 'مطالب مرتبط', categories_widget: 'دسته‌بندی‌ها',
    have_question: 'سوالی دارید؟', experts_answering: 'کارشناسان ما آماده پاسخگویی هستند',
    executed_projects: 'پروژه‌های اجرا شده', projects_page_desc: 'مجموعه‌ای از پروژه‌های موفق ما در زمینه مبلمان شهری و زمین‌های بازی کودکان',
    have_project: 'پروژه‌ای در ذهن دارید؟', consult_experts: 'با کارشناسان ما مشورت کنید تا بهترین راهکار را پیشنهاد دهیم.',
    our_values: 'ارزش‌های ما', mission_vision: 'مأموریت، چشم‌انداز و ارزش‌ها',
    our_mission: 'مأموریت ما', mission_desc: 'ارائه محصولات و خدمات با کیفیت بین‌المللی و قیمت مناسب، همراه با مشاوره تخصصی و پشتیبانی مستمر.',
    our_vision: 'چشم‌انداز ما', our_values_title: 'ارزش‌های ما',
    values_desc: 'صداقت، کیفیت، نوآوری و مشتری‌مداری ستون‌های اصلی فعالیت ما هستند.',
    history: 'تاریخچه', growth_path: 'مسیر رشد ما', notable_projects: 'پروژه‌های شاخص',
    ready_to_cooperate: 'آماده همکاری هستیم', contact_for_more: 'برای مشاوره و اطلاعات بیشتر با ما تماس بگیرید',
    manufacturer_tag: 'تولیدکننده مبلمان شهری و زمین‌های بازی',
    follow_social: 'ما را در شبکه‌های اجتماعی دنبال کنید',
    map_location: 'موقعیت ما روی نقشه',
    product_code: 'کد', specs: 'مشخصات فنی', description: 'توضیحات',
    page_not_found: 'صفحه یافت نشد',
    urban_waste_bins: 'مخازن زباله گالوانیزه مکانیزه شهری',
    urban_waste_desc: 'تولید و عرضه انواع سطل زباله شهری با کیفیت بالا و مطابق با استانداردهای زیست‌محیطی',
    kids_play: 'تجهیزات بازی ایمن برای کودکان',
    kids_play_desc: 'طراحی و تولید مجموعه‌های بازی، تاب، سرسره و الاکلنگ مطابق استاندارد ها',
    urban_furniture: 'مبلمان و صندلی‌های شهری',
    urban_furniture_desc: 'طراحی و تولید انواع مبلمان فضای باز، نیمکت و صندلی‌های شهری با متریال مقاوم و ماندگار',
    view_products: 'مشاهده محصولات',
    proshut_products: 'محصولات پروشات آریا',
    direct_call: 'تماس مستقیم',
  },
  en: {
    home: 'Home', products: 'Products', services: 'Services', academy: 'Academy',
    projects: 'Projects', about: 'About Us', contact: 'Contact', search_placeholder: 'Search products and services...',
    all_products: 'All Products', featured: 'Featured', view_details: 'View Details',
    newsletter_title: 'Subscribe to Newsletter', newsletter_desc: 'Stay updated with our latest news and products',
    newsletter_placeholder: 'Enter your email...', newsletter_btn: 'Subscribe',
    quick_access: 'Quick Access', our_services: 'Our Services', contact_info: 'Contact Info',
    consulting: 'Technical Consulting', installation: 'Installation', maintenance: 'Maintenance',
    support: 'Technical Support', rights_reserved: 'All rights reserved.',
    designed_with: 'Designed and developed with', categories_title: 'Product Categories',
    our_specialties: 'Our Specialties', about_us: 'About Us',
    premium_materials: 'Premium Quality Materials', safety_standards: 'Safety Standards Compliance',
    custom_design: 'Custom Design', warranty_support: 'Warranty & Support',
    read_more: 'Read More', view_all_products: 'View All Products',
    years_exp: 'Years Experience', successful_projects: 'Successful Projects', happy_clients: 'Happy Clients',
    our_projects: 'Portfolio', successful_projects_title: 'Our Successful Projects',
    projects_desc: 'Proshut Aria has proudly executed numerous projects across the country. From equipping city parks and installing urban furniture to designing and building safe playgrounds for children, every project is completed with precision and high quality.',
    view_all_projects: 'View All Projects', office_address: 'Office Address',
    phone_number: 'Phone Number', working_hours: 'Working Hours', email: 'Email',
    send_message: 'Send Message on WhatsApp', need_consulting: 'Need Consulting?',
    experts_ready: 'Our experts are ready to help you choose the best product',
    product_count: 'products', no_products: 'No Products Found', no_products_desc: 'There are no products in this category at the moment.',
    share: 'Share', zoom: 'Zoom', all: 'All', categories: 'Categories',
    code: 'Code', scroll_right: 'Scroll right', scroll_left: 'Scroll left',
    our_services_title: 'Professional Services', more_details: 'More Details', services_page_desc: 'Leveraging our experience and technical expertise, we offer a wide range of industrial services to our clients.',
    why_us: 'Why Us?', service_advantages: 'Our Service Advantages',
    guaranteed_quality: 'Guaranteed Quality', guaranteed_quality_desc: 'All our services are delivered with the highest quality standards and come with a valid warranty.',
    expert_team: 'Expert Team', expert_team_desc: 'Our experienced engineers and specialists are ready to serve you.',
    support_24: '24/7 Support', support_24_desc: 'Our support team is available around the clock to answer your questions.',
    fair_price: 'Fair Pricing', fair_price_desc: 'High-quality services at competitive prices.',
    need_consulting_cta: 'Need Consulting?', consulting_cta_desc: 'Contact our experts now and get free consultation',
    contact_us: 'Contact Us',
    articles: 'Articles & Educational Content', articles_desc: 'Read the latest educational and technical articles.',
    no_articles: 'No articles published yet', no_articles_desc: 'Educational and technical articles will be published soon.',
    read_article: 'Read More', related_posts: 'Related Posts', categories_widget: 'Categories',
    have_question: 'Have a Question?', experts_answering: 'Our experts are ready to answer',
    executed_projects: 'Executed Projects', projects_page_desc: 'A collection of our successful projects in urban furniture and children\'s playgrounds',
    have_project: 'Have a Project in Mind?', consult_experts: 'Consult with our experts to get the best solution.',
    our_values: 'Our Values', mission_vision: 'Mission, Vision & Values',
    our_mission: 'Our Mission', mission_desc: 'Providing products and services with international quality at reasonable prices, along with professional consulting and continuous support.',
    our_vision: 'Our Vision', our_values_title: 'Our Values',
    values_desc: 'Honesty, quality, innovation, and customer focus are the pillars of our work.',
    history: 'History', growth_path: 'Our Growth Journey', notable_projects: 'Notable Projects',
    ready_to_cooperate: 'Ready to Cooperate', contact_for_more: 'Contact us for more information and consultation',
    manufacturer_tag: 'Manufacturer of Urban Furniture & Playgrounds',
    follow_social: 'Follow us on social media',
    map_location: 'Our Location on Map',
    product_code: 'Code', specs: 'Technical Specifications', description: 'Description',
    page_not_found: 'Page Not Found',
    urban_waste_bins: 'Galvanized Mechanized Urban Waste Bins',
    urban_waste_desc: 'Manufacturing and supplying high-quality urban waste bins compliant with environmental standards',
    kids_play: 'Safe Playground Equipment for Children',
    kids_play_desc: 'Design and production of play sets, swings, slides, and seesaws according to standards',
    urban_furniture: 'Urban Furniture & Benches',
    urban_furniture_desc: 'Design and production of outdoor furniture, benches, and urban seating with durable materials',
    view_products: 'View Products',
    proshut_products: 'Proshut Aria Products',
    direct_call: 'Direct Call',
  }
};

app.use((req, res, next) => {
  // Language detection: query > cookie > default
  if (req.query.lang) {
    req.session.lang = req.query.lang === 'en' ? 'en' : 'fa';
  }
  const lang = (req.session && req.session.lang) || 'fa';
  const isEn = lang === 'en';

  res.locals.settings = getSettings();
  res.locals.currentPath = req.path;
  const allCats = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  // Swap to English names if available
  if (isEn) {
    allCats.forEach(c => {
      if (c.name_en) c.name = c.name_en;
      if (c.description_en) c.description = c.description_en;
    });
  }
  res.locals.categories = allCats.filter(c => !c.parent_id);
  res.locals.allCategories = allCats;
  res.locals.admin = req.session && req.session.admin ? req.session.admin.name || req.session.admin.username : null;
  res.locals.lang = lang;
  res.locals.isEn = isEn;
  res.locals.dir = isEn ? 'ltr' : 'rtl';
  res.locals.t = function(key) { return (translations[lang] && translations[lang][key]) || (translations.fa[key]) || key; };
  res.locals.toEnNum = function(str) { return String(str).replace(/[۰-۹]/g, function(d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }); };

  // Helper to swap English fields on DB rows
  res.locals.localize = function(rows, fields) {
    if (!isEn) return rows;
    const arr = Array.isArray(rows) ? rows : [rows];
    arr.forEach(r => {
      if (!r) return;
      fields.forEach(f => { if (r[f + '_en']) r[f] = r[f + '_en']; });
    });
    return rows;
  };

  // Use English settings if available
  if (isEn) {
    const s = res.locals.settings;
    if (s.company_name_en) s.company_name = s.company_name_en;
    if (s.company_short_en) s.company_short = s.company_short_en;
    if (s.about_short_en) s.about_short = s.about_short_en;
    if (s.about_text_en) s.about_text = s.about_text_en;
    if (s.address_en) s.address = s.address_en;
    if (s.working_hours_en) s.working_hours = s.working_hours_en;
    if (s.meta_title_en) s.meta_title = s.meta_title_en;
    if (s.meta_description_en) s.meta_description = s.meta_description_en;
    if (s.about_mission_en) s.about_mission = s.about_mission_en;
    if (s.about_vision_en) s.about_vision = s.about_vision_en;
    if (s.years_experience_en) s.years_experience = s.years_experience_en;
    if (s.happy_clients_en) s.happy_clients = s.happy_clients_en;
    if (s.projects_done_en) s.projects_done = s.projects_done_en;
    if (s.team_members_en) s.team_members = s.team_members_en;
  }

  next();
});

// ── Routes ──
app.use('/admin', adminRoutes);
app.use('/', frontRoutes);

// 404
app.use((req, res) => {
  res.status(404).render('pages/404', { pageTitle: '404', breadcrumbs: [{ label: 'صفحه یافت نشد', url: null }] });
});

app.listen(PORT, () => {
  console.log(`🚀 Proshut Aria running at http://localhost:${PORT}`);
  console.log(`📋 Admin panel: http://localhost:${PORT}/admin`);
  console.log(`   Username: admin | Password: admin123`);
});
