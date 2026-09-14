import type { SimulationChoice, SimulationEvent, SimulationProfile, UniverseCode, UniverseRun } from './simulation'

export const campusOpening = {
  title: '周四晚上，三条消息同时来了。',
  story: '校门口的店问你周末能不能来兼职；学长说有个实习岗位可以帮你递简历；朋友想拉你一起做校园市集。',
  tension: '下周还有小组作业，你知道自己不可能全接。',
  question: '你想先试哪一个？',
}

export const campusProfile: SimulationProfile = {
  identity: 'student', intent: 'career', time: 'deep', sacrifice: 'study',
  confusion: '周末去店里兼职、请学长递实习简历，还是和朋友做校园市集？下周还有小组作业，我不可能全接。',
  skills: '做过小组汇报，会整理表格，愿意和同学一起做事，还没有正式工作经验',
  goal: '在不耽误课程和小组作业的前提下，试出一件愿意继续做的课外事',
  worries: '排班撞课、实习没人带、摆摊赔钱，还怕因为分工伤了朋友感情',
}

export const campusUniverses = [
  { code: 'A', tone: 'blue', title: '去店里兼职', choice: '先问清工资和排班，周末去店里试试', fit: '想自己挣一点生活费', preview: '收到第一笔工资，也开始计算时间和体力的账。', future: '半年后，排班表和课表能不能放在一起？', tension: '临时加班和小组作业撞到了一起。', milestones: ['接下周末班', '商量固定排班', '决定考前是否停班'], action: '先问清时薪、结算日和一班多久', sourceIndex: 0 },
  { code: 'B', tone: 'amber', title: '投第一份实习', choice: '把简历发给学长，看看真实岗位要做什么', fit: '想为以后找工作探探路', preview: '第一次被面试，也第一次发现上班和想象不一样。', future: '半年后，你能说清这份实习教会了什么吗？', tension: '没有经验，唯一回复的岗位又不太合心意。', milestones: ['改简历投岗位', '面对重复杂活', '决定是否续期'], action: '找出一段能讲清自己做了什么的经历', sourceIndex: 1 },
  { code: 'C', tone: 'green', title: '和朋友摆市集', choice: '和朋友合一个小摊，先把预算和分工说清', fit: '想一起做点自己的事', preview: '从热闹的点子走到进货、记账和收摊。', future: '半年后，卖出去多少东西之外，你们还愿意一起做吗？', tension: '买材料要花钱，朋友的空闲时间也和你不同。', milestones: ['准备第一场市集', '清库存、算成本', '决定下次还做不做'], action: '先问主办方规则，再和朋友列一张预算表', sourceIndex: 2 },
] as const

const choice = (id: string, label: string, tradeoff: string, delta: SimulationChoice['delta']): SimulationChoice => ({ id, label, tradeoff, delta, opens: [id], closes: [] })
const event = (code: UniverseCode, day: SimulationEvent['day'], title: string, story: string, tension: string, choices: SimulationChoice[]): SimulationEvent => ({
  id: `campus-${code}-${day}`, day, title, story, tension, choices,
  evidenceIds: code === 'A' ? ['campus-a1'] : code === 'B' ? (day === 30 ? ['campus-b1'] : ['campus-b2', 'campus-b3']) : ['campus-c1', 'campus-c2'],
})

