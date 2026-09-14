import { CSSProperties, PointerEvent, useMemo, useRef, useState } from 'react'
import { ArrowRight, Broadcast, Cube, Gauge } from '@phosphor-icons/react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { SimulationState, UniverseCode } from './simulation'

gsap.registerPlugin(useGSAP)

type TwinNode = 'ability' | 'work' | 'echo'

type Props = {
  code: UniverseCode
  day: number
  eventTitle: string
  evidenceCount: number
  state: SimulationState
}

const palette: Record<UniverseCode, { css: string; label: string }> = {
  A: { css: '#2478d7', label: '系统学习' },
  B: { css: '#c8872d', label: 'AI 协作' },
  C: { css: '#47775a', label: '专业深耕' },
}

const nodePositions: Record<TwinNode, { left: string; top: string }> = {
  ability: { left: '20%', top: '42%' },
  work: { left: '53%', top: '35%' },
  echo: { left: '80%', top: '43%' },
}

const kanshanPositions: Record<TwinNode, { left: string; top: string }> = {
  ability: { left: '34%', top: '70%' },
  work: { left: '50%', top: '68%' },
  echo: { left: '66%', top: '70%' },
}

const routePaths: Record<TwinNode, string> = {
  ability: 'M34 70 C30 63 25 54 20 42',
  work: 'M50 68 C50 57 52 47 53 35',
  echo: 'M66 70 C73 63 78 54 80 43',
}

