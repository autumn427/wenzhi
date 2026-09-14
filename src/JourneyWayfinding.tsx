import { useRef, type KeyboardEvent } from 'react'
import { Check } from '@phosphor-icons/react'
import { EventProgress } from './StoryJourney'
import type { UniverseCode } from './simulation'
import './journey-wayfinding.css'

type Route = { code: UniverseCode; tone: string; title: string; fit?: string }
type Props = {
  routes: Route[]
  activeIndex: number
  activeDay: number
  complete: UniverseCode[]
  stages: readonly number[]
  labels: Record<number, string>
  onSelect: (index: number) => void
}

/** A single paper landscape carries the route tabs and the live story road. */
export function JourneyWayfinding({ routes, activeIndex, activeDay, complete, stages, labels, onSelect }: Props) {
  const tabs = useRef<HTMLDivElement>(null)
  const active = routes[activeIndex]
  if (!active) return null
  function handleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % routes.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + routes.length - 1) % routes.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = routes.length - 1
    else return
    event.preventDefault()
    onSelect(next)
    tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus({ preventScroll: true })
  }
  return <div className={`wz-wayfinding tone-${active.tone}`}>
    <div className="paper-route-tabs" role="tablist" aria-label="选择一个职业平行宇宙" ref={tabs}>
      {routes.map((route, index) => {
        const selected = index === activeIndex
        const done = complete.includes(route.code)
        return <button
          className={`paper-route-tab tone-${route.tone}${selected ? ' is-active' : ''}`}
          type="button" role="tab" key={route.code}
          id={`universe-tab-${route.code}`} aria-controls={`universe-panel-${route.code}`}
          aria-selected={selected} tabIndex={selected ? 0 : -1}
          onClick={() => onSelect(index)} onKeyDown={event => handleKey(event, index)}
        >
          <img className="paper-route-tab-art" src={`/wayfinding/route-paper-${route.code.toLowerCase()}.webp`} alt="" decoding="async" draggable={false} />
          <span className="paper-route-tab-letter">{route.code}{done && <Check size={15} weight="bold" aria-label="已完成" />}</span>
          <span className="paper-route-tab-title"><small>宇宙 {route.code}</small><strong>{route.title}</strong></span>
          {route.fit && <span className="paper-route-tab-fit">{route.fit}</span>}
        </button>
      })}
    </div>
    <EventProgress code={active.code} activeDay={activeDay} stages={stages} labels={labels} />
  </div>
}
