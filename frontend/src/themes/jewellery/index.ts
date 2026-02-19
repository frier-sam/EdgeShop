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
  components: { Header, Footer, Hero, ProductCard, ProductGrid, CartDrawer },
}

export default jewellery