export const campusFirstEvents: Record<UniverseCode, SimulationEvent> = {
  A: event('A', 30, '周日的班，撞上了小组作业',
    '你回了店长的消息，确认按小时结算，只接不撞课的周末班。第一个月，你学会了点单和收尾，也收到了约定的工资。这周四，店长突然问能不能补周日的班。同一时间，小组群定好了周日下午合稿，你负责的两页还没写完。',
    '多上一班就多一笔钱，但合稿的人也在等你。怎么回复？', [
      choice('a-take-shift', '接下补班，先把自己的部分写好发给组员', '能多挣一班的钱，但要提前赶完两页，合稿现场的讨论也会错过。', { energy: -9, confidence: 2 }),
      choice('a-protect-meeting', '这次不补班，按约定去小组合稿', '少一班收入，也要面对店长的失望；你保留了和组员一起改稿的时间。', { energy: -2, confidence: 2 }),
    ]),
  B: event('B', 30, '终于有回复，岗位却和想象不一样',
    '你把课程作业和社团经历整理进简历，请学长帮忙递出，也自己投了几家。第一个月大多没有回音。终于有家公司约聊：每周需要到岗三天，前期整理资料、协助活动，具体由谁带还没说清。你把课表打开，发现只有一天完全没课。',
    '这是唯一的回复。先争取调整出勤，还是放下这次机会？', [
      choice('b-negotiate', '把课表发过去，问能否改成一天到岗加远程任务', '你认真争取这次机会，但对方可能不接受；也得问清任务、补贴和带教。', { energy: -3, confidence: 2 }),
      choice('b-retarget', '说明时间不合适，改投时间更匹配的岗位', '这次机会先放下，下一封回复什么时候来仍未知；课程安排能保住。', { energy: -3, portfolio: 2 }),
    ]),
  C: event('C', 30, '报名通过了，朋友却还没开始准备',
    '你和朋友回了市集招募，确认了摊位规则，打算卖自制书签和闲置小物。你们约好两人总预算不超过两百元。开摊前一周，材料清单还是空的，朋友说这两天忙，周末一定来帮忙。可你的课程汇报也排在下周。',
    '今晚要定采购单。是先替朋友做完，还是把第一摊缩小？', [
      choice('c-cover', '先按原计划备料，和朋友约好开摊时补上分工', '摊位能按原计划准备，你却要多花两个晚上；口头约好的分工还没兑现。', { energy: -10, portfolio: 3 }),
      choice('c-scale-down', '只做少量书签，今晚一起写清各自负责什么', '摊上东西少一点，也可能扫朋友的兴；采购和准备更容易按预算完成。', { energy: -4, portfolio: 2 }),
    ]),
}

export function campusSecondEvent(run: UniverseRun): SimulationEvent {
  const has = (id: string) => run.flags.includes(id)
  if (run.code === 'A') return event('A', 90, '工资到了，晚上却越来越不够用',
    (has('a-take-shift') ? '你提前交了两页作业，周日去补班。合稿时组员改了结构，你下班后又补了一轮，第二天上课一直犯困。' : '你拒绝了补班，和组员一起把汇报改完。店长找到了别人，你那周的工资也确实少了一班。') + '到了第90天，店里想让你固定周五晚加周末两班。你对着课表算了算，收入会多些，休息和作业时间却要一起缩。',
    '要一份更稳定的排班，还是只保留一个周末班？', [
      choice('a-fixed', '答应固定排班，先约定考试周可以减班', '收入更可预期，但平时更忙；考前减班还要提前确认，不能临时消失。', { energy: -8, confidence: 3 }),
      choice('a-one-shift', '只接一个周末班，接受少赚一点', '每周挣得少些，店里也不保证总有班；空出来的时间能留给课业和休息。', { energy: 4, confidence: 2 }),
    ])
  if (run.code === 'B') return event('B', 90, '实习开始了，怎么每天都在整理表格',
    (has('b-negotiate') ? '你说明课表后，对方同意按一天到岗和明确的远程任务试行两周，也落实了补贴与对接人。你没有为此请假缺课。' : '你谢过学长，继续按出勤条件筛岗位。几周后，一家校园活动团队接受了你的时间安排，你才开始第一份实习。') + '到了第90天，你已经连续几周整理名单、核对物料。事情都做了，周报却只有“协助”。带你的同事很忙，临时任务还会挤进晚上。',
    '想学点东西，也不想无限加活。下一步怎么开口？', [
      choice('b-ask-task', '拿着已有记录，约同事聊一个能独立完成的小任务', '有机会获得具体反馈，但同事未必有空；先说清范围和截止时间。', { energy: -4, portfolio: 3, confidence: 2 }),
      choice('b-observe', '先做好约定任务，记录岗位日常并设一个复盘日期', '保住时间边界，短期还是重复工作；到期若没有反馈，就重新考虑是否继续。', { energy: 2, confidence: 1 }),
    ])
  return event('C', 90, '摊位很热闹，算完账却没剩多少',
    (has('c-cover') ? '你按原计划买了材料，熬了两个晚上准备。朋友开摊当天来帮忙招呼客人，但你一直惦记着前面多做的那些活。' : '你们缩小了品类，把采购、制作、记账分给具体的人。摊位没有隔壁丰富，不过两个人都做完了自己认领的部分。') + '到了第90天，再翻第一场的账：扣掉材料、摊位和包装，只余下很少的钱，还有一箱没卖完的东西。朋友提议下一场多进一点“爆款”。',
    '继续加货碰一碰，还是先处理手头的库存？', [
      choice('c-preorder', '先问同学想买什么，只按确认的数量少量补货', '要逐个确认需求，可能赶不上热闹；未经确认的款式先不买。', { energy: -4, portfolio: 3 }),
      choice('c-clear-stock', '先不进货，把库存和费用摊开，商量怎么收尾', '少一次尝新的机会，也得谈清各自的投入；卖不掉的东西可能要认亏。', { energy: 3, confidence: 2 }),
    ])
}

