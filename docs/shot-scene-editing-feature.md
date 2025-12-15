# 分镜场景编辑功能实现

## 概述

在分镜编辑器的"画面描述"下方添加了场景编辑功能，允许用户为分镜关联或更改场景。

## 实现内容

### 1. 数据模型更新

在 `shot-editor.tsx` 的 `formData` 状态中添加了 `sceneId` 字段：

```typescript
const [formData, setFormData] = useState({
  shotSize: shot.shotSize,
  cameraMovement: shot.cameraMovement || "static",
  visualDescription: shot.visualDescription || "",
  duration: millisecondsToSeconds(shot.duration || 3000),
  sceneId: shot.sceneId || null, // 新增
});
```

### 2. 自动保存逻辑

- 在 `hasChanges` 检测中添加了 `sceneId` 变更检测
- 在保存时将 `sceneId` 包含在 `updateShotAction` 调用中
- 利用现有的自动保存机制（1秒防抖）

### 3. UI 界面

在"画面描述"下方添加了"关联场景"区域，包括：

#### 场景选择器
- 下拉菜单显示所有可用场景
- 显示场景名称和描述
- 支持"未关联场景"选项
- 空状态提示：当没有场景时提示用户先创建场景

#### 场景信息展示
- 当选中场景后，在选择器下方显示场景详细信息
- 包含场景名称和描述
- 使用 `MapPin` 图标标识

### 4. 功能特性

- **自动保存**：场景选择更改后 1 秒自动保存
- **保存状态指示**：通过 EditableField 的 saveStatus 提供保存状态反馈
- **数据同步**：当 shot 数据更新时，表单自动同步
- **场景信息展示**：实时显示当前关联的场景详情

### 5. UI 布局调整

- 移除了原来在"基本信息"区域的只读场景显示
- 将场景编辑功能移至"画面描述"下方，使得编辑流程更加集中
- 保持了与其他编辑区域（角色列表、对话列表）一致的设计风格

## 使用方式

1. 在分镜编辑器中打开一个分镜
2. 在"画面描述"区域下方找到"关联场景"
3. 点击下拉菜单选择要关联的场景
4. 系统会自动保存更改
5. 选中的场景信息会在下方展示

## 技术栈

- **React Hooks**：使用 useState 管理表单状态
- **自动保存**：基于 useEffect 的防抖保存机制
- **shadcn/ui**：使用 Select 组件实现场景选择器
- **Server Actions**：通过 updateShotAction 保存数据到数据库

## 数据流

```
用户选择场景 
  → 更新 formData.sceneId 
  → 触发 hasChanges 检测 
  → 1秒后自动保存 
  → 调用 updateShotAction(shotId, { sceneId }) 
  → 更新数据库 
  → 刷新 shot 数据 
  → 更新 UI 显示
```

## 相关文件

- `/src/components/projects/editor/preview-panel/shot-editor.tsx` - 分镜编辑器主文件
- `/src/lib/actions/project/shot.ts` - 分镜相关 Server Actions
- `/src/lib/db/schemas/project.ts` - 数据库 Schema（shot 表包含 sceneId 字段）

## 注意事项

1. **数据验证**：sceneId 允许为 null（表示未关联场景）
2. **权限控制**：使用现有的认证机制确保用户只能编辑自己的项目
3. **错误处理**：通过 toast 提示保存失败的情况
4. **性能优化**：使用 1 秒防抖避免频繁保存

## 未来改进

可能的改进方向：
1. 添加快速创建场景的功能（在选择器中添加"新建场景"选项）
2. 场景预览图显示
3. 支持直接跳转到场景详情页
4. 批量关联场景功能（多选分镜时）

