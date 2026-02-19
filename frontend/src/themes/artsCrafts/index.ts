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
  components: { Header, Footer, Hero, ProductCard, ProductGrid, CartDrawer },
}

export default artsCrafts
