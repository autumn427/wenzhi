# 三个宇宙的分阶段纸雕场景

2026-09-14，使用内置 ImageGen 生成的项目素材，均为 1672 × 941。按故事主题独立创作，不复刻参考图里的山水建筑场景。背景不包含角色；刘看山使用项目已有透明 GIF 独立叠加。

| 路线 | 配色与内容 | 最终素材 | 完整提示词 |
| --- | --- | --- | --- |
| A 去店里兼职 | 蓝色与象牙白；校门口饮品店、收银台、杯子与排班时钟 | [parttime-blue.png](parttime-blue.png) | [提示词](parttime-blue.prompt.md) |
| B 投第一份实习 | 暖金与琥珀色；办公桌、电脑、简历和文件夹 | [internship-amber.png](internship-amber.png) | [提示词](internship-amber.prompt.md) |
| C 和朋友摆市集 | 鼠尾草绿与深绿；校园庭院、手作书签、折叠摊位和彩旗 | [market-green.png](market-green.png) | [提示词](market-green.prompt.md) |

## 第 90、150 天通用背景

| 阶段 | 宇宙 | 配色与场景 | 最终素材 | 完整提示词 | 刘看山动作 |
| --- | --- | --- | --- | --- | --- |
| 90 天 | A | 钴蓝、象牙白；共享自习桌与校园窗景 | [day90-blue.png](day90-blue.png) | [提示词](day90-blue.prompt.md) | 电脑 |
| 90 天 | B | 琥珀金；圆桌讨论空间与无字便笺 | [day90-amber.png](day90-amber.png) | [提示词](day90-amber.prompt.md) | 待机 |
| 90 天 | C | 鼠尾草绿；庭院公共长桌与廊道 | [day90-green.png](day90-green.png) | [提示词](day90-green.prompt.md) | 电脑 |
| 150 天 | A | 明亮青蓝、冰川蓝；露台阅读角与长凳 | [day150-blue.png](day150-blue.png) | [提示词](day150-blue.prompt.md) | 待机 |
| 150 天 | B | 杏色、浅蜜桃、奶油白；窗边长廊与书架 | [day150-amber.png](day150-amber.png) | [提示词](day150-amber.prompt.md) | 散步 |
| 150 天 | C | 嫩黄绿、奶油白；花园小径与长凳 | [day150-green.png](day150-green.png) | [提示词](day150-green.prompt.md) | 散步 |

第 90 天保留较沉静的深色层次，第 150 天调整色温并提高明度，避免相邻阶段像同一张背景。新场景不包含特定职业、成功结局或文字，适用于自定义故事。

`src/gal-scene-assets.ts` 根据宇宙编号和天数选择背景及动作；`src/ForkComparison.tsx` 负责呈现。第 30 天分别使用挥手、电脑、散步。背景为装饰图层，正文、选择、知乎 Logo、头像、赞同数和原文链接均为可交互网页内容。对白逐段阅读，支持直接进入选择、试选回看及确认推进，覆盖第 30、90、150 天，确认最后一次选择后进入原有结局页。试选期间保留当前场景，确认推进后才切换下一阶段。

动画直接引用 `public/kanshan-{wave,computer,idle,stroll}.gif`，没有重新生成角色。`kanshan-*-still.png` 为对应 GIF 的静帧，供暂停按钮及系统“减少动态效果”设置使用。角色占独立位置，不覆盖选择按钮或知乎卡片。

背景右侧与底部留给知乎纸笺和对白；小屏幕改为纵向布局。背景没有内嵌文字，不把知乎摘录或剧情烘焙到图片中。

## 树状路径地图

- 底图：[journey-map-paper.png](journey-map-paper.png)，1672 × 941，内置 imagegen 生成；[完整提示词](journey-map-paper.prompt.md)。
- 底图仅提供纸雕边缘和留白，节点、主线及未选分支均由真实 run 数据呈现。
- 点击已走节点查看对应票根和 evidenceIds 匹配的知乎卡片；看旧节点不移动代表实际进度的刘看山。
- 第 150 天 A 宇宙动作已由 idle 换成 wave；场景角色固定在对白框上沿。
