import type { Theme } from '../types'
import Header from './Header'
import Footer from './Footer'
import Hero from './Hero'
import ProductCard from './ProductCard'
import ProductGrid from './ProductGrid'
import CartDrawer from './CartDrawer'

const jewellery: Theme = {
  id: 'jewellery',
  name: 'Jewellery',
  description: 'Elegant, minimal, gold-accented. Perfect for fine jewellery.',
  defaultCssVars: {
    '--color-primary': '#1A1A1A',
    '--color-accent': '#C9A96E',
    '--color-bg': '#FAFAF8',
    '--color-text': '#1A1A1A',
    '--font-heading': '"Playfair Display", serif',
    '--font-body': 'system-ui, sans-serif',
  },
  components: { Header, Footer, Hero, ProductCard, ProductGrid, CartDrawer },
}

export default jewellery
