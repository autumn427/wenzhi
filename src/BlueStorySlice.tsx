import {useEffect,useRef,useState} from 'react'
import './blue-story-slice.css'

const outcomes={
  debug:{choice:'先弄懂为什么出错',object:'排错手册',summary:'你暂缓了新功能，找出一处日期格式假设，并记下复现步骤。今晚能演示的内容少了，但这个错误有了可重复的检查方法。',cost:'代价：推迟一个新功能。',next:'拿三份不同格式的数据测试，记录还有哪些情况会失败。'},
  demo:{choice:'先缩小范围，完成演示',object:'原型边界清单',summary:'你把演示限定在一种数据格式，完成了主流程，同时写明暂不支持的输入。演示能继续，但格式变化的问题仍未解决。',cost:'代价：暂时不能处理其他格式。',next:'请一位同学按清单试用，记录第一个超出支持范围的需求。'},
} as const
type Choice=keyof typeof outcomes
export default function BlueStorySlice(){
  const [step,setStep]=useState<'arrival'|'event'|'result'|'memory'>('arrival')
  const [choice,setChoice]=useState<Choice|null>(null)
  const heading=useRef<HTMLHeadingElement>(null),panel=useRef<HTMLElement>(null)
  const reveal=()=>{heading.current?.focus({preventScroll:true});panel.current?.scrollIntoView({block:'nearest',behavior:'auto'})}
  useEffect(()=>{if(step!=='arrival')reveal()},[step])
  const openScene=()=>{setStep(choice?'memory':'event');reveal()}
  const outcome=choice?outcomes[choice]:null
  const choose=(value:Choice)=>{setChoice(value);setStep('result')}
  return <main className="blue-slice" data-step={step}>
    <header><div><p>问枝 · 蓝色路线 / 独立剧情试玩</p><h1>只剩两小时，先修哪一头？</h1></div><a href="/?paper-study=blue-layered">返回素材验收 ↗</a></header>
    <div className="blue-slice-scene">
      <img src="/career-universe-a-full.webp" alt="蓝色纸雕工作室，刘看山坐在工作台前"/>
      <span className="blue-slice-date">第 {outcome?'31':'30'} 天 · 系统学习</span>
      <button className="blue-slice-desk-hit" onClick={openScene} aria-label={outcome?'点击工作台，回看选择':'点击工作台，开始选择'} aria-controls="slice-panel" />
      {!outcome?<button className="blue-slice-object" onClick={openScene} aria-controls="slice-panel">点击工作台 · 开始选择 →</button>:<button className={`blue-slice-object is-${choice}`} onClick={openScene} aria-label={`回看${outcome.object}`} aria-controls="slice-panel">{outcome.object} · 回看 ↗</button>}
    </div>
    <section ref={panel} id="slice-panel" className="blue-slice-paper" aria-labelledby="slice-heading">
      <p className="blue-slice-kicker">{step==='arrival'?'一间工作室，一次小选择':step==='event'?'事件 · 原型遇到第一次变化':step==='result'?'选择之后':'工作台留下的记录'}</p>
      <h2 ref={heading} tabIndex={-1} id="slice-heading">{step==='arrival'?'先从桌上的一张纸开始。':step==='event'?'换了一份数据，工具不动了。':step==='result'?`桌上留下了${outcome?.object}`:outcome?.object}</h2>
      {step==='arrival'&&<><p>你做出了第一个小工具。今晚要向同学演示，却发现它只认原来那份数据。剩下的两小时，你想先用在哪里？</p><button className="blue-slice-primary" onClick={()=>setStep('event')}>走到工作台，看看任务 →</button></>}
      {step==='event'&&<><p>新文件把日期写成了另一种格式。主流程报错，演示时间却不会往后推。修好它要花时间，绕过去又不甘心。</p><div className="blue-slice-options"><button onClick={()=>choose('debug')}><strong>{outcomes.debug.choice}</strong><span>暂停新功能，复现问题并记录检查方法。</span></button><button onClick={()=>choose('demo')}><strong>{outcomes.demo.choice}</strong><span>只支持一种格式，并明确告诉试用者限制。</span></button></div></>}
      {step==='result'&&outcome&&<><p>{outcome.summary}</p><p className="blue-slice-cost">{outcome.cost}</p><button className="blue-slice-primary" onClick={()=>setStep('memory')}>翻开{outcome.object} →</button></>}
      {step==='memory'&&outcome&&<><p>第 30 天，你选择了「{outcome.choice}」。</p><p>{outcome.summary}</p><h3>接下来七天，试这一件事</h3><p>{outcome.next}</p><button onClick={()=>{setChoice(null);setStep('event')}}>试试另一种选择</button></>}
    </section>
    <footer>原创预设试玩事件，不是真人经历转述或实时 AI 推演。结果仅演示叙事分支，不预测现实。刷新后重置，不修改正式存档。纸雕原图保持静止；角色动作与真实物件分层尚未接入。</footer>
  </main>
}
