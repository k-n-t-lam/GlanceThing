import { useContext, useEffect, useRef, useState, WheelEvent } from 'react'

import RestoreScreen from '@/components/RestoreScreen/RestoreScreen.tsx'
import { AppBlurContext } from '@/contexts/AppBlurContext.tsx'
import { SocketContext } from '@/contexts/SocketContext.tsx'

import styles from './Menu.module.css'

const Menu: React.FC = () => {
  const { setBlurred } = useContext(AppBlurContext)
  const { ready, socket } = useContext(SocketContext)

  const [shown, setShown] = useState(false)
  const shownRef = useRef(shown)

  const [restoring, setRestoring] = useState(false)

  const buttonsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function listener(e: KeyboardEvent) {
      if (e.key === 'm') {
        setShown(s => !s)
        const first = buttonsRef.current?.firstElementChild as HTMLElement
        first.focus()
      } else if (e.key === 'ArrowLeft' && shownRef.current) {
        e.preventDefault()
        onWheel({ deltaX: -1 } as WheelEvent<HTMLDivElement>)
      } else if (e.key === 'ArrowRight' && shownRef.current) {
        e.preventDefault()
        onWheel({ deltaX: 1 } as WheelEvent<HTMLDivElement>)
      } else if (e.key === 'Escape' && shownRef.current) {
        setShown(false)
      }
    }

    document.addEventListener('keydown', listener)

    return () => {
      document.removeEventListener('keydown', listener)
    }
  })

  useEffect(() => {
    setBlurred(shown)
    shownRef.current = shown
  }, [shown, setBlurred])

  function onWheel(e: WheelEvent<HTMLDivElement>) {
    if (!buttonsRef.current) return

    const focused = document.activeElement as HTMLElement
    if (e.deltaX < 0) {
      const prev = focused.previousElementSibling as HTMLElement
      if (prev) {
        prev.focus()
      } else {
        const last = buttonsRef.current?.lastElementChild as HTMLElement
        last.focus()
      }
    } else if (e.deltaX > 0) {
      const next = focused.nextElementSibling as HTMLElement
      if (next) {
        next.focus()
      } else {
        const first = buttonsRef.current?.firstElementChild as HTMLElement
        first.focus()
      }
    }
  }

  useEffect(() => {
    const listener = (e: globalThis.WheelEvent) => {
      if (shownRef.current) {
        e.preventDefault()
        onWheel({
          deltaX: e.deltaX
        } as WheelEvent<HTMLDivElement>)
      }
    }

    document.addEventListener('wheel', listener, {
      passive: false
    })

    return () => {
      document.removeEventListener('wheel', listener)
    }
  })

  function restore() {
    socket?.send(
      JSON.stringify({
        type: 'restore'
      })
    )
    setRestoring(true)
  }

  return (
    <>
      <div className={styles.menu} data-shown={shown && !restoring}>
        <h2>Would you like to return to the stock CarThing software?</h2>
        <div className={styles.buttons} ref={buttonsRef}>
          <button
            onKeyDown={e => e.key === 'Enter' && setShown(false)}
            onClick={() => setShown(false)}
          >
            Cancel
          </button>
          <button onClick={restore} data-action="return" disabled={!ready}>
            Return to CarThing
          </button>
        </div>
      </div>
      {restoring && <RestoreScreen />}
    </>
  )
}

export default Menu
