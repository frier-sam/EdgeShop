// Material Symbols Outlined subset — POD-UI4.md §2.6.
//
// The full Material Symbols Outlined variable font is ~340KB, which is not
// shippable. Google Fonts supports subsetting by ligature name via the
// `icon_names=` query parameter, which drops it to ~20KB for a list this
// size. That parameter lives in `frontend/index.html`, and it MUST stay
// byte-identical to the list below.
//
// The failure mode of a mismatch is silent and shopper-visible: a glyph the
// subset doesn't contain renders as its literal ligature text, so a cart
// button reads "shopping_cart". `__tests__/iconNames.test.ts` therefore
// scans every source file for `<Icon name="…">` literals and fails when one
// isn't in this array — turning a silent visual bug into a CI failure.
//
// Keep SORTED (the test asserts it) so the array and the `icon_names=`
// parameter can be diffed by eye, and so additions land in one obvious
// place instead of being appended blindly.
export const ICON_NAMES = [
  'add',
  'add_shopping_cart',
  'arrow_back',
  'arrow_forward',
  'aspect_ratio',
  'autorenew',
  'bolt',
  'campaign',
  'check',
  'check_circle',
  'chevron_left',
  'chevron_right',
  'close',
  'cloud_upload',
  'content_copy',
  'credit_card',
  'dashboard',
  'delete',
  'design_services',
  'discount',
  'download',
  'drag_indicator',
  'edit',
  'error',
  'expand_less',
  'expand_more',
  'favorite',
  'filter_list',
  'format_size',
  'grid_on',
  'grid_view',
  'group',
  'help',
  'home',
  'image',
  'info',
  'inventory_2',
  'keyboard_arrow_down',
  'keyboard_arrow_up',
  'layers',
  'link',
  'local_offer',
  'local_shipping',
  'location_on',
  'lock',
  'logout',
  'mail',
  'menu',
  'more_vert',
  'open_in_new',
  'palette',
  'payments',
  'pending',
  'person',
  'phone_in_talk',
  'photo_camera',
  'print',
  'public',
  'receipt_long',
  'redo',
  'remove',
  'savings',
  'schedule',
  'search',
  'sell',
  'settings',
  'shield',
  'shopping_basket',
  'shopping_cart',
  'star',
  'star_half',
  'storefront',
  'straighten',
  'text_fields',
  'tune',
  'undo',
  'upload',
  'upload_file',
  'verified',
  'view_carousel',
  'visibility',
  'visibility_off',
  'warning',
  'zoom_in',
] as const

export type IconName = (typeof ICON_NAMES)[number]
