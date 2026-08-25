// Verification aid only (POD-UI.md §A7) — never routed, never imported by
// production code, so it is tree-shaken out of the built bundle. Renders
// every variant/state of every Workstream A primitive so they can be
// screenshotted and eyeballed, by this agent and by later workstreams.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../../Button'
import Field from '../../Field'
import { Skeleton as LegacySkeleton, SkeletonCards, SkeletonTable } from '../../Skeleton'
import Badge from '../Badge'
import IconButton from '../IconButton'
import SegmentedControl from '../SegmentedControl'
import Sheet from '../Sheet'
import Skeleton from '../Skeleton'

// Fixed size by default: IconButton's `[&_svg]:h-* [&_svg]:w-*` override
// wins there via specificity, but Button's leftIcon/rightIcon slots don't
// constrain their contents (correctly — sizing is the caller's job), so an
// unconstrained `h-full`/`w-full` icon would resolve against whatever
// ancestor happens to have an explicit height and blow up.
const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V4h6v3m-8 0 1 13h10l1-13" />
  </svg>
)

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line py-10 first:pt-0 last:border-0">
      <h2 className="mb-5 font-display text-xl font-semibold text-ink">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  )
}

function Swatch({ name, varName }: { name: string; varName: string }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="h-14 w-14 rounded-card border border-line" style={{ background: `var(${varName})` }} />
      <span className="text-xs text-ink-soft">{name}</span>
    </div>
  )
}

