# Project Todo List

> 标记 `[auto]` 的任务可以被自动化脚本执行
> 使用 `npx tsx scripts/auto-todo.ts` 运行自动化

---

## Auto Tasks [auto]


## Manual Tasks

### 本地化任务
[x]Timeline 面板本地化 (timeline-panel.tsx)
[]Agent 组件本地化 (floating-agent-card, approval-action-bar, action-editor-forms)
[]素材管理组件本地化 (asset-detail-view, media-viewer, image-upload)
[]素材生成和预览组件本地化
[]项目设置和验证本地化
[]Console 日志和注释转英文
[]运行本地化检测脚本验证
[]测试语言切换功能

[]参数页面accept操作后，不应该一直loading
[x]agent对话切换时，应该进入skelton，而不是对话中/AI创作中的状态
[x]首页支持对话框创建项目
[x]对话框进入自动模式状态和退出这个状态
待验证[]导出能力
[x]agent英文化
[]页面英文化
[]定价页面优化，更多说明、优势等等
[]实际接入并测试支付
[]首页添加更多的视频demo
[]素材要有更多状态，比如生成新版本
[]编辑功能有bug，引用问题
[]剪辑approve function效果优化
[]音效生成失败
[]支持拖拽agent面板大小
[]功能-弃用，弃用不等于删除 / 回收站
[]user menu添加我的项目，用户可以快速进入到自己的项目中
[]增加引用素材的功能
[]让AI也能自定义美术风格，美术风格改成一个文本字段
[]让用户可以上传图片，自定义美术风格
[]让agent有简单控制素材版本的能力
[]给剪辑区域的时间轴更大的默认高度
[]支持gemini 3 flash，可读图

[]agent停止功能有时无效
[]agent生成音乐的时候并没有很好的刷新素材库
[]开始创作没有记忆用户上次选中的项目
[]视频的重新生成没有填充好原本的首尾帧
[]视频生成新版本也要和图片一样有状态
[x]这是什么问题，agent图片生成，用户修改参数后报错：失败：参数校验失败: assets[0].tags 必须是数组类型
[]AI命名素材优化，镜头1 镜头2 的命名会影响ai发挥，命名更加贴合具体的素材内容
[]优化nano banana pro 的 prompt为json

[]对话结束，要自动退出自动模式


[]面向中文用户的故事，图片中就不应该出现英文？招牌应该要用中文。需要优化我们的项目描述来完成这一点
[]镜头语言太差 —— 改成sora2？或者？
[]agent有时候会陷入循环
[]积分扣除有问题，还是会让用户触发积分不足的任务
[]积分扣除中，header中的积分没有减少
[]导出功能无效
[]选择起始帧时，素材弹窗素材太多的时候，缺少滚动
[]重新生成视频缺乏参数填充

[]每次换模型都得修改function，我们希望这个function是装载式的，而且approve function和可修改的ui，也是配置装载式的
[]approve function中会循环加载素材
[]反正素材少，上下文收集的时候，直接展示前 50 个素材...
[]项目设置approve function包括画风提示词

[]approve function bar中加载素材时间很长，不该如此
[]agent设置项目信息后，header没有刷新，点击设置按钮，里面的内容也没有刷新

[]重试体验不佳，不会快速进入生成中状态，用户可能会点击多次

[]文本输入不需要素材描述

[]文本输入是上传？还是新建？ai的文本素材，有些该保存的没有保存

[]在检查资产的时候点击生成，依旧需要很长的时间才会结束响应，为什么？

[]agent会因为素材还在生成，而不引用相关素材，怎么解决？

[]存储原提示词和实际提示词？

## Completed
[x]现在素材库的加载阶段挺奇怪的，进去会空状态，然后出一些素材，然后又自动切换到之前的tab，要优化一下
[x]视频缩略图还是没有办法正常生成
[x]更新changelog
[x]图片上传bug，拖拽了一个素材后，再拖拽其他素材，无法成功应用
  - root cause: useEffect 依赖数组包含频繁变化的值导致 mouseup 监听器被不断替换，事件丢失
  - fix: 使用 useRef 存储最新值，避免 useEffect 频繁重新执行

[x]确认一下AI有没有删除剧本的能力
[x]素材库音频筛选
[x]media view要优化，白天模式
[x]剪辑功能的各项小bug
[x]深夜模式样式问题等等
[x]素材卡片要支持音频
[x]视频缩略图提取失败
[x]前端视频渲染有点卡
[x]用户修改生成图片参数的时候，要支持用户修改参考图
[x]素材卡片上点击删除功能无用？
[x]job中的parent job是不是可以废弃
[x]header余额没有随着agent扣款而刷新
  - context: 用户在 agent panel 中 accept 操作扣款后，header 组件的余额显示没有实时更新，需要刷新页面

[x]积分不足不应该提交任务，现在会积分不足会进入worker然后失败
  - context: 在提交任务前应该检查积分余额，积分不足时前端直接拦截，不要让请求进入 worker

[x]agent function 的刷新问题，接受任务后，没有自动刷新
  - context: accept 操作后 agent panel 的任务列表没有自动刷新显示最新状态

[x]素材详情中，如果素材正在生成，要有loading状态，告诉用户素材正在生成，而不是裂开图片
  - context: 素材详情加载时显示 skeleton/loading，而不是显示破损的图片占位符

[x]对话框输入中，icon太大了
  - context: 对话输入框中的 icon 尺寸过大，需要调小

[x]Agent中，用户拒绝某个function，这个function的状态不叫失败，而是用户拒绝，所以样式也应该是红色错误警戒色，而是灰色

[x]Agent请求生成图片时，编辑参数要支持用户可以修改参考图，包括添加新的参考图

[x]素材卡片、素材详情、素材类型筛选的tab，目前不支持音效类型，要支持上
[x]用户拒绝给他一个输入框他可以回复消息
[x]积分消耗放在accept按钮中
[x]个人设置、个人资料页面没有，可以暂时先删掉
[x]agent function用户没有积分的时候，应该弹付费提示
[x]agent function的扩大icon改成编辑icon
[x]使用nano banana pro模型
[x]提供重新生成图片的能力
[x]用户未登录的时候也要让他可以看到输入框
[x]不存在所谓的batch image generation
[x]统一job type名称
[x]agent 支持 auto accept？
[x]登录做成弹窗？登陆的日间夜间模式
[x]change log页面
[x]文件上传自动使用文件名称作为description
[x]素材空状态的时候，要引导用户去对话
[x]教AI学会nano banana强大的指令，比如加上头盔/加上xxxx
[x]支持批量文件上传

---
