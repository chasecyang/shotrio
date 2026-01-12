# Project Todo List

> 标记 `[auto]` 的任务可以被自动化脚本执行
> 使用 `npx tsx scripts/auto-todo.ts` 运行自动化

---

## Auto Tasks [auto]

以下任务描述清晰，可以自动执行：

[x]素材详情中，如果素材正在生成，要有loading状态，告诉用户素材正在生成，而不是裂开图片
  - context: 素材详情加载时显示 skeleton/loading，而不是显示破损的图片占位符

[x]对话框输入中，icon太大了
  - context: 对话输入框中的 icon 尺寸过大，需要调小

[x]Agent中，用户拒绝某个function，这个function的状态不叫失败，而是用户拒绝，所以样式也应该是红色错误警戒色，而是灰色

[x]Agent请求生成图片时，编辑参数要支持用户可以修改参考图，包括添加新的参考图

[x]素材卡片、素材详情、素材类型筛选的tab，目前不支持音效类型，要支持上

---

## Manual Tasks

以下任务需要人工判断或复杂决策：
[]header余额没有随着agent扣款而刷新
  - context: 用户在 agent panel 中 accept 操作扣款后，header 组件的余额显示没有实时更新，需要刷新页面

[]积分不足不应该提交任务，现在会积分不足会进入worker然后失败
  - context: 在提交任务前应该检查积分余额，积分不足时前端直接拦截，不要让请求进入 worker

[]agent function 的刷新问题，接受任务后，没有自动刷新
  - context: accept 操作后 agent panel 的任务列表没有自动刷新显示最新状态
[]参数页面accept操作后，不应该一直loading
[]首页支持对话框创建项目
[]导出能力
[]agent英文化
[]页面英文化

[]定价页面优化，更多说明、优势等等
[]实际接入并测试支付

[]首页添加更多的视频demo
[]素材要有更多状态，比如生成新版本

[]编辑功能有bug，引用问题
[]剪辑approve function效果优化
[]图片上传bug
[]音效生成失败
[]素材库音频筛选
[]视频缩略图提取失败
[]前端视频渲染有点卡
[]用户修改生成图片参数的时候，要支持用户修改参考图
[]素材卡片上点击删除功能无用？
[]素材卡片要支持音频
[]确认一下AI有没有删除剧本的能力
[]深夜模式样式问题等等
[]media view要优化，白天模式
[]剪辑功能的各项小bug
[]功能-弃用，弃用不等于删除 / 回收站
[]user menu添加我的项目，用户可以快速进入到自己的项目中
[]增加引用素材的功能
[]让AI也能自定义美术风格
[]让用户可以上传图片，自定义美术风格
[]job中的parent job是不是可以废弃
[]让agent有简单控制素材版本的能力

## Completed

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
