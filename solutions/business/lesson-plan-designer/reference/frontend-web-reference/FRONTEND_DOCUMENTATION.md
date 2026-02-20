# Frontend Documentation - 师范生发展平台

## Overview

This document describes the frontend implementation status, including:
- Vue components and their purposes
- Page views and features
- Backend API list
- API integration status

---

## 1. Frontend Components

### 1.1 Layouts

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| DefaultLayout | `src/layouts/DefaultLayout.vue` | Main layout with header + footer | Implemented |
| BlankLayout | `src/layouts/BlankLayout.vue` | Empty layout for login page | Implemented |

### 1.2 Reusable Components

| Component | File | Purpose | Status |
|-----------|------|---------|--------|
| AppHeader | `src/components/AppHeader.vue` | Navigation header with user menu | Implemented |
| AppFooter | `src/components/AppFooter.vue` | Site footer with branding | Implemented |
| ActivityFeed | `src/components/ActivityFeed.vue` | Activity stream with typed icons | Implemented |
| CalendarWidget | `src/components/CalendarWidget.vue` | Calendar month view | Implemented |
| TodoWidget | `src/components/TodoWidget.vue` | Todo items display | Implemented |
| PageSidebar | `src/components/PageSidebar.vue` | Page navigation sidebar | Implemented |
| Modal | `src/components/Modal.vue` | Reusable modal dialog | Implemented |
| HelloWorld | `src/components/HelloWorld.vue` | Vite default (unused) | Not Used |

---

## 2. Page Views

### 2.1 Views Summary

| View | File | Route | Description |
|------|------|-------|-------------|
| LoginView | `src/views/LoginView.vue` | `/login` | Login page with illustration |
| HomeView | `src/views/HomeView.vue` | `/home` | Activity feed + calendar + todos |
| LessonPlanView | `src/views/LessonPlanView.vue` | `/lesson-plan` | Lesson plan management |
| CourseView | `src/views/CourseView.vue` | `/course` | Course schedule management |
| ProjectsView | `src/views/ProjectsView.vue` | `/projects` | Project tracking with stages |
| LearningTasksView | `src/views/LearningTasksView.vue` | `/learning-tasks` | Question bank with tree sidebar |
| AIAssistantView | `src/views/AIAssistantView.vue` | `/ai-assistant` | AI chat interface |
| ProfileView | `src/views/ProfileView.vue` | `/profile` | User profile with stats |

### 2.2 View Details

#### LoginView
- **Features**: Login form, password visibility toggle, remember password, animated illustration
- **API Integration**: `authApi.login()` - Login authentication
- **Status**: Fully Integrated

#### HomeView
- **Features**: Activity feed with 10 activity types, calendar widget, todo widget, filter dropdown
- **API Integration**: Mock data (no specific API)
- **Status**: UI Complete, Uses Static Data

#### LessonPlanView
- **Features**: List view, filters (grade, subject), search, CRUD actions
- **API Integration**:
  - `lessonPlanApi.getList()` - Fetch lesson plans
  - `lessonPlanApi.delete()` - Delete lesson plan
  - `gradeApi.getList()` - Fetch grades for filter
- **Status**: Fully Integrated

#### CourseView
- **Features**: List view, status/grade/subject filters, tags display, favorite toggle
- **API Integration**:
  - `scheduleApi.getList()` - Fetch course schedules
  - `scheduleApi.delete()` - Delete schedule
  - `gradeApi.getList()` - Fetch grades for filter
- **Status**: Fully Integrated

#### ProjectsView
- **Features**: Project groups, stage tags (开题/研究/结题), expand/collapse
- **API Integration**:
  - `projectApi.getList()` - Fetch projects
- **Status**: Fully Integrated

#### LearningTasksView
- **Features**: Tree sidebar, tabs (学习任务/我的创建/我的收藏/我的审核), filters, difficulty stars
- **API Integration**:
  - `questionBankApi.getList()` - Fetch questions
  - `questionBankApi.delete()` - Delete question
  - `curriculumStandardApi.getTree()` - Fetch curriculum tree
- **Status**: Fully Integrated

