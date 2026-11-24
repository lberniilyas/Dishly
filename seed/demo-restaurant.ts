/**
 * Demo restaurant used for phase 1 (and for sales demos).
 * Loaded by `npm run seed`. Fixed ids make the seed re-runnable: running it
 * again replaces the demo instead of duplicating it.
 *
 * 3D models: real CC0 scans from Poly Haven (see README › Credits), fetched
 * by `npm run samples:fetch`. Photos in seed/photos/ are renders of those
 * same scans.
 */

export interface SeedDish {
  id: string;
  name: string;
  description: string;
  priceCents: number | null;
  tags?: string[];
  /** File in seed/photos/ */
  photo?: string;
  /** Raw scan in seed/sources/ + real-world size (null = keep the scan's own size). */
  model?: { source: string; targetSizeCm: number | null };
}

export interface SeedCategory {
  id: string;
  name: string;
  dishes: SeedDish[];
}

export const DEMO_RESTAURANT = {
  id: "d15b0000-0000-4000-8000-000000000001",
  slug: "bistrot-demo",
  name: "Le Bistrot Démo",
  tagline: "Cuisine maison, produits frais · Démo Dishly",
  brandColor: "#B4532A",
  currency: "EUR",
  locale: "fr",
};

export const DEMO_CATEGORIES: SeedCategory[] = [
  {
    id: "d15b0000-0000-4000-8000-0000000000c1",
    name: "Petit-déjeuner",
    dishes: [
      {
        id: "d15b0000-0000-4000-8000-0000000000d1",
        name: "Croissant pur beurre",
        description: "Feuilletage croustillant au beurre AOP Charentes-Poitou, cuit chaque matin. Servi tiède sur planche en bois tourné.",
        priceCents: 280,
        tags: ["maison"],
        photo: "croissant-on-plate.jpg",
        model: { source: "croissant-on-plate.glb", targetSizeCm: null }, // plate: 27 cm
      },
      {
        id: "d15b0000-0000-4000-8000-0000000000d2",
        name: "Tartine beurre & confiture",
        description: "Pain de campagne grillé, beurre demi-sel, confiture de fraises maison.",
        priceCents: 450,
        tags: ["maison", "vegetarien"],
      },
    ],
  },
  {
    id: "d15b0000-0000-4000-8000-0000000000c2",
    name: "Plats",
    dishes: [
      {
        id: "d15b0000-0000-4000-8000-0000000000d3",
        name: "Croque-monsieur",
        description: "Jambon blanc à l'os, béchamel, comté affiné 18 mois. Salade de jeunes pousses.",
        priceCents: 1350,
        tags: ["signature"],
      },
      {
        id: "d15b0000-0000-4000-8000-0000000000d4",
        name: "Bœuf bourguignon",
        description: "Mijoté six heures au vin de Bourgogne, lardons, champignons, purée maison.",
        priceCents: 1900,
      },
      {
        id: "d15b0000-0000-4000-8000-0000000000d5",
        name: "Salade de chèvre chaud",
        description: "Toasts de chèvre au miel, noix, pommes, mesclun et vinaigrette à la moutarde.",
        priceCents: 1450,
        tags: ["vegetarien"],
      },
    ],
  },
  {
    id: "d15b0000-0000-4000-8000-0000000000c3",
    name: "Desserts",
    dishes: [
      {
        id: "d15b0000-0000-4000-8000-0000000000d6",
        name: "Fraisier au chocolat",
        description: "Génoise cacao, crème au chocolat au lait et fraises fraîches de saison. Gâteau entier à partager, 8 parts.",
        priceCents: 3800,
        tags: ["partage", "signature"],
        photo: "strawberry-chocolate-cake.jpg",
        model: { source: "strawberry-chocolate-cake.glb", targetSizeCm: null }, // 24 cm
      },
      {
        id: "d15b0000-0000-4000-8000-0000000000d7",
        name: "Carrot cake maison",
        description: "Moelleux aux carottes et épices douces, glaçage au cream cheese, éclats de noix de pécan. À partager, 6 à 8 parts.",
        priceCents: 3200,
        tags: ["maison", "partage"],
        photo: "carrot-cake.jpg",
        model: { source: "carrot-cake.glb", targetSizeCm: null }, // 22.5 cm
      },
      {
        id: "d15b0000-0000-4000-8000-0000000000d8",
        name: "Mousse au chocolat",
        description: "Chocolat noir 70 %, fleur de sel.",
        priceCents: 750,
        tags: ["maison", "vegetarien"],
      },
    ],
  },
  {
    id: "d15b0000-0000-4000-8000-0000000000c4",
    name: "Boissons",
    dishes: [
      { id: "d15b0000-0000-4000-8000-0000000000d9", name: "Café expresso", description: "", priceCents: 220 },
      { id: "d15b0000-0000-4000-8000-0000000000da", name: "Cappuccino", description: "", priceCents: 450 },
      { id: "d15b0000-0000-4000-8000-0000000000db", name: "Jus d'orange pressé", description: "Oranges pressées à la minute.", priceCents: 550 },
    ],
  },
];
