/**
 * Product categories used for diversity classification. Editable here (and, at
 * runtime, the diversity rules that reference them are editable from Admin
 * Settings). Keep the keys stable — they are stored on Product.category.
 */
export const CATEGORIES = [
  "Technology",
  "Gaming",
  "Home",
  "Kitchen",
  "Fitness",
  "Beauty",
  "Fashion",
  "Toys",
  "Automotive",
  "Pets",
  "Outdoor",
  "Accessories",
  "Gadgets",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Hebrew display labels for the public site. */
export const CATEGORY_LABELS_HE: Record<Category, string> = {
  Technology: "טכנולוגיה",
  Gaming: "גיימינג",
  Home: "בית",
  Kitchen: "מטבח",
  Fitness: "כושר",
  Beauty: "יופי וטיפוח",
  Fashion: "אופנה",
  Toys: "צעצועים",
  Automotive: "רכב",
  Pets: "חיות מחמד",
  Outdoor: "טבע וחוץ",
  Accessories: "אקססוריז",
  Gadgets: "גאדג'טים",
  Other: "אחר",
};

export function normalizeCategory(input: string | null | undefined): Category {
  if (!input) return "Other";
  const match = CATEGORIES.find(
    (c) => c.toLowerCase() === input.trim().toLowerCase(),
  );
  return match ?? "Other";
}