#### AIAssistantView
- **Features**: Chat history sidebar, message bubbles, suggestion chips, model selector
- **API Integration**: None (UI mockup)
- **Status**: UI Complete, No Backend

#### ProfileView
- **Features**: Cover image, avatar, stats (following/followers/lessons/courses)
- **API Integration**:
  - `lessonPlanApi.getList()` - Fetch lesson count
  - `scheduleApi.getList()` - Fetch course count
  - Auth store for user info
- **Status**: Partially Integrated

---

## 3. CSS Design System

### 3.1 Stylesheets

| File | Lines | Purpose |
|------|-------|---------|
| `variables.css` | 87 | CSS custom properties (colors, spacing, etc.) |
| `base.css` | 831 | Base components (buttons, forms, cards, etc.) |
| `pages.css` | 750+ | Page layouts (feed, sidebar, modals, etc.) |

### 3.2 Design Tokens

- **Colors**: Primary (#2563eb), Success (#10b981), Warning (#f59e0b), Error (#ef4444)
- **Spacing**: 4px increments (--space-1 to --space-12)
- **Radius**: sm(4px), md(6px), lg(8px), xl(12px), 2xl(16px), full(9999px)
- **Shadows**: sm, md, lg, xl

---

## 4. Backend API List

### 4.1 API Summary

| Category | Controllers | Endpoints |
|----------|-------------|-----------|
| Core Business | 15 | 98 |
| Notifications | 3 | 22 |
| Import/Export | 3 | 8 |
| Schedule | 1 | 15 |
| **Total** | **21** | **134** |

### 4.2 Complete API Endpoints

#### Authentication (RuoYi Built-in)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | User login |
| POST | `/auth/logout` | User logout |
| GET | `/auth/tenant/list` | Get tenant list |
| GET | `/system/user/getInfo` | Get current user info |
| GET | `/system/user/profile` | Get user profile |
| PUT | `/system/user/profile` | Update user profile |

#### School Management (`/system/school`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query school list | Yes |
| POST | `/export` | Export schools | No |
| GET | `/{id}` | Get school by ID | Yes |
| POST | `/` | Add school | Yes |
| PUT | `/` | Update school | Yes |
| DELETE | `/{ids}` | Delete schools | Yes |

#### Grade Management (`/system/grade`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query grade list | Yes |
| POST | `/export` | Export grades | No |
| GET | `/{id}` | Get grade by ID | Yes |
| POST | `/` | Add grade | Yes |
| PUT | `/` | Update grade | Yes |
| DELETE | `/{ids}` | Delete grades | Yes |

#### Class Management (`/system/class`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query class list | Yes |
| POST | `/export` | Export classes | No |
| GET | `/{id}` | Get class by ID | Yes |
| POST | `/` | Add class | Yes |
| PUT | `/` | Update class | Yes |
| DELETE | `/{ids}` | Delete classes | Yes |

#### Lesson Plan (`/system/lessonplan`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query lesson plan list | Yes |
| POST | `/export` | Export lesson plans | No |
| GET | `/{id}` | Get lesson plan by ID | Yes |
| POST | `/` | Add lesson plan | Yes |
| PUT | `/` | Update lesson plan | Yes |
| DELETE | `/{ids}` | Delete lesson plans | Yes |

#### Schedule (`/system/schedule`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query schedule list | Yes |
| POST | `/export` | Export schedules | No |
| GET | `/{id}` | Get schedule by ID | Yes |
| GET | `/student/{studentId}` | Get schedules by student | Yes |
| GET | `/course/{courseId}` | Get schedules by course | Yes |
| POST | `/` | Add schedule | Yes |
| PUT | `/` | Update schedule | Yes |
| DELETE | `/{ids}` | Delete schedules | Yes |
| POST | `/generate` | Batch generate schedules | Yes |

#### Course Week (`/system/schedule/course-week`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query course week list | No |
| GET | `/{id}` | Get course week by ID | No |
| GET | `/course/{courseId}` | Get weeks by course | No |
| POST | `/` | Add course week | No |
| PUT | `/` | Update course week | No |
| DELETE | `/{ids}` | Delete course weeks | No |

#### Course Analysis (`/system/course-analysis`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query course analysis list | Yes |
| POST | `/export` | Export analyses | No |
| GET | `/{id}` | Get analysis by ID | Yes |
| POST | `/` | Add analysis | Yes |
| PUT | `/` | Update analysis | Yes |
| DELETE | `/{ids}` | Delete analyses | Yes |

#### Project (`/system/project`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query project list | Yes |
| POST | `/export` | Export projects | No |
| GET | `/{id}` | Get project by ID | Yes |
| POST | `/` | Add project | Yes |
| PUT | `/` | Update project | Yes |
| DELETE | `/{ids}` | Delete projects | Yes |

#### Project Member (`/system/project-member`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query member list | Yes |
| GET | `/project/{projectId}` | Get members by project | Yes |
| GET | `/user/{userId}` | Get projects by user | No |
| POST | `/export` | Export members | No |
| GET | `/{id}` | Get member by ID | No |
| POST | `/` | Add member | Yes |
| PUT | `/` | Update member | No |
| DELETE | `/{ids}` | Delete members | Yes |
| DELETE | `/project/{projectId}/user/{userId}` | Remove from project | No |

#### Test Paper (`/system/testpaper`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query test paper list | Yes |
| POST | `/export` | Export test papers | No |
| GET | `/{id}` | Get test paper by ID | Yes |
| POST | `/` | Add test paper | Yes |
| PUT | `/` | Update test paper | Yes |
| DELETE | `/{ids}` | Delete test papers | Yes |
| POST | `/generate` | Generate from question bank | No |

#### Question Bank (`/system/question-bank`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query question list | Yes |
| POST | `/export` | Export questions | No |
| GET | `/{id}` | Get question by ID | Yes |
| POST | `/` | Add question | Yes |
| PUT | `/` | Update question | Yes |
| DELETE | `/{ids}` | Delete questions | Yes |

#### Curriculum Standard (`/system/curriculum-standard`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query curriculum list | Yes |
| GET | `/tree` | Get curriculum tree | Yes |
| POST | `/export` | Export curriculums | No |
| GET | `/{id}` | Get curriculum by ID | No |
| POST | `/` | Add curriculum | No |
| PUT | `/` | Update curriculum | No |
| DELETE | `/{ids}` | Delete curriculums | No |

#### Textbook (`/system/textbook`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query textbook list | Yes |
| POST | `/export` | Export textbooks | No |
| GET | `/{id}` | Get textbook by ID | Yes |
| POST | `/` | Add textbook | No |
| PUT | `/` | Update textbook | No |
| DELETE | `/{ids}` | Delete textbooks | No |

#### Comment (`/system/comment`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query comment list | Yes |
| GET | `/target/{type}/{id}` | Get comments by target | Yes |
| POST | `/export` | Export comments | No |
| GET | `/{id}` | Get comment by ID | No |
| POST | `/` | Add comment | Yes |
| PUT | `/` | Update comment | No |
| DELETE | `/{ids}` | Delete comments | Yes |

#### Internship School (`/system/internship`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query internship school list | Yes |
| GET | `/active` | Get active schools | No |
| GET | `/university/{id}` | Get by university | No |
| POST | `/export` | Export schools | No |
| GET | `/{id}` | Get school by ID | Yes |
| POST | `/` | Add school | Yes |
| PUT | `/` | Update school | Yes |
| DELETE | `/{ids}` | Delete schools | Yes |

#### Research Topic (`/system/research-topic`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query topic list | Yes |
| GET | `/project/{projectId}` | Get topics by project | No |
| POST | `/export` | Export topics | No |
| GET | `/{id}` | Get topic by ID | Yes |
| POST | `/` | Add topic | Yes |
| PUT | `/` | Update topic | Yes |
| DELETE | `/{ids}` | Delete topics | Yes |

#### Research Question (`/system/research-question`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query question list | Yes |
| GET | `/topic/{topicId}` | Get questions by topic | No |
| POST | `/export` | Export questions | No |
| GET | `/{id}` | Get question by ID | Yes |
| POST | `/` | Add question | Yes |
| PUT | `/` | Update question | Yes |
| DELETE | `/{ids}` | Delete questions | Yes |

#### Notification Template (`/system/notification-template`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query template list | No |
| POST | `/export` | Export templates | No |
| GET | `/{id}` | Get template by ID | No |
| GET | `/code/{code}` | Get template by code | No |
| POST | `/` | Add template | No |
| PUT | `/` | Update template | No |
| DELETE | `/{ids}` | Delete templates | No |

#### Notification Delivery (`/system/notification-delivery`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query delivery list | No |
| GET | `/user/{userId}` | Get deliveries by user | No |
| POST | `/export` | Export deliveries | No |
| GET | `/{id}` | Get delivery by ID | No |
| POST | `/` | Add delivery | No |
| PUT | `/{id}/read` | Mark as read | No |
| PUT | `/` | Update delivery | No |
| DELETE | `/{ids}` | Delete deliveries | No |

#### Notification Preference (`/system/notification-preference`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/list` | Query preference list | No |
| GET | `/user/{userId}` | Get preferences by user | No |
| POST | `/export` | Export preferences | No |
| GET | `/{id}` | Get preference by ID | No |
| POST | `/` | Add preference | No |
| PUT | `/` | Update preference | No |
| DELETE | `/{ids}` | Delete preferences | No |

#### Export (`/system/export`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| GET | `/lesson-plan/{id}/word` | Export lesson plan to Word | No |
| GET | `/course-analysis/{id}/word` | Export analysis to Word | No |

#### Import (`/system/import`)
| Method | Endpoint | Description | Integrated |
|--------|----------|-------------|------------|
| POST | `/student` | Import students from Excel | No |
| POST | `/teacher` | Import teachers from Excel | No |
| POST | `/textbook` | Import textbooks from Excel | No |
| POST | `/curriculum-standard` | Import curriculum from Excel | No |
| POST | `/internship-school` | Import schools from Excel | No |
| GET | `/template/{type}` | Download import template | No |

---

## 5. Integration Summary

### 5.1 API Integration Stats

| Category | Total | Integrated | Percentage |
|----------|-------|------------|------------|
| Auth/User | 6 | 5 | 83% |
| School/Grade/Class | 18 | 15 | 83% |
| Lesson Plan | 6 | 5 | 83% |
| Schedule | 15 | 9 | 60% |
| Course Analysis | 6 | 5 | 83% |
| Project | 15 | 9 | 60% |
| Test Paper | 7 | 5 | 71% |
| Question Bank | 6 | 5 | 83% |
| Curriculum | 6 | 2 | 33% |
| Textbook | 6 | 2 | 33% |
| Comment | 7 | 4 | 57% |
| Internship | 8 | 5 | 63% |
| Research Topic/Question | 14 | 10 | 71% |
| Notification (all) | 22 | 0 | 0% |
| Import/Export | 8 | 0 | 0% |
| **Total** | **134** | **81** | **60%** |

### 5.2 Features Not Yet Integrated

1. **Export Functions** - Word/Excel export for lesson plans, analyses
2. **Import Functions** - Excel import for students, teachers, textbooks
3. **Notification System** - Templates, deliveries, preferences
4. **Course Week Management** - Detailed week planning
5. **Test Paper Generation** - Auto-generate from question bank
6. **AI Assistant Backend** - No AI service implemented yet

### 5.3 Frontend API Client (`src/api/index.js`)

Total API services defined: **18**
- authApi, userApi, lessonPlanApi, schoolApi, gradeApi
- schoolClassApi, projectApi, projectMemberApi, testPaperApi
- questionBankApi, commentApi, textbookApi, curriculumStandardApi
- scheduleApi, courseAnalysisApi, internshipSchoolApi
- researchTopicApi, researchQuestionApi

---

## 6. UX Patterns

This section documents the project-level UX patterns that all frontend developers should follow for consistency.

### 6.1 Tiered Edit Pattern

The application uses a **tiered approach** to editing based on content complexity:

| Tier | Content Type | Pattern | Save Behavior | Example |
|------|-------------|---------|---------------|---------|
| **Tier 1** | Simple fields | Click-to-edit inline | Auto-save on blur | Course name, lesson title |
| **Tier 2** | Structured content | Section-based with edit icon | Manual save button | Lesson plan sections |
| **Tier 3** | Complex operations | Modal/drawer | Manual confirm | Link lesson plan, delete |

#### When to Use Each Tier

**Tier 1 - Click-to-Edit (Auto-save)**
- Single text fields (names, titles, locations)
- Date/time selections
- Dropdown selections (status, grade, subject)
- Number inputs with suffix (duration)

**Tier 2 - Section-Based (Manual Save)**
- Rich text content (learning objectives, analysis)
- Multi-field groups that should save together
- Content requiring validation before save

**Tier 3 - Modal/Drawer (Manual Confirm)**
- Destructive operations (delete)
- Relationship changes (link/unlink)
- Multi-step forms
- Operations requiring explicit confirmation

### 6.2 Inline Edit Components

Located in `src/components/inline-edit/`:

| Component | Purpose | Save Trigger |
|-----------|---------|--------------|
| `InlineEditText` | Single-line text fields | Blur or Enter |
| `InlineEditDate` | Date selection | Selection |
| `InlineEditTimeRange` | Start/end time pair | Selection |
| `InlineEditNumber` | Numeric input with suffix | Blur |
| `InlineEditSelect` | Dropdown selection | Selection |

#### Usage Example

```vue
<InlineEditText
  v-model="item.name"
  placeholder="点击输入名称"
  @save="(value) => handleSave('name', value)"
/>

<InlineEditSelect
  v-model="item.status"
  :options="statusOptions"
  @save="(value) => handleSave('status', value)"
/>
```

### 6.3 Discoverability Signals

Users must know what fields are editable:

| Device | Signal |
|--------|--------|
| **Desktop hover** | Subtle blue background + pencil icon |
| **Touch devices** | Pencil icon always visible (50% opacity) |
| **Empty fields** | Placeholder prompt (e.g., "点击输入...") |
| **Focus state** | Focus ring around editable area |

### 6.4 Save Behavior & Feedback

| Event | Feedback |
|-------|----------|
| Auto-save success | Subtle "已保存" toast (2s) |
| Auto-save error | Inline error message + retry button |
| Manual save success | Button state change + toast |
| Saving in progress | Spinner icon, disabled input |

### 6.5 Keyboard Accessibility

| Key | Action |
|-----|--------|
| Tab | Navigate between editable fields |
| Enter | Start editing (when focused) / Save (when editing) |
| Escape | Cancel edit, restore original value |

### 6.6 Design Panel Decisions

These patterns were established through cross-functional discussion:

1. **Auto-save for simple fields** - Reduces friction, matches modern UX expectations (Notion, Google Docs)
2. **Optimistic UI with rollback** - Show saved immediately, rollback on error for better perceived performance
3. **300ms debounce** - Prevents excessive API calls during rapid typing
4. **Clear discoverability** - Users should never wonder if a field is editable

### 6.7 View-Specific Implementation

#### Course Detail Header (Tier 1)
- Course name → `InlineEditText`
- Schedule date → `InlineEditDate`
- Time range → `InlineEditTimeRange`
- Location → `InlineEditText`

#### Lesson Plan Detail Header (Tier 1)
- Title → `InlineEditText`
- Grade level → `InlineEditSelect`
- Subject → `InlineEditSelect`
- Duration → `InlineEditNumber`
- Status → `InlineEditSelect`

#### Lesson Plan Sections (Tier 2)
- Keep existing section-based editing with edit icon → save/cancel per section

---

## 7. Build Output

```
Production Build:
├── index.html                    0.47 kB
├── CSS (total)                  36.36 kB (6.03 kB gzipped)
├── JS (total)                  141.84 kB (55.54 kB gzipped)
└── Total                       ~178 kB (~62 kB gzipped)
```

---

## 7. Running the Application

### Development
```bash
cd frontend_claude
npm install
npm run dev
```

### Production Build
```bash
npm run build
```

### Environment Variables
Create `.env` file:
```
VITE_API_BASE_URL=http://localhost:8080
VITE_APP_TITLE=师范生发展平台
VITE_TENANT_ID=000000
VITE_CLIENT_ID=e5cd7e4891bf95d1d19206ce24a7b32e
```
