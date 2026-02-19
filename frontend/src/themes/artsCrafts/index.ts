import type { Theme } from '../types'
import Header from './Header'
import Footer from './Footer'
import Hero from './Hero'
import ProductCard from './ProductCard'
import ProductGrid from './ProductGrid'
import CartDrawer from './CartDrawer'

const artsCrafts: Theme = {
  id: 'artsCrafts',
  name: 'Arts & Crafts',
  description: 'Warm, earthy, terracotta-accented. Perfect for handmade goods.',
  defaultCssVars: {
    '--color-primary': '#2C2416',
    '--color-accent': '#C4622D',
    '--color-bg': '#F5F0E8',
    '--color-text': '#2C2416',
    '--font-heading': 'system-ui, sans-serif',
    '--font-body': 'system-ui, sans-serif',
  },
  components: { Header, Footer, Hero, ProductCard, ProductGrid, CartDrawer },
}

export default artsCrafts
