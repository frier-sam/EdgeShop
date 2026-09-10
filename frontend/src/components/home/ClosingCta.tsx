import { Link } from 'react-router-dom'
import Button from '../Button'
import Icon from '../ui/Icon'

/** F7 — closing CTA band, accent background, single strong call to action. */
export default function ClosingCta() {
  return (
    <section className="bg-accent px-4 py-14 text-center md:px-10 md:py-20">
      <div className="animate-fade-up mx-auto max-w-2xl">
        <h2 className="font-display text-headline-md text-on-accent md:text-headline-lg">
          Got an idea? Put it on something.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm text-on-accent/80 md:text-base">
          Start with a blank tee, hoodie or mug and make it yours in minutes.
        </p>
        <div className="mt-8">
          <Button as={Link} to="/shop" variant="secondary" size="lg" rightIcon={<Icon name="arrow_forward" size={18} />}>
            Start designing
          </Button>
        </div>
      </div>
    </section>
  )
}