export function DigitalTwinStage({ code, day, eventTitle, evidenceCount, state }: Props) {
  const stageRef = useRef<HTMLElement>(null)
  const [activeNode, setActiveNode] = useState<TwinNode>('work')
  const colors = palette[code]
  const towerLevel = Math.max(1, Math.min(5, Math.ceil(Math.max(state.technicalSkill, state.aiCollaboration) / 20)))
  const workshopPieces = Math.max(1, Math.min(5, Math.ceil(state.portfolio / 20)))
  const greenhouseLeaves = Math.max(1, Math.min(6, Math.ceil(state.domainDepth / 16)))
  const opportunityLights = Math.max(1, Math.min(4, Math.ceil(state.opportunity / 25)))

  const nodes = useMemo(() => ({
    ability: {
      label: `蓝塔点亮 ${towerLevel}/5 层`,
      value: `技术 ${state.technicalSkill} · 协作 ${state.aiCollaboration}`,
      note: state.technicalSkill > state.aiCollaboration ? '遇到报错，你更知道该从哪里查了。' : '你在试着让 AI 帮忙，也得自己检查结果。',
      icon: Gauge,
    },
    work: {
      label: `工坊留下 ${workshopPieces}/5 件`,
      value: `游戏作品值 ${state.portfolio}`,
      note: state.portfolio >= 55 ? '这条路的作品值已经有了一些积累。' : '作品值还不高，接下来怎么做，由你选。',
      icon: Cube,
    },
    echo: {
      label: `温室长出 ${greenhouseLeaves}/6 片`,
      value: `${evidenceCount} 条真人经历`,
      note: '有人也为这件事纠结过。看看他们后来怎么样了。',
      icon: Broadcast,
    },
  }), [evidenceCount, greenhouseLeaves, state.aiCollaboration, state.portfolio, state.technicalSkill, towerLevel, workshopPieces])

  const current = nodes[activeNode]
  const CurrentIcon = current.icon
  const kanshanPosition = kanshanPositions[activeNode]
  const sceneStyle = {
    '--twin-accent': colors.css,
    '--universe-art': `url("/career-universe-${code.toLowerCase()}-full.webp")`,
    '--kanshan-x': kanshanPosition.left,
    '--kanshan-y': kanshanPosition.top,
    '--scene-energy': `${Math.max(.72, state.energy / 100)}`,
    '--scene-growth': `${Math.max(.25, state.domainDepth / 100)}`,
    '--scene-lights': `${Math.max(.2, state.opportunity / 100)}`,
  } as CSSProperties

  useGSAP(() => {
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const paperBreath = gsap.timeline({ repeat: -1, yoyo: true, defaults: { ease: 'sine.inOut' } })
        .to('.digital-twin-depth-back', { x: 4, y: -2, rotation: .18, duration: 7.5 }, 0)
        .to('.digital-twin-depth-mid', { x: -5, y: 3, rotation: -.12, duration: 6.4 }, 0)
        .to('.digital-twin-depth-front', { x: 3, y: -3, rotation: .12, duration: 5.8 }, 0)
      const moteDrift = gsap.to('.digital-twin-motes i', {
        y: (index) => -8 - index * 2,
        x: (index) => index % 2 ? 5 : -4,
        rotation: (index) => index % 2 ? 14 : -11,
        duration: (index) => 3.4 + index * .55,
        stagger: .34,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      })
      const guideBreath = gsap.to('.digital-twin-kanshan-figure img', { y: -3, rotation: 1.2, duration: 1.8, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      return () => { paperBreath.kill(); moteDrift.kill(); guideBreath.kill() }
    })
    return () => mm.revert()
  }, { scope: stageRef })

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
      .fromTo('.digital-twin-route-path', { strokeDashoffset: 1, autoAlpha: .1 }, { strokeDashoffset: 0, autoAlpha: .9, duration: .78 })
      .fromTo('.digital-twin-kanshan-figure img', { scale: .9, rotation: -6 }, { scale: 1, rotation: 0, duration: .6, ease: 'back.out(1.8)' }, .16)
      .fromTo('.digital-twin-readout', { autoAlpha: .25, y: 13, rotation: 1.2 }, { autoAlpha: 1, y: 0, rotation: 0, duration: .46 }, .28)
    return () => timeline.kill()
  }, { scope: stageRef, dependencies: [activeNode], revertOnUpdate: true })

  useGSAP(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const grownPieces = '.digital-twin-state-object .is-grown'
    const timeline = gsap.timeline({ defaults: { ease: 'back.out(1.8)' } })
      .fromTo(grownPieces, { scale: .72, autoAlpha: .25, transformOrigin: '50% 100%' }, { scale: 1, autoAlpha: 1, stagger: .055, duration: .44 })
      .fromTo('.digital-twin-memory-caption', { autoAlpha: 0, y: 5 }, { autoAlpha: 1, y: 0, duration: .38, ease: 'power2.out' }, .18)
    return () => timeline.kill()
  }, {
    scope: stageRef,
    dependencies: [towerLevel, workshopPieces, greenhouseLeaves, opportunityLights, day, code],
    revertOnUpdate: true,
  })

  const moveScene = (event: PointerEvent<HTMLElement>) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const x = ((event.clientX - rect.left) / rect.width - .5) * 10
    const y = ((event.clientY - rect.top) / rect.height - .5) * 6
    stageRef.current?.style.setProperty('--scene-x', `${x}px`)
    stageRef.current?.style.setProperty('--scene-y', `${y}px`)
    stageRef.current?.style.setProperty('--paper-light-x', `${((event.clientX - rect.left) / rect.width) * 100}%`)
    stageRef.current?.style.setProperty('--paper-light-y', `${((event.clientY - rect.top) / rect.height) * 100}%`)
    stageRef.current?.style.setProperty('--depth-back-x', `${x * -.28}px`)
    stageRef.current?.style.setProperty('--depth-back-y', `${y * -.22}px`)
    stageRef.current?.style.setProperty('--depth-mid-x', `${x * -.52}px`)
    stageRef.current?.style.setProperty('--depth-mid-y', `${y * -.45}px`)
    stageRef.current?.style.setProperty('--depth-front-x', `${x * -.82}px`)
    stageRef.current?.style.setProperty('--depth-front-y', `${y * -.7}px`)
  }

  const resetScene = () => {
    stageRef.current?.style.setProperty('--scene-x', '0px')
    stageRef.current?.style.setProperty('--scene-y', '0px')
    stageRef.current?.style.setProperty('--paper-light-x', '50%')
    stageRef.current?.style.setProperty('--paper-light-y', '34%')
    stageRef.current?.style.setProperty('--depth-back-x', '0px')
    stageRef.current?.style.setProperty('--depth-back-y', '0px')
    stageRef.current?.style.setProperty('--depth-mid-x', '0px')
    stageRef.current?.style.setProperty('--depth-mid-y', '0px')
    stageRef.current?.style.setProperty('--depth-front-x', '0px')
    stageRef.current?.style.setProperty('--depth-front-y', '0px')
  }

  return (
    <section
      ref={stageRef}
      className={`digital-twin-stage tone-${code.toLowerCase()}`}
      style={sceneStyle}
      onPointerMove={moveScene}
      onPointerLeave={resetScene}
      aria-label={`宇宙 ${code} 的交互纸雕数字孪生场景`}
    >
      <div className="digital-twin-canvas" aria-hidden="true">
        <div className="digital-twin-world" />
        <div className="digital-twin-paper-depth">
          <i className="digital-twin-depth-back" />
          <i className="digital-twin-depth-mid" />
          <i className="digital-twin-depth-front" />
        </div>
        <div className="digital-twin-lightwash" />
        <div className="digital-twin-state-objects">
          <div className={`digital-twin-state-object digital-twin-tower ${activeNode === 'ability' ? 'is-active' : ''}`}>
            <span>能力塔</span>
            <div>{[1, 2, 3, 4, 5].map((level) => <i className={level <= towerLevel ? 'is-grown' : ''} key={level} />)}</div>
          </div>
          <div className={`digital-twin-state-object digital-twin-workshop ${activeNode === 'work' ? 'is-active' : ''}`}>
            <span>作品台</span>
            <div>{[1, 2, 3, 4, 5].map((piece) => <i className={piece <= workshopPieces ? 'is-grown' : ''} key={piece} />)}</div>
          </div>
          <div className={`digital-twin-state-object digital-twin-greenhouse ${activeNode === 'echo' ? 'is-active' : ''}`}>
            <span>专业苗圃</span>
            <div>{[1, 2, 3, 4, 5, 6].map((leaf) => <i className={leaf <= greenhouseLeaves ? 'is-grown' : ''} key={leaf} />)}</div>
          </div>
          <div className="digital-twin-lanterns">
            {[1, 2, 3, 4].map((light) => <i className={light <= opportunityLights ? 'is-grown' : ''} key={light} />)}
          </div>
        </div>
        <div className="digital-twin-pulse pulse-a" />
        <div className="digital-twin-pulse pulse-b" />
        <div className="digital-twin-pulse pulse-c" />
        <div className="digital-twin-motes"><i /><i /><i /><i /><i /></div>
      </div>

      <header className="digital-twin-head">
        <div><span>第 {day} 天</span><b>宇宙 {code} · {colors.label}</b></div>
        <p><i /> 这条路，记着你做过的选择</p>
      </header>

      <div className="digital-twin-memory-caption" aria-live="polite">
        <span>WORLD MEMORY</span>
        <p>塔亮 {towerLevel} 层 · 留下 {workshopPieces} 件作品 · 长出 {greenhouseLeaves} 片新叶</p>
      </div>

      <div className="digital-twin-event-title">
        <small>这一天发生了</small>
        <strong>{eventTitle}</strong>
      </div>

      <svg className="digital-twin-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className="digital-twin-route-shadow" d={routePaths[activeNode]} pathLength="1" />
        <path className="digital-twin-route-path" d={routePaths[activeNode]} pathLength="1" />
      </svg>

      <figure className="digital-twin-kanshan digital-twin-kanshan-figure">
        <img src="/kanshan-stroll.gif" alt="刘看山沿着职业岔路行走" />
        <figcaption>正在去看看</figcaption>
      </figure>

      <div className="digital-twin-nodes" aria-label="探索纸雕世界">
        {(Object.entries(nodes) as Array<[TwinNode, typeof nodes[TwinNode]]>).map(([key, node]) => {
          const Icon = node.icon
          return (
            <button
              type="button"
              className={activeNode === key ? 'active' : ''}
              style={nodePositions[key]}
              onClick={() => setActiveNode(key)}
              aria-pressed={activeNode === key}
              key={key}
            ><Icon size={14} weight="duotone" /><span>{node.label}</span></button>
          )
        })}
      </div>

      <aside className="digital-twin-readout" aria-live="polite">
        <CurrentIcon size={18} weight="duotone" />
        <div><small>{current.label}</small><strong>{current.value}</strong><p>{current.note}</p></div>
        <ArrowRight size={14} />
      </aside>

      <div className="digital-twin-universe-tabs" aria-hidden="true">
        <span className={code === 'A' ? 'active' : ''}>A · 系统学习</span>
        <span className={code === 'B' ? 'active' : ''}>B · AI 协作</span>
        <span className={code === 'C' ? 'active' : ''}>C · 专业深耕</span>
      </div>
    </section>
  )
}
