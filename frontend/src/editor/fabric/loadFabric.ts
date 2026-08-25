// frontend/src/editor/fabric/loadFabric.ts
//
// The ONLY place `import('fabric')` appears in the whole app. POD.md §6.1
// requires Fabric to stay out of the main bundle — `await import('fabric')`
// here plus `React.lazy(() => import('../editor/CustomizerEditor'))` at the
// call site guarantee it only ever downloads when a shopper opens
// `/customize/:productId`. See POD.md §11 — isolating every Fabric call
// behind `frontend/src/editor/fabric/` means a future library swap only
// ever touches this directory.
export type FabricModule = typeof import('fabric')

let modulePromise: Promise<FabricModule> | null = null

/** Cached dynamic import — safe to call from multiple components; the network fetch happens once. */
export function loadFabric(): Promise<FabricModule> {
  if (!modulePromise) {
    modulePromise = import('fabric')
  }
  return modulePromise
}

export type FabricCanvas = InstanceType<FabricModule['Canvas']>
export type FabricObject = InstanceType<FabricModule['FabricObject']>
export type FabricIText = InstanceType<FabricModule['IText']>
export type FabricImage = InstanceType<FabricModule['FabricImage']>
