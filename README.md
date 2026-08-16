# Color Pour: Sort & Bloom

لعبة ألغاز هاتفية عمودية مبنية بـ HTML5 Canvas وCSS وJavaScript. ينقل اللاعب الطبقة العليا من أنبوب إلى آخر عندما يكون الأنبوب الهدف فارغاً أو يحمل اللون نفسه، ثم يفرز كل لون ليزرع أثراً نباتياً صغيراً.

## ما يتضمنه المشروع

يحتوي المشروع على 20 مرحلة متدرجة محفوظة في `client/public/levels.json`، مع حفظ المرحلة المفتوحة والتقدم في `localStorage`. تتضمن الواجهة أزرار إعادة المرحلة، التراجع عن الحركة، وخريطة المراحل، كما تدعم اللمس والماوس في اتجاه عمودي.

تتوفر أيضاً تهيئة PWA في `client/public/manifest.json` و`client/public/sw.js`، وملف `config.xml` أساسياً للتغليف لاحقاً عبر Cordova أو Capacitor إلى APK.

## التشغيل محلياً

```bash
pnpm install
pnpm dev
```

ثم افتح عنوان Vite المحلي. لبناء نسخة الإنتاج:

```bash
pnpm check
pnpm build
```

## البنية المهمة

| المسار | الوظيفة |
|---|---|
| `client/src/pages/Home.tsx` | غلاف واجهة اللعبة وخريطة المراحل |
| `client/src/game/script.js` | منطق Canvas والحركة والفوز والحفظ |
| `client/src/style.css` | الهوية المرئية المتجاوبة |
| `client/public/levels.json` | بيانات المراحل العشرين |
| `client/public/manifest.json` | إعداد PWA |
| `client/public/sw.js` | التخزين دون اتصال |
| `config.xml` | تهيئة تغليف APK لاحقاً |

## الترخيص

هذا المستودع مخصص لمشروع Color Pour: Sort & Bloom.
