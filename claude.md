**Plan everything, dont take short cuts for making things work**

1: look at project.md for details of what we're building
2: check POD.md to see what is built or what needs to be built (the historical plan.md was the v1/v2 record and has been archived to docs/archive/plans/2026-08-25-edgeshop-v1-v2-archive.md — POD.md is the live plan on this branch)
3: if no plan document exists then generate one with detailed tasks
4: after completing a task update the plan document along with some important decisions made at the end of file.
5: ask for any major clarifications required instead of taking a decision yourself
6: ~~main requirement is that theme is decoupled so multiple themes can be given that can be chosen in admin panel~~ — **retired on the `POD` branch.** The print-on-demand conversion (see POD.md) deliberately removed the theme system: EdgeShop POD is a single-purpose storefront with one hard-coded Tailwind design, not a general-purpose multi-tenant engine. This rule no longer applies; do not reintroduce theme abstraction on this branch without an explicit product decision to do so.