export function SiteFooter() {
  return (
    <footer className="mt-10 pb-8 pt-6 text-center">
      <div className="rounded-2xl bg-white/70 p-4 text-xs leading-relaxed text-ink-muted">
        <p className="font-semibold text-ink-soft">גילוי נאות</p>
        <p className="mt-1">
          TrendFinder הוא שירות גילוי והמלצה בלבד. איננו מוכרים מוצרים, איננו צד לעסקה,
          ואיננו אחראים למוצרים, לאיכותם, לזמינותם, למשלוח, לתשלום, להחזרות או לאחריות.
          כל רכישה מתבצעת ישירות מול AliExpress ומול המוכר, בכפוף לתנאיהם. אנו רק מקדמים
          מוצרים.
        </p>
        <p className="mt-1">
          <strong>המחירים אינם מדויקים ואינם כוללים דמי משלוח.</strong> הם מבוססים על מידע
          שנאסף מ-AliExpress ועל המרת מטבע משוערת, ומשתנים לעיתים קרובות. המחיר הסופי,
          דמי המשלוח והזמינות המחייבים הם אלה שמופיעים בדף המוצר ב-AliExpress בזמן הרכישה בלבד.
        </p>
        <p className="mt-1">
          TrendFinder עשוי לקבל עמלת שיווק (אפיליאייט) על רכישות שבוצעו דרך הקישורים באתר,
          ללא עלות נוספת עבורך.
        </p>
      </div>
      <p className="mt-4 text-xs text-ink-muted">© {new Date().getFullYear()} TrendFinder</p>
    </footer>
  );
}
