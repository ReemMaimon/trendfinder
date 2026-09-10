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
          המחירים והנתונים מוצגים על סמך מידע שנאסף מ-AliExpress וייתכנו שינויים או אי-דיוקים.
          TrendFinder עשוי לקבל עמלת שיווק (אפיליאייט) על רכישות שבוצעו דרך הקישורים באתר,
          ללא עלות נוספת עבורך.
        </p>
      </div>
      <p className="mt-4 text-xs text-ink-muted">© {new Date().getFullYear()} TrendFinder</p>
    </footer>
  );
}
