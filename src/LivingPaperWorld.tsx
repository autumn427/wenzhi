import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import './living-paper-world.css'

/** Cinemagraph layers reuse the original illustration; no invented character frames. */
export function LivingPaperWorld({ active }: { active: boolean }) {
  const root = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    if (!active) return
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const motion = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut' } })
        .fromTo('.living-paper-camera', { scale: 1.025, xPercent: -.35 }, { scale: 1.045, xPercent: .35, duration: 14 }, 0)
        .fromTo('.living-paper-light', { xPercent: -12, opacity: .12 }, { xPercent: 12, opacity: .3, duration: 14 }, 0)
      const breath = gsap.to('.living-paper-character', { y: -2, scaleY: 1.014, rotation: .22, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      const foliage = gsap.to('.living-paper-foreground', { rotation: .45, x: 2, duration: 5.2, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      const glow = gsap.to('.living-paper-glow', { opacity: .48, scale: 1.07, duration: 3.8, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      const animations = [motion, breath, foliage, glow]
      let onScreen = true
      const sync = () => animations.forEach((animation) => animation.paused(document.hidden || !onScreen))
      const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync() })
      if (root.current) observer.observe(root.current)
      document.addEventListener('visibilitychange', sync)
      sync()
      return () => { observer.disconnect(); document.removeEventListener('visibilitychange', sync) }
    }, root)
    return () => media.revert()
  }, { scope: root, dependencies: [active], revertOnUpdate: true })
  return <div className="living-paper" ref={root} aria-hidden="true">
    <div className="living-paper-camera">
      <div className="living-paper-base" />
      <div className="living-paper-character" />
      <div className="living-paper-foreground" />
      <div className="living-paper-glow" />
      <div className="living-paper-light" />
    </div>
  </div>
}
