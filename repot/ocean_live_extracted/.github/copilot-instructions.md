<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->
 - [x] Verify that the copilot-instructions.md file in the .github directory is created.

- [x] Clarify Project Requirements
	<!-- Ask for project type, language, and frameworks if not specified. Skip if already provided. -->

- [x] Scaffold the Project
	<!--
	Ensure that the previous step has been marked as completed.
	Call project setup tool with projectType parameter.
	Run scaffolding command to create project files and folders.
	Use '.' as the working directory.
	If no appropriate projectType is available, search documentation using available tools.
	Otherwise, create the project structure manually using available file creation tools.
	-->

- [x] Customize the Project
	- Added 上車 effect with Car2 overlay and audio for viewer and broadcaster.
	- Added 回答我 effect with look overlay and looping audio synced across viewer/broadcaster.
	- Added 秀燕 effect with lumumu overlay and synchronized audio loop.
	- Added 吉伊卡哇 effect with Chiikawa overlay and looping music for both sides.
	- Added 哈基米 effect with cat overlay and synchronized audio loop.
	<!--
	Verify that all previous steps have been completed successfully and you have marked the step as completed.
	Develop a plan to modify codebase according to user requirements.
	Apply modifications using appropriate tools and user-provided references.
	Skip this step for "Hello World" projects.
	-->

- [ ] Install Required Extensions
	<!-- ONLY install extensions provided mentioned in the get_project_setup_info. Skip this step otherwise and mark as completed. -->

- [ ] Compile the Project
	<!--
	Verify that all previous steps have been completed.
	Install any missing dependencies.
	Run diagnostics and resolve any issues.
	Check for markdown files in project folder for relevant instructions on how to do this.
	-->

- [ ] Create and Run Task
	<!--
	Verify that all previous steps have been completed.
	Check https://code.visualstudio.com/docs/debugtest/tasks to determine if the project needs a task. If so, use the create_and_run_task to create and launch a task based on package.json, README.md, and project structure.
	Skip this step otherwise.
	 -->

- [ ] Launch the Project
	<!--
	Verify that all previous steps have been completed.
	Prompt user for debug mode, launch only if confirmed.
	 -->

- [ ] Ensure Documentation is Complete
	<!--
	Verify that all previous steps have been completed.
	Verify that README.md and the copilot-instructions.md file in the .github directory exists and contains current project information.
	Clean up the copilot-instructions.md file in the .github directory by removing all HTML comments.
	 -->

<!--
## Execution Guidelines
PROGRESS TRACKING:
- If any tools are available to manage the above todo list, use it to track progress through this checklist.
- After completing each step, mark it complete and add a summary.
- Read current todo list status before starting each new step.

COMMUNICATION RULES:
- Avoid verbose explanations or printing full command outputs.
- If a step is skipped, state that briefly (e.g. "No extensions needed").
```instructions
- [x] Verify that the copilot-instructions.md file in the .github directory is created.

- [x] Clarify Project Requirements

- [x] Scaffold the Project

- [x] Customize the Project
  - Added 上車 effect with Car2 overlay and audio for viewer and broadcaster.
  - Added 回答我 effect with look overlay and looping audio synced across viewer/broadcaster.
  - Added 秀燕 effect with lumumu overlay and synchronized audio loop.
  - Added 吉伊卡哇 effect with Chiikawa overlay and looping music for both sides.
  - Added 哈基米 effect with cat overlay and synchronized audio loop.

- [x] Install Required Extensions
  - 無需安裝額外延伸模組（未指定需求）。

- [x] Compile the Project
  - 已執行 `npm install` 並使用 `node --check server.js` 驗證語法。

- [x] Create and Run Task
  - 新增 `.vscode/tasks.json`，提供 `npm: start` 任務以啟動伺服器。

- [ ] Launch the Project
  - 等待使用者確認後再啟動 `npm start`。

- [x] Ensure Documentation is Complete
  - README.md 已涵蓋安裝與啟動指引，並清除了本檔案中的 HTML 註解。

- Work through each checklist item systematically.
- Keep communication concise and focused.
- Follow development best practices.
```
  - README.md file exists and is up to date
