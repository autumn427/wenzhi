import { useEffect, useRef } from 'react'
import './paper-accents.css'

type Props = { kind: 'departure-map' | 'unfolding-paths' | 'return-envelope'; placement: string; waiting?: boolean }
export function PaperAccent({kind,placement,waiting=false}:Props) {
 const root=useRef<HTMLDivElement>(null)
 useEffect(()=>{
  const el=root.current, host=el?.parentElement
  if(!el || !host) return
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)')
  const observer=new IntersectionObserver(entries=>{for(const entry of entries) if(entry.isIntersecting) el.classList.add('is-visible')},{threshold:.15})
  observer.observe(el)
  let frame=0
  const reset=()=>{cancelAnimationFrame(frame);el.style.setProperty('--art-x','0px');el.style.setProperty('--art-y','0px');el.style.setProperty('--art-turn','0deg')}
  const move=(event:PointerEvent)=>{
   if(reduced.matches || event.pointerType!=='mouse')return
   cancelAnimationFrame(frame)
   frame=requestAnimationFrame(()=>{const rect=host.getBoundingClientRect();const x=(event.clientX-rect.left)/rect.width-.5;const y=(event.clientY-rect.top)/rect.height-.5;el.style.setProperty('--art-x',`${x*8}px`);el.style.setProperty('--art-y',`${y*6}px`);el.style.setProperty('--art-turn',`${x*3}deg`)})
  }
  host.addEventListener('pointermove',move);host.addEventListener('pointerleave',reset);reduced.addEventListener('change',reset)
  return ()=>{observer.disconnect();reset();host.removeEventListener('pointermove',move);host.removeEventListener('pointerleave',reset);reduced.removeEventListener('change',reset)}
 },[])
 return <div ref={root} className={`paper-accent accent-${placement}${waiting?' is-waiting':''}`} aria-hidden="true"><img src={`/art/${kind}.png`} alt="" width="400" height="320" loading="lazy" decoding="async"/></div>
}
