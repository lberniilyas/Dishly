/**
 * Interface text (buttons, labels…) in French. Menu content (dish names…)
 * comes from the database instead. Other languages will copy this shape:
 * TypeScript will then flag any missing key.
 */
export const fr = {
  menu: {
    banner: "Nouveau : découvrez nos plats en 3D, à taille réelle sur votre table.",
    table: (label: string) => `Table ${label}`,
    view3d: "Voir en 3D sur votre table",
    badge3d: "3D",
    poweredBy: "Menu 3D propulsé par Dishly",
    empty: "Le menu est en cours de préparation.",
    notFoundTitle: "Menu introuvable",
    notFoundText: "Ce lien ne correspond à aucun menu. Vérifiez le QR code ou demandez au serveur.",
  },
  dish: {
    back: "Menu",
    viewOnTable: "Voir sur votre table",
    realSize: (cm: string) => `Taille réelle · ${cm} cm`,
    loading3d: "Chargement du plat en 3D…",
    rotateHint: "Faites pivoter avec le doigt",
    noWebgl: "L'aperçu 3D n'est pas disponible sur cet appareil.",
    loadError: "Le modèle 3D n'a pas pu être chargé.",
    arUnavailable: "La réalité augmentée n'est pas disponible dans ce navigateur. Ouvrez la page dans Safari (iPhone) ou Chrome (Android).",
    openOnPhoneTitle: "Voir ce plat sur votre table",
    openOnPhoneText: "Scannez ce code avec l'appareil photo de votre téléphone.",
    arPreparing: "Ouverture de la réalité augmentée…",
  },
  tags: {
    maison: "Fait maison",
    vegetarien: "Végétarien",
    vegan: "Vegan",
    signature: "Signature",
    partage: "À partager",
    nouveau: "Nouveau",
    epice: "Épicé",
  } as Record<string, string>,
};

export type Dictionary = typeof fr;