export function campusThirdEvent(run: UniverseRun): SimulationEvent {
  const has = (id: string) => run.flags.includes(id)
  if (run.code === 'A') return event('A', 150, '考试周到了，店里又问你能不能来',
    (has('a-fixed') ? '固定排班让你攒下了一点生活费，但几个晚上都用来赶作业。你翻出当时约定考试周减班的聊天记录。' : '一个周末班没有挣很多，空出来的晚上让你跟上了课程。你也发现，店里忙时还是会先来问你。') + '现在距离考试还有两周，店长说另一个同学请假了，想让你再顶一下。复习清单上还空着好几章。',
    '这一次，你准备给兼职留多少空间？', [
      choice('a-pause', '提前说明考前停班，交接完再专心复习', '这几周没有兼职收入，考后也未必保留原班次；复习时间能落到课表上。', { energy: 5, confidence: 2 }),
      choice('a-short-shift', '只接一段短班，写明结束时间，其他班不接', '还能有一点收入，也要少一段复习时间；到点离开需要你自己坚持。', { energy: -3, confidence: 2 }),
    ])
  if (run.code === 'B') return event('B', 150, '续期邀请来了，你却还没想好',
    (has('b-ask-task') ? '你拿着整理记录找同事聊过，接下了一次小活动的物料核对，还收到两条具体修改意见。成果不大，但你终于能讲清自己负责哪一段。' : '你按约定做完任务，也记下了岗位的一天。到了复盘日期，新增指导仍然很少；你确认自己不喜欢长期只做重复整理。') + '第150天，对方问能否下阶段多来一天。你下学期课更多，学长也发消息问“还做吗”。',
    '续期的条件，要由你自己说清。', [
      choice('b-renew-bounded', '提出不加到岗天数，并写清希望参与的任务', '表达了想继续的条件，对方可能不接受；实习不该靠挤掉课程来维持。', { energy: -3, confidence: 3 }),
      choice('b-finish', '按期交接结束，把做过的事和不喜欢的部分记下来', '下一份机会还没着落，也少一段补贴；但你不再只是为了简历多一行而留下。', { energy: 4, portfolio: 3 }),
    ])
  return event('C', 150, '新一场市集，还要不要一起报名',
    (has('c-preorder') ? '你们先收集了同学的需求，只补确认过的少量材料。有一款没人预订，就没再做；库存没有继续变大，跑订单却仍花了不少时间。' : '你们没有加货，趁课余把一部分库存卖掉，剩下的按约定各自带走。账上有没收回的成本，不过总算知道钱花在哪里。') + '第150天，新的市集招募发出来了。朋友说“这次应该会好一点”，你想到的是上次的准备时间和那些没说出口的委屈。',
    '朋友还想做，你愿意怎么回答？', [
      choice('c-agree-roles', '只报一场小摊，先写清分工、预算和怎么分账', '合作能再试一次，但谈钱和责任可能有点尴尬；没人认领的活就不做。', { energy: -4, confidence: 3 }),
      choice('c-stop', '这学期先不摆了，算清账，约朋友单纯吃顿饭', '放下这次活动，也不保证对方立刻理解；一起玩不必每次都一起做生意。', { energy: 5, confidence: 2 }),
    ])
}

