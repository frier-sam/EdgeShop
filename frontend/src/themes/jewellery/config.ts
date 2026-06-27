export interface ProductTab {
  key: 'description' | 'static'
  label: string
  content?: string
}

export interface CollectionLink {
  label: string
  href: string
}

export const jewelleryConfig = {
  /** Links used in the "Shop by Collection" row on the homepage */
  collectionLinks: [
    { label: 'Rings',     href: '/collections/rings' },
    { label: 'Necklaces', href: '/collections/necklaces' },
    { label: 'Earrings',  href: '/collections/earrings' },
    { label: 'Bracelets', href: '/collections/bracelets' },
    { label: 'Anklets',   href: '/collections/anklets' },
    { label: 'Pendants',  href: '/collections/pendants' },
  ] satisfies CollectionLink[],
  productTabs: [
    {
      key: 'description' as const,
      label: 'Description',
    },
    {
      key: 'static' as const,
      label: 'Shipping & Returns',
      content: `Free standard shipping on orders above ₹999.\nExpress shipping available at checkout for ₹149.\n\nDelivery within 5–7 business days for standard shipping.\nExpress orders delivered within 2–3 business days.\n\nReturns accepted within 7 days of delivery.\nItem must be unused, in original packaging, with tags intact.\nTo initiate a return, email us at returns@edgeshop.in with your order number.`,
    },
    {
      key: 'static' as const,
      label: 'Care Guide',
      content: `Store your jewellery in the provided pouch or a soft-lined box to prevent scratches.\n\nAvoid contact with perfume, lotions, and harsh chemicals.\nRemove jewellery before swimming, bathing, or exercising.\n\nClean gently with a soft, dry cloth after each wear.\nFor gold-plated pieces, avoid abrasive materials that may wear the plating.\nFor sterling silver, use a silver polishing cloth to restore shine.`,
    },
  ] satisfies ProductTab[],
}