export default function PrimitivesDemo() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetSnap, setSheetSnap] = useState<'peek' | 'full'>('peek')
  const [segment, setSegment] = useState<'front' | 'back'>('front')
  const [fieldError, setFieldError] = useState(true)
  const [reducedMotionNote] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-8">
      <header className="mb-10">
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Workstream A — Primitives Demo</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          Every variant and state of the design system foundation, for visual verification. Not routed; not part of
          the production bundle.
        </p>
        <p className="mt-2 text-xs text-ink-faint">
          prefers-reduced-motion: reduce currently {reducedMotionNote ? 'ON' : 'off'}
        </p>
      </header>

      <Section title="Tokens — neutrals">
        <Swatch name="paper" varName="--color-paper" />
        <Swatch name="surface" varName="--color-surface" />
        <Swatch name="surface-2" varName="--color-surface-2" />
        <Swatch name="ink" varName="--color-ink" />
        <Swatch name="ink-soft" varName="--color-ink-soft" />
        <Swatch name="ink-faint" varName="--color-ink-faint" />
        <Swatch name="line" varName="--color-line" />
      </Section>

      <Section title="Tokens — accent & status">
        <Swatch name="accent" varName="--color-accent" />
        <Swatch name="accent-dark" varName="--color-accent-dark" />
        <Swatch name="accent-soft" varName="--color-accent-soft" />
        <Swatch name="success" varName="--color-success" />
        <Swatch name="warning" varName="--color-warning" />
        <Swatch name="danger" varName="--color-danger" />
      </Section>

      <Section title="Type scale">
        <div className="w-full space-y-2">
          <p className="font-display text-[2.5rem] font-bold tracking-[-0.03em] text-ink sm:text-[4.5rem]">Hero</p>
          <p className="font-display text-[1.75rem] font-bold tracking-[-0.02em] text-ink sm:text-[2.5rem]">
            Page title
          </p>
          <p className="font-display text-xl font-semibold tracking-[-0.01em] text-ink sm:text-[1.75rem]">
            Section
          </p>
          <p className="text-[0.9375rem] text-ink sm:text-base">Body copy at the confident workhorse sans.</p>
          <p className="text-[0.8125rem] font-medium text-ink-soft sm:text-sm">Small / meta text</p>
        </div>
      </Section>

      <Section title="Button — variants (md)">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </Section>

      <Section title="Button — sizes (sm=36 / md=44 / lg=52)">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </Section>

      <Section title="Button — states">
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
        <Button leftIcon={<PlusIcon />}>Left icon</Button>
        <Button rightIcon={<TrashIcon />} variant="danger">
          Right icon
        </Button>
        <Button as={Link} to="/shop" variant="secondary">
          Renders as Link (as=Link)
        </Button>
        <Button href="https://example.com" variant="ghost">
          Renders as anchor (href)
        </Button>
        <div className="w-56">
          <Button fullWidth>Full width</Button>
        </div>
      </Section>

      <Section title="IconButton">
        <IconButton aria-label="Add" variant="primary">
          <PlusIcon />
        </IconButton>
        <IconButton aria-label="Delete" variant="danger">
          <TrashIcon />
        </IconButton>
        <IconButton aria-label="Secondary" variant="secondary">
          <PlusIcon />
        </IconButton>
        <IconButton aria-label="Ghost" variant="ghost">
          <PlusIcon />
        </IconButton>
        <IconButton aria-label="Disabled" disabled>
          <PlusIcon />
        </IconButton>
      </Section>

      <Section title="Badge">
        <Badge variant="neutral">Neutral</Badge>
        <Badge variant="accent">Accent</Badge>
        <Badge variant="success">Success</Badge>
        <Badge variant="warning">Warning</Badge>
        <Badge variant="danger">Danger</Badge>
        <Badge variant="accent" size="sm">
          Small
        </Badge>
        <Badge variant="accent" pop>
          Pop (badge-pop)
        </Badge>
      </Section>

      <Section title="SegmentedControl">
        <SegmentedControl
          aria-label="Side"
          value={segment}
          onChange={setSegment}
          options={[
            { value: 'front', label: 'Front' },
            { value: 'back', label: 'Back' },
          ]}
        />
      </Section>

      <Section title="Field">
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" placeholder="Ada Lovelace" />
          <Field
            label="Email"
            type="email"
            error={fieldError ? 'Enter a valid email address' : undefined}
            hint={fieldError ? undefined : 'We only use this for order updates'}
            placeholder="ada@example.com"
          />
          <Field as="textarea" label="Notes" placeholder="Anything we should know?" />
          <Field
            as="select"
            label="Country"
            placeholder="Select a country"
            options={[
              { value: 'in', label: 'India' },
              { value: 'us', label: 'United States' },
            ]}
          />
        </div>
        <Button size="sm" variant="ghost" onClick={() => setFieldError((v) => !v)}>
          Toggle error state
        </Button>
      </Section>

      <Section title="Skeleton — legacy (components/Skeleton.tsx, API-preserved)">
        <div className="w-full space-y-4">
          <LegacySkeleton className="h-4 w-48" />
          <SkeletonCards count={2} />
          <SkeletonTable rows={2} cols={3} />
        </div>
      </Section>

      <Section title="Skeleton — ui primitive (shape-based)">
        <Skeleton shape="text" width={220} />
        <Skeleton shape="rect" width={160} height={100} />
        <Skeleton shape="circle" width={48} />
      </Section>

      <Section title="Sheet">
        <div className="flex gap-3">
          <Button
            onClick={() => {
              setSheetSnap('peek')
              setSheetOpen(true)
            }}
          >
            Open (peek)
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSheetSnap('full')
              setSheetOpen(true)
            }}
          >
            Open (full)
          </Button>
        </div>
        <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} initialSnap={sheetSnap} title="Colour">
          <div className="grid grid-cols-5 gap-3 py-2">
            {['#4F46E5', '#101014', '#DC2626', '#15803D', '#B45309', '#FFFFFF', '#F1F1F4', '#4338CA', '#EEF2FF', '#6A6A77'].map(
              (color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  className="h-11 w-11 rounded-full border border-line transition-transform duration-fast active:scale-90"
                  style={{ background: color }}
                />
              ),
            )}
          </div>
          <p className="pb-6 text-sm text-ink-soft">
            Drag the handle above down to dismiss, or up to expand to the full-height snap.
          </p>
        </Sheet>
      </Section>

      <Section title="Motion — keyframes at rest (replay by remounting / toggling key)">
        <div className="animate-fade-in rounded-card border border-line bg-surface p-4 text-sm">fade-in</div>
        <div className="animate-fade-up rounded-card border border-line bg-surface p-4 text-sm">fade-up</div>
        <div className="animate-scale-in rounded-card border border-line bg-surface p-4 text-sm">scale-in</div>
        <div className="animate-badge-pop rounded-card border border-line bg-surface p-4 text-sm">badge-pop</div>
      </Section>

      <Section title="Motion — stagger pattern">
        <div className="grid w-full grid-cols-3 gap-3 sm:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{ ['--stagger-index' as string]: i }}
              className="stagger-delay animate-fade-up rounded-card border border-line bg-surface p-4 text-center text-sm"
            >
              {i}
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