export function campusEnding(run: UniverseRun): SimulationEvent {
  const has = (id: string) => run.flags.includes(id)
  const lastTradeoff = run.decisions[run.decisions.length - 1]?.tradeoff ?? ''
  let title: string, story: string
  if (run.code === 'A') {
    title = has('a-pause') ? '这次，复习日历上没有临时班' : '到了约定的时间，你脱下了围裙'
    story = (has('a-take-shift') ? '最开始那次补班，让你记住了下班后改小组作业的困劲。' : '最开始少接的那一班，换成了和组员坐在一起合稿的下午。') + (has('a-fixed') ? '后来固定排班让你存下一点钱，也占去了几个原本空着的晚上。' : '后来你只保留一个周末班，收入少些，课表没有被挤得那么满。') + (has('a-pause') ? '半年后的考试前，你完成交接，暂时停了兼职。工资记录还在手机里，下一班什么时候有还不知道；今晚先把书翻到没看完的那章。' : '半年后的考试前，你只顶了一段短班。到点时店里仍然忙，你按事先约定离开。回到宿舍已经有些累，复习表上还有没勾掉的内容，但你没有再接下一班。')
  } else if (run.code === 'B') {
    title = has('b-finish') ? '简历上，终于能写清自己做过什么' : '续期之前，你先发出了自己的条件'
    story = (has('b-negotiate') ? '第一封回复之后，你学着把课表和能到岗的时间说清。' : '放下第一份不合适的邀请后，你又等了几周才开始实习。') + (has('b-ask-task') ? '那次主动开口换来一个小任务和两条修改意见，没有让你一下变熟练，但留下了具体的工作记录。' : '整理表格的日子没有自动变成成长，不过你记清了岗位日常，也知道自己还需要怎样的指导。') + (has('b-finish') ? '半年后，你完成交接，删掉简历上空泛的“协助”，写下自己实际负责的内容。下一份工作还没找到，至少下次面试时，你有问题想问对方。' : '半年后，你把不加到岗天数和希望参与的任务发给对接人，对方还在确认。续期没有定下来，你先在课表上圈好了必须留给自己的时间。')
  } else {
    title = has('c-stop') ? '收摊以后，还可以只是朋友' : '新的报名表旁边，多了一张分工单'
    story = (has('c-cover') ? '第一场你多做了两个晚上的准备，这笔时间账后来终于被摆到桌面上。' : '第一场摊位不大，但采购、制作和记账都有具体的人负责。') + (has('c-preorder') ? '后来你们按确认的需求补货，少压了一些库存，也承认小摊不一定值得持续投入。' : '后来你们停了进货，清掉部分库存，接受了有些成本收不回来。') + (has('c-stop') ? '半年后，你回复朋友这学期先不报名，附上最后的账目，问周末要不要吃个饭。对方只回了一个“好”。你还不知道有没有介意，但没有用新一场活动把旧问题盖住。' : '半年后，你们只报了一场小摊。分工单写着谁备料、谁看摊、钱怎么分；空着的任务就从计划里删掉。还没开摊，也不知道能赚多少，这次没有谁默认另一个人会全部兜底。')
  }
  return event(run.code, 180, title, story, `最后这次取舍：${lastTradeoff}你想把哪一步带回现实试试？`, [])
}
