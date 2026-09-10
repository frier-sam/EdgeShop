// POD-V2.md §6.5 — applying a design template must be UNDOABLE.
//
// A template replaces the current side's contents wholesale (Vistaprint
// behaviour), so if the apply is not recoverable, one mis-tap on a template
// card destroys whatever the shopper had built with no way back. §6.5 asks for
// it to land "as a single undo entry, so it's recoverable" — and the "single
// entry" half is easy to satisfy in a way that silently breaks the
// "recoverable" half, which is exactly what happened first time round.
//
// The only bracket-closing call that existed was `resumeAndReseedHistory`,
// written for side swaps, which WIPES the stack (correct there: the outgoing
// side's history must not be undoable into the incoming side). Used for a
// template apply it leaves `canUndo === false`, so the replace is permanent.
// `resumeHistoryAsOneEntry` closes the same bracket while keeping the stack.
//
// These tests pin the behavioural difference between the two, not the
// implementation, so the distinction can't be "simplified" back out.
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEditorObjects } from '../useEditorObjects'
import type { FabricCanvas, FabricObject } from '../fabric/loadFabric'

/** A canvas whose serialized content we can change, so history entries differ. */
function mockCanvas(objects: FabricObject[] = []) {
  const state = { objects }
  const canvas = {
    on: vi.fn(),
    off: vi.fn(),
    getObjects: () => state.objects,
    getActiveObject: () => null,
    requestRenderAll: vi.fn(),
    // snapshotCanvas() calls toObject(props) and JSON.stringify's the result.
    toObject: () => ({ objects: state.objects }),
    setObjects: (next: FabricObject[]) => {
      state.objects = next
    },
    // undo()/redo() restore through restoreCanvas -> loadFromJSON, so the
    // mock has to actually apply a snapshot back onto its own state.
    loadFromJSON: async (json: string) => {
      state.objects = JSON.parse(json).objects ?? []
    },
  }
  return canvas as unknown as FabricCanvas & { setObjects: (n: FabricObject[]) => void }
}

const obj = (id: string) => ({ id } as unknown as FabricObject)

describe('template apply history bracketing (POD-V2.md §6.5)', () => {
  it('resumeHistoryAsOneEntry leaves the apply undoable', () => {
    const canvas = mockCanvas([obj('shopper-work')])
    const { result } = renderHook(() => useEditorObjects({ fabric: null, canvas }))

    // Seed a baseline entry, as a real editing session would.
    act(() => result.current.commitChange())
    expect(result.current.canUndo).toBe(false) // one entry only

    // Apply a template: suspend, replace contents, resume WITHOUT reseeding.
    act(() => {
      result.current.suspendHistory()
      canvas.setObjects([obj('template-a'), obj('template-b')])
      result.current.resumeHistoryAsOneEntry()
    })

    // The pre-apply state is still on the stack, so Cmd+Z can reach it.
    expect(result.current.canUndo).toBe(true)
  })

  it('resumeAndReseedHistory would make the same apply permanent — which is why it is not used here', () => {
    const canvas = mockCanvas([obj('shopper-work')])
    const { result } = renderHook(() => useEditorObjects({ fabric: null, canvas }))

    act(() => result.current.commitChange())
    act(() => {
      result.current.suspendHistory()
      canvas.setObjects([obj('template-a')])
      result.current.resumeAndReseedHistory() // the side-swap variant
    })

    expect(result.current.canUndo).toBe(false)
  })

  it('records the whole multi-object apply as ONE entry, not one per object', async () => {
    const canvas = mockCanvas([obj('start')])
    const { result } = renderHook(() => useEditorObjects({ fabric: null, canvas }))
    act(() => result.current.commitChange())

    // While suspended, every intermediate mutation must be ignored — this is
    // what stops a 6-object template from filling the 30-state ring buffer.
    act(() => {
      result.current.suspendHistory()
      for (let i = 0; i < 6; i++) {
        canvas.setObjects(Array.from({ length: i + 1 }, (_, n) => obj(`t${n}`)))
        result.current.commitChange() // muted while suspended
      }
      result.current.resumeHistoryAsOneEntry()
    })

    // Baseline + exactly one apply entry: a single undo returns to baseline,
    // and a second undo has nothing left to reach.
    expect(result.current.canUndo).toBe(true)
    // undo() finishes updating canUndo in a .finally() after the async
    // restore, so the assertion has to wait for that microtask to settle.
    await act(async () => {
      result.current.undo()
      await Promise.resolve()
    })
    expect(result.current.canUndo).toBe(false)
  })
})
